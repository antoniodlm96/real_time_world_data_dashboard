import logging

import httpx

from backend.app.cache import cache
from backend.app.config import settings

logger = logging.getLogger("gpsjam")

BASE_URL = "https://gpsjam.org/data"
UA = "Mozilla/5.0 (compatible; WorldDataDashboard/1.0)"
MIN_AIRCRAFT = 3

REGION_BOXES = [
    ("iran-iraq", 29, 42, 43, 63),
    ("levant", 31, 37, 35, 43),
    ("ukraine-russia", 44, 53, 22, 41),
    ("northern-europe", 50, 72, -10, 25),
    ("east-asia", 20, 45, 100, 145),
    ("southeast-asia", 1, 8, 95, 108),
]


def classify_region(lat: float, lng: float) -> str:
    for name, lat_min, lat_max, lng_min, lng_max in REGION_BOXES:
        if lat_min <= lat <= lat_max and lng_min <= lng <= lng_max:
            return name
    return "other"


def classify_level(pct: float) -> str:
    if pct > 10:
        return "high"
    if pct >= 2:
        return "medium"
    return "low"


async def _fetch_text(url: str) -> str:
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": UA}) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.text


async def _latest_date() -> str | None:
    try:
        csv = await _fetch_text(f"{BASE_URL}/manifest.csv")
        lines = [l for l in csv.strip().splitlines() if l]
        last = lines[-1].split(",")[0].strip()
        if len(last) == 10 and last[4] == "-" and last[7] == "-":
            return last
    except Exception as e:
        logger.warning("gpsjam manifest failed: %s", e)
    return None


async def fetch_gpsjam_hexes() -> list[dict]:
    date = await _latest_date()
    if not date:
        return []
    try:
        csv = await _fetch_text(f"{BASE_URL}/{date}-h3_4.csv")
    except Exception as e:
        logger.warning("gpsjam CSV failed: %s", e)
        return []

    lines = csv.strip().splitlines()
    if not lines or "hex" not in lines[0]:
        return []

    _h3 = _get_h3()
    results = []
    for line in lines[1:]:
        parts = line.split(",")
        if len(parts) < 3:
            continue
        hex_id, good_raw, bad_raw = parts[0], parts[1], parts[2]
        try:
            good = int(good_raw)
            bad = int(bad_raw)
        except ValueError:
            continue
        total = good + bad
        if total < MIN_AIRCRAFT:
            continue
        pct = round((bad / total) * 100, 1)
        level = classify_level(pct)
        if level == "low":
            continue
        lat = lng = None
        if _h3 is not None:
            try:
                lat, lng = _hex_to_latlng(_h3, hex_id)
            except Exception:
                continue
        results.append({
            "h3": hex_id,
            "lat": lat,
            "lng": lng,
            "level": level,
            "pct": pct,
            "affectedAircraft": bad,
            "totalAircraft": total,
            "region": classify_region(lat or 0, lng or 0) if lat is not None else "other",
        })

    results.sort(key=lambda r: r["pct"], reverse=True)
    return results


_h3_module = None


def _get_h3():
    global _h3_module
    if _h3_module is None:
        try:
            import h3

            _h3_module = h3
        except ImportError:
            _h3_module = False
    return _h3_module or None


def _hex_to_latlng(h3_module, hex_id: str) -> tuple[float, float]:
    lat, lng = h3_module.cell_to_latlng(hex_id)
    return round(lat, 5), round(lng, 5)


async def get_gpsjam_hexes() -> list[dict]:
    return await cache.get_or_fetch(
        "gpsjam:hexes",
        900,
        fetch_gpsjam_hexes,
    )
