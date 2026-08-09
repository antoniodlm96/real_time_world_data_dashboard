import asyncio
import logging
from datetime import datetime, timezone

import httpx

from backend.app.sources.usgs import fetch_earthquakes
from backend.app.sources.coingecko import fetch_crypto
from backend.app.sources.frankfurter import fetch_forex
from backend.app.sources.news_feeds import fetch_all_news
from backend.app.sources.webcam_finder import discover_webcams
from backend.app.sources.radio_discovery import discover_radio_stations
from backend.app.sources.country_coords import lookup_location
from backend.app.sources.gdacs import fetch_gdacs_rss
from backend.app.sources.fires import fetch_fires as fetch_fire_data
from backend.app.sources.flights import fetch_flights as fetch_flight_data
from backend.app.sources.weather import fetch_all_weather
from backend.app.database import (
    upsert_events,
    upsert_crypto,
    upsert_forex,
    upsert_news,
    upsert_radio_stations,
    clean_old_events,
    clean_old_news,
    get_webcams,
    get_unclassified_news,
    get_news_without_translation,
    upsert_webcam,
    deactivate_webcam,
    update_news_categories,
    upsert_fires,
    deactivate_old_fires,
    upsert_flights,
    deactivate_old_flights,
    upsert_weather_current,
)
from backend.app.services.news_classifier import classify_articles
from backend.app.services.source_health import record_source
from backend.app.services.news_clustering import apply_news_clustering

logger = logging.getLogger("ingest")

INGEST_INTERVAL = 10
WEBCAM_CHECK_INTERVAL = 300
CLASSIFY_INTERVAL = 60
GDACS_INTERVAL = 300
WEBCAM_DISCOVERY_INTERVAL = 3600
RADIO_DISCOVERY_INTERVAL = 7200
CLUSTER_INTERVAL = 600

_last_run: dict[str, float] = {}


def _mark_run(name: str):
    _last_run[name] = datetime.now(timezone.utc).timestamp()


def _should_run(name: str, interval: int) -> bool:
    last = _last_run.get(name)
    if last is None:
        return True
    return (datetime.now(timezone.utc).timestamp() - last) >= interval


def get_process_status() -> list[dict]:
    now = datetime.now(timezone.utc).timestamp()
    status = []
    for name, interval in [
        ("ingest_all", INGEST_INTERVAL),
        ("classify_news", CLASSIFY_INTERVAL),
        ("gdacs_rss", GDACS_INTERVAL),
        ("check_webcams", WEBCAM_CHECK_INTERVAL),
        ("discover_webcams", WEBCAM_DISCOVERY_INTERVAL),
        ("discover_radio", RADIO_DISCOVERY_INTERVAL),
        ("cluster_news", CLUSTER_INTERVAL),
    ]:
        last = _last_run.get(name)
        if last is not None:
            elapsed = now - last
            remaining = max(0, interval - elapsed)
        else:
            remaining = 0
        status.append({
            "name": name,
            "interval": interval,
            "last_run": datetime.fromtimestamp(last, tz=timezone.utc).isoformat() if last is not None else None,
            "remaining_seconds": round(remaining),
        })
    return status


async def ingest_all():
    tasks = {
        "earthquakes": fetch_earthquakes(),
        "crypto": fetch_crypto(),
        "forex": fetch_forex(),
    }
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)

    for name, result in zip(tasks.keys(), results):
        if isinstance(result, Exception):
            logger.warning("%s fetch failed: %s", name, result)
            await record_source(name, False)
            continue
        try:
            if name == "earthquakes":
                await upsert_events([e.model_dump() for e in result])
            elif name == "crypto":
                await upsert_crypto(result)
            elif name == "forex" and result:
                await upsert_forex(result)
            await record_source(name, True)
        except Exception as e:
            logger.error("%s upsert failed: %s", name, e)
            await record_source(name, False)

    try:
        news = await fetch_all_news()
        await upsert_news(news)
        await record_source("news_rss", True)
    except Exception as e:
        logger.warning("news fetch failed: %s", e)
        await record_source("news_rss", False)

    try:
        fires = await fetch_fire_data()
        if fires:
            await upsert_fires(fires)
            await deactivate_old_fires({f["id"] for f in fires})
        await record_source("nasa_firms", True)
    except Exception as e:
        logger.warning("fires fetch/upsert failed: %s", e)
        await record_source("nasa_firms", False)

    try:
        flights = await fetch_flight_data()
        if flights:
            await upsert_flights(flights)
            await deactivate_old_flights({f["id"] for f in flights})
        await record_source("opensky", True)
    except Exception as e:
        logger.warning("flights fetch/upsert failed: %s", e)
        await record_source("opensky", False)

    try:
        weather = await fetch_all_weather()
        if weather:
            await upsert_weather_current(weather)
        await record_source("openmeteo", True)
    except Exception as e:
        logger.warning("weather fetch/upsert failed: %s", e)
        await record_source("openmeteo", False)

    try:
        await clean_old_events(720)
        await clean_old_news(720)
    except Exception as e:
        logger.warning("cleanup failed: %s", e)


