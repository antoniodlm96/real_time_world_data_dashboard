import asyncio
import hashlib
import logging
from datetime import datetime, timezone

import httpx

logger = logging.getLogger("radio_discovery")

RADIO_BROWSER_MIRRORS = [
    "https://de1.api.radio-browser.info",
    "https://nl1.api.radio-browser.info",
    "https://at1.api.radio-browser.info",
]


async def fetch_radio_browser() -> list[dict]:
    for mirror in RADIO_BROWSER_MIRRORS:
        try:
            url = f"{mirror}/json/stations?limit=10000&hidebroken=true&has_geo_info=true&order=votes&reverse=true"
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
            logger.info("radio-browser: %d stations from %s", len(data), mirror)
            break
        except Exception as e:
            logger.warning("radio-browser mirror %s failed: %s", mirror, e)
            continue
    else:
        return []

    COUNTRY_MAP = {
        "the United States of America": "United States",
        "the United Kingdom of Great Britain and Northern Ireland": "United Kingdom",
        "the Russian Federation": "Russia",
        "the Netherlands": "Netherlands",
        "the Republic of China": "Taiwan",
        "the Philippines": "Philippines",
        "the Bahamas": "Bahamas",
        "the Gambia": "Gambia",
        "the Congo": "Congo",
        "the Democratic Republic of the Congo": "Democratic Republic of the Congo",
    }

    def clean_country(c: str) -> str | None:
        if not c or not c.strip():
            return None
        c = c.strip().lower()
        for k, v in COUNTRY_MAP.items():
            if c == k.lower():
                return v
        return c.strip().title()

    stations = []
    for s in data:
        sid = hashlib.md5((s.get("stationuuid", "") + s.get("name", "")).encode()).hexdigest()[:16]
        name = (s.get("name") or "Unknown").strip()[:200]
        if not name or name == "Unknown":
            continue
        country = clean_country(s.get("country")) if s.get("country") else None
        if not country:
            continue

        stations.append({
            "id": f"rb-{sid}",
            "name": name,
            "frequency": None,
            "description": ((s.get("tags") or "")[:500]).strip() or None,
            "url": s.get("url", ""),
            "stream_url": s.get("url_resolved") or s.get("url", ""),
            "country": country,
            "country_code": s.get("countrycode") or None,
            "state": s.get("state") or None,
            "language": s.get("language") or None,
            "tags": s.get("tags") or None,
            "codec": s.get("codec") or None,
            "bitrate": s.get("bitrate"),
            "geo_lat": s.get("geo_lat"),
            "geo_lng": s.get("geo_long"),
            "homepage": s.get("homepage") or None,
            "favicon": s.get("favicon") or None,
            "is_online": 1 if s.get("lastcheckok") else 0,
        })
    return stations


async def discover_radio_stations() -> list[dict]:
    all_stations = []
    for fetcher in [fetch_radio_browser]:
        try:
            stations = await fetcher()
            all_stations.extend(stations)
        except Exception as e:
            logger.warning("radio discovery failed: %s", e)
    return all_stations
