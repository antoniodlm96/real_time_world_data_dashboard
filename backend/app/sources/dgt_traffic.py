import hashlib
import logging
from datetime import datetime, timezone

import httpx

logger = logging.getLogger("dgt")

DGT_JSON = "https://www.dgt.es/.content/.assets/json/camaras.json"


async def fetch_dgt_cameras() -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(DGT_JSON)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning("DGT fetch failed: %s", e)
        return []

    raw = data.get("camaras", [])
    now = datetime.now(timezone.utc).isoformat()
    cams = []
    for c in raw:
        try:
            lat = float(c.get("latitud", 0))
            lng = float(c.get("longitud", 0))
        except (ValueError, TypeError):
            continue
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            continue

        cam_id = f"dgt-{c.get('id', '')}"
        image_url = c.get("imagen", "")
        title = f"DGT {c.get('carretera', '')} PK {c.get('pk', '')} - {c.get('provincia', '')}"
        cams.append({
            "id": cam_id,
            "title": title.strip(" -"),
            "url": image_url,
            "platform": "DGT",
            "country": "Spain",
            "province": c.get("provincia", ""),
            "city": "",
            "lat": lat,
            "lng": lng,
            "thumbnail_url": image_url,
            "is_active": True,
            "last_checked": now,
            "created_at": now,
        })

    logger.info("DGT: %d traffic cameras", len(cams))
    return cams
