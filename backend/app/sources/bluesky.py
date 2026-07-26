import asyncio
import json
import logging
import re
from datetime import datetime, timezone

import httpx

from backend.app.database import upsert_events
from backend.app.sources.country_coords import lookup_location

logger = logging.getLogger("bluesky")

JETSTREAM_URL = "wss://jetstream1.us-east.bsky.network/subscribe"

EMERGENCY_KEYWORDS = [
    "earthquake", "terremoto", "sismo",
    "explosion", "explosión", "blast",
    "flood", "inundación", "inundacao",
    "hurricane", "huracán", "tornado", "cyclone", "ciclón",
    "tsunami",
    "eruption", "erupción", "volcano", "volcán",
    "wildfire", "incendio", "bushfire",
    "shooting", "tiroteo", "mass shooting",
    "attack", "ataque", "terrorist", "terrorismo",
    "evacuation", "evacuación",
    "emergency", "emergencia",
    "disaster", "desastre",
    "crash", "accidente", "derailment",
    "collapse", "derrumbe", "colapso",
    "landslide", "deslizamiento", "mudslide",
    "drought", "sequía",
    "pandemic", "epidemic", "outbreak", "brote",
    "radiation", "nuclear", "radiactivo",
    "blackout", "apagón", "power outage",
    "hostage", "rehenes", "secuestro",
    "shooting", "tiroteo",
    "chemical spill", "derrame", "toxic",
    "air strike", "airstrike", "bombing", "bombardeo",
]

COUNTRY_NAMES = [
    "Afghanistan", "Albania", "Algeria", "Angola", "Argentina", "Australia", "Austria",
    "Bangladesh", "Belgium", "Bolivia", "Brazil", "Bulgaria", "Cambodia", "Cameroon",
    "Canada", "Chad", "Chile", "China", "Colombia", "Costa Rica", "Croatia", "Cuba",
    "Cyprus", "Czech Republic", "Denmark", "Dominican Republic", "Ecuador", "Egypt",
    "El Salvador", "Ethiopia", "Finland", "France", "Germany", "Ghana", "Greece",
    "Guatemala", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia",
    "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan",
    "Jordan", "Kazakhstan", "Kenya", "Kuwait", "Laos", "Latvia", "Lebanon", "Libya",
    "Lithuania", "Luxembourg", "Madagascar", "Malaysia", "Mali", "Malta", "Mexico",
    "Moldova", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia",
    "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea",
    "Norway", "Oman", "Pakistan", "Palestine", "Panama", "Paraguay", "Peru",
    "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda",
    "Saudi Arabia", "Senegal", "Serbia", "Sierra Leone", "Singapore", "Slovakia",
    "Slovenia", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain",
    "Sri Lanka", "Sudan", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan",
    "Tanzania", "Thailand", "Togo", "Trinidad and Tobago", "Tunisia", "Turkey",
    "Turkmenistan", "Uganda", "Ukraine", "UAE", "United Kingdom", "United States",
    "Uruguay", "Uzbekistan", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
    "UK", "USA", "US", "Britain", "England", "China", "Russia",
]

KEYWORD_RE = re.compile("|".join(re.escape(kw) for kw in EMERGENCY_KEYWORDS), re.IGNORECASE)
COUNTRY_RE = re.compile("|".join(re.escape(c) for c in COUNTRY_NAMES), re.IGNORECASE)

_seen_ids: set[str] = set()
_max_seen = 50000


async def _process_post(text: str, did: str, rkey: str, created_at: str) -> dict | None:
    global _seen_ids
    if not KEYWORD_RE.search(text):
        return None

    post_id = f"bsky-{did}-{rkey}"
    if post_id in _seen_ids:
        return None
    _seen_ids.add(post_id)
    if len(_seen_ids) > _max_seen:
        _seen_ids.clear()

    location = "Unknown"
    match = COUNTRY_RE.search(text)
    if match:
        location = match.group(0)

    cat_map = {
        "earthquake": "disaster", "terremoto": "disaster", "sismo": "disaster",
        "flood": "disaster", "inundación": "disaster", "tsunami": "disaster",
        "hurricane": "disaster", "huracán": "disaster", "tornado": "disaster",
        "cyclone": "disaster", "volcano": "disaster", "volcán": "disaster",
        "eruption": "disaster", "wildfire": "disaster", "incendio": "disaster",
        "drought": "disaster", "landslide": "disaster",
        "attack": "conflict", "ataque": "conflict", "terrorist": "conflict",
        "shooting": "conflict", "tiroteo": "conflict", "bombing": "conflict",
        "airstrike": "conflict", "air strike": "conflict",
        "hostage": "conflict", "explosion": "conflict", "explosión": "conflict",
        "evacuation": "disaster",
        "radiation": "disaster", "nuclear": "disaster",
    }
    category = "disaster"
    for kw, cat in cat_map.items():
        if kw in text.lower():
            category = cat
            break

    coords = lookup_location(location)
    if not coords:
        return None

    return {
        "id": post_id,
        "category": category,
        "title": text[:200],
        "description": None,
        "location": {"lat": coords[0], "lng": coords[1], "place": location},
        "magnitude": None,
        "timestamp": created_at,
        "source": "Bluesky",
        "source_url": f"https://bsky.app/profile/{did}/post/{rkey}",
        "severity": "medium",
    }


async def bluesky_loop():
    while True:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get("https://jetstream1.us-east.bsky.network/health")
                if resp.status_code != 200:
                    logger.warning("Jetstream not healthy, retrying in 30s")
                    await asyncio.sleep(30)
                    continue
        except Exception:
            logger.warning("Jetstream health check failed, retrying in 30s")
            await asyncio.sleep(30)
            continue

        try:
            import websockets
            async for ws in websockets.connect(JETSTREAM_URL, ping_interval=30, ping_timeout=10):
                logger.info("Connected to Bluesky firehose")
                batch: list[dict] = []
                last_flush = datetime.now(timezone.utc)

                try:
                    async for raw in ws:
                        try:
                            msg = json.loads(raw)
                        except json.JSONDecodeError:
                            continue

                        if msg.get("kind") != "commit":
                            continue
                        commit = msg.get("commit", {})
                        if commit.get("operation") != "create":
                            continue
                        if commit.get("collection") != "app.bsky.feed.post":
                            continue

                        record = commit.get("record", {})
                        text = record.get("text", "")
                        if not text:
                            continue

                        did = msg.get("did", "unknown")
                        rkey = commit.get("rkey", "unknown")
                        created_at = record.get("createdAt", datetime.now(timezone.utc).isoformat())

                        event = await _process_post(text, did, rkey, created_at)
                        if event:
                            batch.append(event)

                        now = datetime.now(timezone.utc)
                        if len(batch) >= 10 or (batch and (now - last_flush).total_seconds() >= 30):
                            try:
                                await upsert_events(batch)
                                logger.info("Bluesky: %d events", len(batch))
                            except Exception as e:
                                logger.warning("Bluesky upsert failed: %s", e)
                            batch.clear()
                            last_flush = now

                except websockets.exceptions.ConnectionClosed:
                    logger.warning("Bluesky disconnected, reconnecting...")
                    continue

        except Exception as e:
            logger.warning("Bluesky connection error: %s, retrying in 30s", e)
            await asyncio.sleep(30)
