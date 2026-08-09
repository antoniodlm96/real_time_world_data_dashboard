import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import settings
from backend.app.database import init_db, seed_radio_frequencies, seed_webcams
from backend.app.cache import cache
from backend.app.ingest import ingestion_loop
from backend.app.sources.bluesky import bluesky_loop
from backend.app.routers import events, markets, webcams, news, radio, flights, fires, commodities, weather, status
from backend.app.sources.radio_frequencies_seed import RADIO_FREQUENCIES
from backend.app.sources.webcams_seed import SEED_WEBCAMS
from backend.app.log_handler import get_log_handler

logging.basicConfig(level=logging.INFO)
logging.getLogger().addHandler(get_log_handler())


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("data", exist_ok=True)
    await init_db()
    await seed_webcams(SEED_WEBCAMS)
    await seed_radio_frequencies(RADIO_FREQUENCIES)
    await cache.connect()
    ingest_task = asyncio.create_task(ingestion_loop())
    bluesky_task = asyncio.create_task(bluesky_loop())
    yield
    ingest_task.cancel()
    bluesky_task.cancel()
    await cache.disconnect()
    try:
        await ingest_task
    except asyncio.CancelledError:
        pass
    try:
        await bluesky_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Real Time World Data Dashboard API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.cors_origins,
        "http://localhost:3000",
        "https://*.vercel.app",
    ],
    allow_origin_regex=r"https?://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events.router, prefix=settings.api_prefix)
app.include_router(markets.router, prefix=settings.api_prefix)
app.include_router(webcams.router, prefix=settings.api_prefix)
app.include_router(news.router, prefix=settings.api_prefix)
app.include_router(radio.router, prefix=settings.api_prefix)
app.include_router(flights.router, prefix=settings.api_prefix)
app.include_router(fires.router, prefix=settings.api_prefix)
app.include_router(commodities.router, prefix=settings.api_prefix)
app.include_router(weather.router, prefix=settings.api_prefix)
app.include_router(status.router, prefix=settings.api_prefix)


@app.get(f"{settings.api_prefix}/health")
async def health():
    return {"status": "ok"}