_gdacs_counter = 0
_discovery_counter = 0
_radio_discovery_counter = 0


async def discover_radio():
    try:
        stations = await discover_radio_stations()
        if stations:
            await upsert_radio_stations(stations)
            logger.info("radio: %d stations discovered", len(stations))
    except Exception as e:
        logger.warning("radio discovery failed: %s", e)


async def discover_new_webcams():
    try:
        new_cams = await discover_webcams()
        for w in new_cams:
            await upsert_webcam(w)
        logger.info("discovered %d new webcams", len(new_cams))
    except Exception as e:
        logger.warning("webcam discovery failed: %s", e)


EVENT_CATEGORIES = {"disaster", "conflict", "cyber"}


async def classify_news():
    try:
        unclassified = await get_unclassified_news(limit=20)
        need_translation = await get_news_without_translation(limit=15)
        articles = unclassified + need_translation
        if not articles:
            return
        classifications = await classify_articles(articles)
        if not classifications:
            return
        await update_news_categories(classifications)

        news_events = []
        now = datetime.now(timezone.utc).isoformat()
        for article in unclassified:
            aid = article["id"]
            info = classifications.get(aid)
            if not info:
                continue
            cat = info["category"] if isinstance(info, dict) else info
            if cat not in EVENT_CATEGORIES:
                continue
            loc = info.get("location", "Unknown") if isinstance(info, dict) else "Unknown"
            coords = lookup_location(loc)
            if not coords:
                continue
            news_events.append({
                "id": f"news-{aid}",
                "category": cat,
                "title": article["title"][:200],
                "description": (article.get("description") or "")[:400],
                "location": {"lat": coords[0], "lng": coords[1], "place": loc},
                "magnitude": None,
                "timestamp": article.get("published_at", now),
                "source": article.get("source_name", "News"),
                "source_url": article.get("url"),
                "severity": "medium",
            })
        if news_events:
            await upsert_events(news_events)
            logger.info("created %d events from news", len(news_events))
    except Exception as e:
        logger.warning("news classification failed: %s", e)


async def check_webcams():
    try:
        webcams = await get_webcams(active_only=True)
        async with httpx.AsyncClient(timeout=10) as client:
            for w in webcams:
                try:
                    resp = await client.head(w["url"], follow_redirects=True)
                    is_active = resp.status_code < 400
                except Exception:
                    is_active = False
                if not is_active:
                    await deactivate_webcam(w["id"])
                    logger.info("webcam deactivated: %s", w["id"])
                else:
                    w["last_checked"] = datetime.now(timezone.utc).isoformat()
                    w["is_active"] = 1
                    await upsert_webcam(w)
    except Exception as e:
        logger.warning("webcam check failed: %s", e)


async def ingestion_loop():
    while True:
        try:
            try:
                await asyncio.wait_for(ingest_all(), timeout=60)
            except asyncio.TimeoutError:
                logger.warning("ingest_all timed out after 60s")
            _mark_run("ingest_all")

            if _should_run("classify_news", CLASSIFY_INTERVAL):
                await classify_news()
                _mark_run("classify_news")

            if _should_run("gdacs_rss", GDACS_INTERVAL):
                try:
                    gdacs = await fetch_gdacs_rss()
                    if gdacs:
                        await upsert_events(gdacs)
                    await record_source("gdacs", True)
                except Exception as e:
                    logger.warning("gdacs failed: %s", e)
                    await record_source("gdacs", False)
                _mark_run("gdacs_rss")

            if _should_run("cluster_news", CLUSTER_INTERVAL):
                try:
                    clustered = await apply_news_clustering(hours=24)
                    if clustered:
                        logger.info("news clustering: %d duplicates flagged", clustered)
                    await record_source("news_clustering", True)
                except Exception as e:
                    logger.warning("news clustering failed: %s", e)
                    await record_source("news_clustering", False)
                _mark_run("cluster_news")

            if _should_run("check_webcams", WEBCAM_CHECK_INTERVAL):
                await check_webcams()
                _mark_run("check_webcams")

            if _should_run("discover_webcams", WEBCAM_DISCOVERY_INTERVAL):
                await discover_new_webcams()
                _mark_run("discover_webcams")

            if _should_run("discover_radio", RADIO_DISCOVERY_INTERVAL):
                await discover_radio()
                _mark_run("discover_radio")
        except Exception as e:
            logger.error("ingestion cycle failed: %s", e)
        await asyncio.sleep(INGEST_INTERVAL)
