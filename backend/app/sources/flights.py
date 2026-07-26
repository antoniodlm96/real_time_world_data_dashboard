import hashlib
import logging
from datetime import datetime, timezone

import httpx

logger = logging.getLogger("flights")

OPENSKY_URL = "https://opensky-network.org/api/states/all"


async def fetch_flights() -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(OPENSKY_URL)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning("OpenSky fetch failed: %s", e)
        return []

    now = datetime.now(timezone.utc).isoformat()
    flights = []
    for state in data.get("states", [])[:200]:
        icao24, callsign, origin_country, _, _, lon, lat, altitude, _, _, velocity, heading, _, _, _, _, _ = (
            state + [None] * 17
        )[:17]
        if lat is None or lon is None:
            continue
        if altitude is None or altitude < 0:
            altitude = 0
        speed = round(velocity or 0, 1)
        alt_ft = round(altitude * 3.281, 0)
        flight_id = hashlib.md5(f"{icao24}_{now}".encode()).hexdigest()[:16]
        flights.append({
            "id": flight_id,
            "icao24": icao24,
            "callsign": (callsign or "").strip() or None,
            "origin_country": origin_country,
            "lat": float(lat),
            "lng": float(lon),
            "altitude": alt_ft,
            "speed": speed,
            "heading": round(heading or 0, 1),
            "timestamp": now,
        })
    logger.info("OpenSky: %d flights", len(flights))
    return flights
