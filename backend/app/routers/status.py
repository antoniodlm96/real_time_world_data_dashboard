from fastapi import APIRouter, Query
from datetime import datetime, timezone

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.ingest import get_process_status
from backend.app.sources.bluesky import get_bluesky_status
from backend.app.log_handler import get_logs

router = APIRouter(prefix="/status", tags=["status"])

SOURCES = [
    {"name": "USGS Earthquakes", "type": "REST API", "url": settings.usgs_url, "enabled": True, "interval": "10s"},
    {"name": "GDACS Disasters", "type": "RSS", "url": "https://www.gdacs.org/xml/rss.xml", "enabled": True, "interval": "300s"},
    {"name": "OpenSky Flights", "type": "REST API", "url": "https://opensky-network.org/api/states/all", "enabled": True, "interval": "10s"},
    {"name": "Open-Meteo Weather", "type": "REST API", "url": "https://api.open-meteo.com/v1/forecast", "enabled": True, "interval": "10s"},
    {"name": "CoinGecko Crypto", "type": "REST API", "url": settings.coingecko_url, "enabled": True, "interval": "10s"},
    {"name": "Frankfurter Forex", "type": "REST API", "url": settings.frankfurter_url, "enabled": True, "interval": "10s"},
    {"name": "GDELT News", "type": "REST API", "url": settings.gdelt_url, "enabled": True, "interval": "10s"},
    {"name": "Bluesky Firehose", "type": "WebSocket", "url": "wss://jetstream1.us-east.bsky.network/subscribe", "enabled": True, "interval": "real-time"},
    {"name": "DGT Traffic Cameras", "type": "REST API", "url": "https://api.dev.mobility.abd.es/traffic/cameras", "enabled": True, "interval": "1h"},
    {"name": "Radio Browser", "type": "REST API", "url": "https://de1.api.radio-browser.info", "enabled": True, "interval": "2h"},
    {"name": "NASA FIRMS", "type": "REST API", "url": "https://firms.modaps.eosdis.nasa.gov/api/area/csv", "enabled": bool(settings.firms_api_key), "interval": "300s (fallback)"},
]

AI_SERVICES = [
    {"name": "Groq LLM", "model": "llama-3.1-8b-instant", "task": "News classification (category + location extraction)", "enabled": bool(settings.groq_api_key), "batch_size": 15, "interval": "60s", "rate_limit": "6000 TPM"},
]


@router.get("")
async def get_status():
    db = await get_db()
    try:
        tables = ["crypto", "events", "fires", "flights", "forex", "news", "radio_stations", "weather_current", "weather_history", "webcams"]
        counts = {}
        for t in tables:
            cur = await db.execute(f"SELECT COUNT(*) FROM {t}")
            counts[t] = (await cur.fetchone())[0]

        cur = await db.execute("SELECT category, COUNT(*) as cnt FROM news WHERE category IS NOT NULL GROUP BY category")
        news_cats = {r["category"]: r["cnt"] for r in await cur.fetchall()}
        cur = await db.execute("SELECT COUNT(*) FROM news WHERE category IS NULL")
        news_unclassified = (await cur.fetchone())[0]
        cur = await db.execute("SELECT COUNT(*) FROM news")
        news_total = (await cur.fetchone())[0]

        cur = await db.execute("SELECT COUNT(*) FROM events WHERE category='disaster'")
        disaster_count = (await cur.fetchone())[0]
        cur = await db.execute("SELECT COUNT(*) FROM events WHERE category='conflict'")
        conflict_count = (await cur.fetchone())[0]
        cur = await db.execute("SELECT COUNT(*) FROM events WHERE category='cyber'")
        cyber_count = (await cur.fetchone())[0]

        cur = await db.execute("SELECT COUNT(*) FROM fires WHERE is_active=1")
        fires_active = (await cur.fetchone())[0]
        cur = await db.execute("SELECT COUNT(*) FROM flights WHERE is_active=1")
        flights_active = (await cur.fetchone())[0]
        cur = await db.execute("SELECT COUNT(*) FROM webcams WHERE is_active=1")
        webcams_active = (await cur.fetchone())[0]
        cur = await db.execute("SELECT COUNT(*) FROM radio_stations WHERE is_online=1")
        radio_online = (await cur.fetchone())[0]

        return {
            "server_time": datetime.now(timezone.utc).isoformat(),
            "sources": SOURCES,
            "ai_services": AI_SERVICES,
            "database": {
                "path": settings.db_path,
                "table_counts": counts,
            },
            "events": {
                "disaster": disaster_count,
                "conflict": conflict_count,
                "cyber": cyber_count,
                "total": disaster_count + conflict_count + cyber_count,
            },
            "news_classification": {
                "total": news_total,
                "classified": news_total - news_unclassified,
                "unclassified": news_unclassified,
                "by_category": news_cats,
            },
            "active_counts": {
                "fires": fires_active,
                "flights": flights_active,
                "webcams": webcams_active,
                "radio_online": radio_online,
            },
            "batch_processes": get_process_status(),
            "bluesky": get_bluesky_status(),
        }
    finally:
        await db.close()


@router.get("/logs")
async def list_logs(
    category: str = Query("all", regex="^(all|integration|trace)$"),
    limit: int = Query(100, ge=1, le=500),
):
    return {"logs": get_logs(category, limit)}
