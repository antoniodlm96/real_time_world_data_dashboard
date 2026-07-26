import asyncio
import hashlib
import logging
import re
from datetime import datetime, timezone

import feedparser

from backend.app.database import upsert_events

logger = logging.getLogger("gdacs")

GDACS_RSS = "https://www.gdacs.org/xml/rss.xml"
GDACS_JSON = "https://www.gdacs.org/gdacsapi/api/events/geteventlist?eventtype={}"

EVENT_TYPES = {
    "TC": "Tropical Cyclone",
    "FL": "Flood",
    "VO": "Volcano",
    "DR": "Drought",
    "WF": "Wildfire",
    "EQ": "Earthquake",
    "TS": "Tsunami",
}

SEVERITY_MAP = {
    "Red": "critical",
    "Orange": "high",
    "Green": "medium",
    "White": "low",
}


async def fetch_gdacs_rss() -> list[dict]:
    try:
        feed = await asyncio.to_thread(feedparser.parse, GDACS_RSS)
    except Exception as e:
        logger.warning("GDACS RSS parse failed: %s", e)
        return []

    events = []
    now = datetime.now(timezone.utc).isoformat()
    for entry in feed.entries[:50]:
        title = entry.get("title", "")
        link = entry.get("link", "")
        guid = entry.get("id") or entry.get("guid", "") or link
        event_id = hashlib.md5(f"gdacs-{guid}".encode()).hexdigest()[:24]

        summary = (entry.get("summary") or entry.get("description") or "")[:500]
        published = entry.get("published_parsed")
        if published:
            ts = datetime(*published[:6], tzinfo=timezone.utc).isoformat()
        else:
            ts = now

        lat, lng, location = _parse_gdacs_coords(entry)
        if lat is None or lng is None:
            lat, lng, location = _extract_location_from_text(title, summary)

        if lat is None or lng is None:
            continue

        severity = _gdacs_severity(entry)
        category = _gdacs_category(title, summary)

        events.append({
            "id": event_id,
            "category": category,
            "title": title[:200],
            "description": summary[:400],
            "location": {"lat": lat, "lng": lng, "place": location or "Unknown"},
            "magnitude": _gdacs_magnitude(entry),
            "timestamp": ts,
            "source": "GDACS",
            "source_url": link,
            "severity": severity,
        })

    if events:
        logger.info("GDACS: %d alerts", len(events))
    return events


def _parse_gdacs_coords(entry) -> tuple[float | None, float | None, str | None]:
    glat = getattr(entry, "geo_lat", None) or getattr(entry, "geo:lat", None)
    glon = getattr(entry, "geo_long", None) or getattr(entry, "geo:long", None)
    if glat and glon:
        try:
            return float(str(glat).strip()), float(str(glon).strip()), entry.get("title", "")
        except ValueError:
            pass

    for tag in ["georss:point", "point"]:
        point = getattr(entry, tag, None)
        if point:
            try:
                parts = str(point).strip().split()
                if len(parts) >= 2:
                    return float(parts[0]), float(parts[1]), entry.get("title", "")
            except (ValueError, IndexError):
                pass

    for link in entry.get("links", []):
        href = link.get("href", "")
        m = re.search(r"[?&]lat=([\-\d.]+)&lng=([\-\d.]+)", href)
        if m:
            return float(m.group(1)), float(m.group(2)), entry.get("title", "")

    return None, None, None


LAT_LNG_RE = re.compile(r"([\-\d.]+)[\s,]+([\-\d.]+)")


def _extract_location_from_text(title: str, summary: str) -> tuple[float | None, float | None, str | None]:
    text = title + " " + summary
    for m in LAT_LNG_RE.finditer(text):
        try:
            lat = float(m.group(1))
            lng = float(m.group(2))
            if -90 <= lat <= 90 and -180 <= lng <= 180:
                return lat, lng, text.split(":")[0] if ":" in title else title[:60]
        except ValueError:
            continue
    return None, None, None


def _gdacs_severity(entry) -> str:
    for tag in ["gdacs:alertlevel", "alertlevel", "cap:severity"]:
        val = getattr(entry, tag, None)
        if val:
            return SEVERITY_MAP.get(str(val).strip(), "medium")
    return "medium"


def _gdacs_category(title: str, summary: str) -> str:
    text = (title + " " + summary).lower()
    if any(kw in text for kw in ["tropical cyclone", "hurricane", "typhoon", "cyclone"]):
        return "disaster"
    if any(kw in text for kw in ["flood", "flash flood", "inundation"]):
        return "disaster"
    if any(kw in text for kw in ["volcano", "volcanic", "eruption"]):
        return "disaster"
    if any(kw in text for kw in ["drought"]):
        return "disaster"
    if any(kw in text for kw in ["wildfire", "bushfire", "forest fire"]):
        return "disaster"
    if any(kw in text for kw in ["earthquake", "seismic"]):
        return "disaster"
    if any(kw in text for kw in ["tsunami"]):
        return "disaster"
    return "disaster"


def _gdacs_magnitude(entry) -> float | None:
    for tag in ["gdacs:magnitude", "magnitude", "cap:eventValue"]:
        val = getattr(entry, tag, None)
        if val:
            try:
                return round(float(str(val).strip()), 1)
            except ValueError:
                pass
    return None
