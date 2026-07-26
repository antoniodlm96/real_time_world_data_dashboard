import logging
import hashlib
from datetime import datetime, timezone

import httpx

from backend.app.sources.dgt_traffic import fetch_dgt_cameras

logger = logging.getLogger("webcam_finder")


async def fetch_earthcam_webcams() -> list[dict]:
    url = "https://www.earthcam.com/api/mapsearch/get_locations_network.php?a=fetch&r=ecn"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning("earthcam fetch failed: %s", e)
        return []

    places = data.get("data", [{}])[0].get("places", [])
    if not places:
        return []

    country_map = {
        "England": "United Kingdom", "Scotland": "United Kingdom",
        "Wales": "United Kingdom", "Northern Ireland": "United Kingdom",
        "USA": "United States", "U.S.A.": "United States",
    }

    webcams = []
    for p in places:
        country = p.get("country", "")
        country = country_map.get(country, country)
        lat_str, lng_str = p.get("posn", ["0", "0"])
        try:
            lat, lng = float(lat_str), float(lng_str)
        except (ValueError, TypeError):
            continue

        wid = hashlib.md5(p["id"].encode()).hexdigest()[:16]
        now = datetime.now(timezone.utc).isoformat()
        webcams.append({
            "id": f"ec-{wid}",
            "title": p.get("name", "EarthCam")[:100],
            "url": p.get("url", ""),
            "platform": "earthcam",
            "country": country or None,
            "province": p.get("state") or None,
            "city": p.get("city") or None,
            "lat": lat,
            "lng": lng,
            "thumbnail_url": p.get("thumbnail") or None,
            "is_active": 1,
            "last_checked": now,
            "created_at": now,
            "updated_at": now,
        })
    logger.info("earthcam: %d webcams from %d countries", len(webcams), len(set(w["country"] for w in webcams if w["country"])))
    return webcams


async def discover_webcams() -> list[dict]:
    all_cams = []
    for fetcher in [fetch_earthcam_webcams, fetch_dgt_cameras]:
        try:
            cams = await fetcher()
            all_cams.extend(cams)
        except Exception as e:
            logger.warning("webcam discovery failed: %s", e)
    return all_cams
