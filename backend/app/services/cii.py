import json
from datetime import datetime, timezone

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.cache import cache
from backend.app.sources.country_coords import COUNTRY_COORDS

WEIGHTS = {
    "conflict": 0.35,
    "disaster": 0.25,
    "cyber": 0.20,
    "weather": 0.10,
    "news": 0.10,
}

PER_EVENT_SCORE = {
    "conflict": 18.0,
    "disaster": 14.0,
    "cyber": 16.0,
    "weather": 12.0,
    "news": 6.0,
}

SEVERITY_BUCKETS = [
    (70, "critical"),
    (45, "high"),
    (25, "medium"),
]


def _cap(value: float) -> float:
    return min(100.0, max(0.0, value))


def _extract_country(text: str | None) -> str | None:
    if not text:
        return None
    low = text.lower()
    for name in COUNTRY_COORDS:
        if name.lower() in low:
            return name
    return None


def _severity(score: float) -> str:
    for threshold, label in SEVERITY_BUCKETS:
        if score >= threshold:
            return label
    return "low"


async def _event_counts(hours: int) -> dict[str, dict[str, int]]:
    db = await get_db()
    try:
        parts = ["SELECT category, place FROM events"]
        params = []
        if hours:
            from backend.app.database import _time_since_sql

            cond, extra = _time_since_sql("event_timestamp", hours)
            parts.append("WHERE " + cond)
            params.extend(extra)
        parts.append("ORDER BY event_timestamp DESC LIMIT 2000")
        cursor = await db.execute(" ".join(parts), tuple(params))
        rows = await cursor.fetchall()
    finally:
        await db.close()

    counts: dict[str, dict[str, int]] = {}
    for r in rows:
        country = _extract_country(r["place"])
        if not country:
            continue
        bucket = counts.setdefault(country, {"conflict": 0, "disaster": 0, "cyber": 0})
        cat = r["category"]
        if cat in bucket:
            bucket[cat] += 1
    return counts


async def _weather_severe() -> dict[str, int]:
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT country, COUNT(*) AS cnt FROM weather_current WHERE severe = 1 AND country IS NOT NULL GROUP BY country"
        )
        rows = await cursor.fetchall()
    finally:
        await db.close()
    return {r["country"]: r["cnt"] for r in rows}


async def _news_heat(hours: int) -> dict[str, int]:
    db = await get_db()
    try:
        parts = ["SELECT source_country, category FROM news WHERE category IN ('conflict','disaster','cyber')"]
        params: list = []
        if hours:
            from backend.app.database import _time_since_sql

            cond, extra = _time_since_sql("published_at", hours)
            parts.append("AND " + cond)
            params.extend(extra)
        cursor = await db.execute(" ".join(parts), tuple(params))
        rows = await cursor.fetchall()
    finally:
        await db.close()

    heat: dict[str, int] = {}
    for r in rows:
        country = r["source_country"]
        if not country:
            continue
        weight = {"conflict": 3, "disaster": 2, "cyber": 2}.get(r["category"], 1)
        heat[country] = heat.get(country, 0) + weight
    return heat


async def compute_cii(hours: int = 48) -> list[dict]:
    events, weather, news = await _event_counts(hours), await _weather_severe(), await _news_heat(hours)
    countries = set(events) | set(weather) | set(news)

    scores = []
    for country in sorted(countries):
        ec = events.get(country, {})
        components = {
            "conflict": _cap(ec.get("conflict", 0) * PER_EVENT_SCORE["conflict"]),
            "disaster": _cap(ec.get("disaster", 0) * PER_EVENT_SCORE["disaster"]),
            "cyber": _cap(ec.get("cyber", 0) * PER_EVENT_SCORE["cyber"]),
            "weather": _cap(weather.get(country, 0) * PER_EVENT_SCORE["weather"]),
            "news": _cap(news.get(country, 0) * PER_EVENT_SCORE["news"]),
        }
        score = _cap(sum(components[k] * WEIGHTS[k] for k in WEIGHTS))
        coords = COUNTRY_COORDS.get(country)
        scores.append({
            "country": country,
            "score": round(score, 1),
            "severity": _severity(score),
            "provenance": "computed",
            "components": {k: round(v, 1) for k, v in components.items()},
            "counts": ec,
            "lat": coords[0] if coords else None,
            "lng": coords[1] if coords else None,
        })

    scores.sort(key=lambda s: s["score"], reverse=True)
    return scores


async def get_cii_scores(hours: int = 48) -> list[dict]:
    return await cache.get_or_fetch(
        f"cii:scores:{hours}",
        settings.cache_ttl_crypto,
        lambda: compute_cii(hours),
    )
