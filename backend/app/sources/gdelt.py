import httpx
from datetime import datetime, timezone, timedelta

from backend.app.config import settings


async def _query_gdelt(query: str, max_records: int = 50, timespan: str = "24h") -> list[dict]:
    params = {
        "query": query,
        "mode": "artlist",
        "format": "json",
        "maxrecords": max_records,
        "timespan": timespan,
        "sort": "datedesc",
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(settings.gdelt_url, params=params)
            resp.raise_for_status()
            data = resp.json()
            return data.get("articles", data.get("results", []))
    except (httpx.HTTPError, httpx.TimeoutException, ValueError):
        return []


async def fetch_conflicts(max_records: int = 50) -> list[dict]:
    articles = await _query_gdelt("conflict war military", max_records)
    events = []
    now = datetime.now(timezone.utc)
    for art in articles:
        lat = art.get("lat")
        lon = art.get("lon")
        if lat is None or lon is None:
            continue
        events.append({
            "id": f"gdelt-conflict-{art.get('url', '').strip()}",
            "category": "conflict",
            "title": art.get("title", "Conflict Event")[:200],
            "description": art.get("summary", "")[:400],
            "location": {"lat": float(lat), "lng": float(lon), "place": None},
            "magnitude": None,
            "timestamp": art.get("seendate", now.isoformat()),
            "source": "GDELT",
            "source_url": art.get("url"),
            "severity": "medium",
        })
    if not events:
        events = _fallback_events("conflict")
    return events


async def fetch_cyber(max_records: int = 50) -> list[dict]:
    articles = await _query_gdelt("cyberattack hack data breach", max_records)
    events = []
    now = datetime.now(timezone.utc)
    for art in articles:
        lat = art.get("lat")
        lon = art.get("lon")
        if lat is None or lon is None:
            continue
        events.append({
            "id": f"gdelt-cyber-{art.get('url', '').strip()}",
            "category": "cyber",
            "title": art.get("title", "Cyber Event")[:200],
            "description": art.get("summary", "")[:400],
            "location": {"lat": float(lat), "lng": float(lon), "place": None},
            "magnitude": None,
            "timestamp": art.get("seendate", now.isoformat()),
            "source": "GDELT",
            "source_url": art.get("url"),
            "severity": "medium",
        })
    if not events:
        events = _fallback_events("cyber")
    return events


def _fallback_events(category: str) -> list[dict]:
    label = "Conflict" if category == "conflict" else "Cyber"
    now = datetime.now(timezone.utc).isoformat()
    return [
        {
            "id": f"fallback-{category}-1",
            "category": category,
            "title": f"[Demo] {label} Event (Fallback Data)",
            "description": "Live data unavailable. Showing sample event.",
            "location": {"lat": 48.8566, "lng": 2.3522, "place": "Demo Location"},
            "magnitude": None,
            "timestamp": now,
            "source": "GDELT (fallback)",
            "severity": "medium",
        }
    ]
