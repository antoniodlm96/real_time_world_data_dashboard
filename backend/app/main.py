import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import settings
from backend.app.database import init_db, seed_radio_frequencies, seed_webcams
from backend.app.ingest import ingestion_loop
from backend.app.routers import events, markets, webcams, news, radio
from backend.app.sources.radio_frequencies_seed import RADIO_FREQUENCIES
from backend.app.sources.webcams_seed import SEED_WEBCAMS

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("data", exist_ok=True)
    await init_db()
    await seed_webcams(SEED_WEBCAMS)
    await seed_radio_frequencies(RADIO_FREQUENCIES)
    task = asyncio.create_task(ingestion_loop())
    yield
    task.cancel()
    try:
        await task
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


@app.get(f"{settings.api_prefix}/health")
async def health():
    return {"status": "ok"}
