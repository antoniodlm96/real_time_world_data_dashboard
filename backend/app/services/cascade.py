import math
from datetime import datetime, timezone

from backend.app.database import get_db
from backend.app.cache import cache
from backend.app.config import settings
from backend.app.sources.infrastructure import INFRASTRUCTURE

CASCADE_RADIUS_KM = 150
INFRA_RADIUS_KM = 75
MAX_CASCADES = 40

SEVERITY_RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}
SEVERITY_LABEL = {1: "low", 2: "medium", 3: "high", 4: "critical"}


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(a))


async def _recent_events(hours: int) -> list[dict]:
    db = await get_db()
    try:
        from backend.app.database import _time_since_sql

        parts = ["SELECT id, category, title, lat, lng, place, severity, event_timestamp FROM events"]
        params: list = []
        if hours:
            cond, extra = _time_since_sql("event_timestamp", hours)
            parts.append("WHERE " + cond)
            params.extend(extra)
        parts.append("ORDER BY event_timestamp DESC LIMIT 2000")
        cursor = await db.execute(" ".join(parts), tuple(params))
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


def _cascade_id(a: dict, b: dict) -> str:
    key = "|".join(sorted([str(a["id"]), str(b["id"])]))
    import hashlib

    return "cascade-" + hashlib.md5(key.encode()).hexdigest()[:20]


def _bump_severity(base: str, extra: int) -> str:
    rank = min(4, SEVERITY_RANK.get(base, 2) + extra)
    return SEVERITY_LABEL[rank]


async def detect_cascades(hours: int = 24) -> list[dict]:
    events = [e for e in await _recent_events(hours) if e.get("lat") is not None and e.get("lng") is not None]
    cascades: list[dict] = []
    seen: set[str] = set()

    for i in range(len(events)):
        a = events[i]
        if not a.get("lat") or not a.get("lng"):
            continue
        for j in range(i + 1, len(events)):
            b = events[j]
            if not b.get("lat") or not b.get("lng"):
                continue
            if a["category"] == b["category"]:
                continue
            dist = _haversine_km(a["lat"], a["lng"], b["lat"], b["lng"])
            if dist > CASCADE_RADIUS_KM:
                continue
            cid = _cascade_id(a, b)
            if cid in seen:
                continue
            seen.add(cid)
            severity = _bump_severity(max([a.get("severity", "low"), b.get("severity", "low")], key=SEVERITY_RANK.get), 1)
            lat = (a["lat"] + b["lat"]) / 2
            lng = (a["lng"] + b["lng"]) / 2
            cascades.append({
                "id": cid,
                "title": f"{a['category'].title()} + {b['category'].title()} convergence",
                "description": (
                    f"{a['title'][:120]} and {b['title'][:120]} within ~{round(dist)} km "
                    f"near {a.get('place') or 'unknown location'}."
                ),
                "lat": round(lat, 4),
                "lng": round(lng, 4),
                "severity": severity,
                "distance_km": round(dist, 1),
                "events": [a["id"], b["id"]],
                "categories": sorted({a["category"], b["category"]}),
                "timestamp": max(a.get("event_timestamp"), b.get("event_timestamp")),
            })

    for e in events:
        if not e.get("lat") or not e.get("lng"):
            continue
        if e["category"] != "disaster":
            continue
        for item in INFRASTRUCTURE:
            ilat, ilng = item.get("lat"), item.get("lng")
            if ilat is None or ilng is None:
                continue
            dist = _haversine_km(e["lat"], e["lng"], ilat, ilng)
            if dist > INFRA_RADIUS_KM:
                continue
            cid = "cascade-infra-" + str(e["id"]) + "-" + str(item["id"])
            if cid in seen:
                continue
            seen.add(cid)
            severity = _bump_severity(e.get("severity", "medium"), 1)
            cascades.append({
                "id": cid,
                "title": f"{item['label']} exposed to {e['category']}",
                "description": (
                    f"{item['label']} is within ~{round(dist)} km of {e['title'][:120]}. "
                    f"Potential infrastructure impact."
                ),
                "lat": round(ilat, 4),
                "lng": round(ilng, 4),
                "severity": severity,
                "distance_km": round(dist, 1),
                "events": [e["id"]],
                "categories": [e["category"], "infrastructure"],
                "timestamp": e.get("event_timestamp"),
            })

    cascades.sort(key=lambda c: SEVERITY_RANK.get(c["severity"], 2), reverse=True)
    return cascades[:MAX_CASCADES]


async def get_cascades(hours: int = 24) -> list[dict]:
    return await cache.get_or_fetch(
        f"cascades:{hours}",
        settings.cache_ttl_crypto,
        lambda: detect_cascades(hours),
    )
