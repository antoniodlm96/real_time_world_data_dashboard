import httpx

from backend.app.cache import cache
from backend.app.config import settings
from backend.app.models import UnifiedEvent


async def fetch_earthquakes() -> list[UnifiedEvent]:
    items = await cache.get_or_fetch(
        "usgs:earthquakes",
        settings.cache_ttl_earthquake,
        _fetch_earthquakes_raw,
    )
    return [UnifiedEvent.model_validate(item) for item in items]


async def _fetch_earthquakes_raw() -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(settings.usgs_url)
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, httpx.TimeoutException, ValueError) as e:
        return [e.model_dump() for e in _fallback_earthquakes(e)]

    events = []
    for feature in data.get("features", []):
        props = feature.get("properties", {})
        geo = feature.get("geometry", {})
        coords = geo.get("coordinates", [])
        if len(coords) < 3:
            continue
        try:
            event = UnifiedEvent(
                id=f"usgs-{props.get('id', props.get('code', ''))}",
                category="disaster",
                title=props.get("title", "Unknown Earthquake"),
                description=f"Magnitude {props.get('mag', '?')} earthquake at depth {coords[2]:.1f} km",
                location={
                    "lat": coords[1],
                    "lng": coords[0],
                    "place": props.get("place"),
                },
                magnitude=props.get("mag"),
                timestamp=props.get("time", 0) / 1000,
                source="USGS",
                source_url=props.get("url"),
                severity=_mag_severity(props.get("mag")),
            )
            events.append(event.model_dump())
        except (KeyError, IndexError, TypeError):
            continue

    return events


def _mag_severity(mag: float | None) -> str:
    if mag is None:
        return "unknown"
    if mag >= 6.0:
        return "critical"
    if mag >= 5.0:
        return "high"
    if mag >= 4.0:
        return "medium"
    return "low"


def _fallback_earthquakes(error: Exception) -> list[UnifiedEvent]:
    return [
        UnifiedEvent(
            id="fallback-quake-1",
            category="disaster",
            title="[Demo] Earthquake (Fallback Data)",
            description="Live data unavailable. Showing sample event.",
            location={"lat": 35.0, "lng": -118.0, "place": "Demo Location"},
            magnitude=4.5,
            timestamp="2025-01-01T00:00:00Z",
            source="USGS (fallback)",
            severity="medium",
        )
    ]
