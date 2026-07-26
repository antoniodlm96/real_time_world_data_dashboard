# Real Time World Data Dashboard

## Architecture Overview

```
frontend/ (React + Vite + Tailwind + Leaflet)
  └─ src/
       ├─ components/     → UI panels, map, legend, ticker
       ├─ hooks/          → data fetching with auto-refresh
       ├─ types/          → TypeScript interfaces
       └─ App.tsx         → layout, routing, state

backend/ (FastAPI + SQLite + aiosqlite)
  └─ app/
       ├─ main.py         → FastAPI app, lifespan, CORS
       ├─ config.py       → pydantic-settings (env vars)
       ├─ database.py     → schema, CRUD, upserts
       ├─ ingest.py       → background ingestion loop
       ├─ routers/        → REST endpoints per domain
       ├─ services/       → AI classification (Groq)
       └─ sources/        → data fetchers per provider
```

---

## Data Pipeline

### Ingestion Loop (`backend/app/ingest.py`)
Runs every **10 seconds** as an asyncio background task:

| Interval | Action |
|----------|--------|
| **10s** | Fetch USGS earthquakes + CoinGecko crypto + Frankfurter forex + 98 RSS news feeds |
| **60s** | Classify 20 unclassified news articles via Groq, then create map events from disaster/conflict/cyber articles |
| **5min** | Health-check webcam URLs |
| **1h** | Discover new webcams |
| **2h** | Discover radio stations from Radio Browser API |

---

## Database Schema (`backend/app/database.py`)
SQLite with WAL mode. All tables have `created_at` / `updated_at` timestamps.

### `events`
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Unique event ID |
| category | TEXT | `disaster` · `conflict` · `cyber` |
| title | TEXT | Event title |
| description | TEXT | Event description |
| lat / lng | REAL | Coordinates for map |
| place | TEXT | Location name |
| magnitude | REAL | For earthquakes |
| event_timestamp | TEXT | When it happened |
| source | TEXT | Data source name |
| source_url | TEXT | Link to article |
| severity | TEXT | `low` · `medium` · `high` · `critical` |

### `news`
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | MD5(link + source) |
| title | TEXT | Article title |
| description | TEXT | Summary |
| url | TEXT | Article link |
| image_url | TEXT | Thumbnail |
| source_name | TEXT | News outlet |
| source_country | TEXT | Outlet's country |
| published_at | TEXT | ISO timestamp |
| category | TEXT | `disaster` · `conflict` · `cyber` · `politics` · `other` (set by Groq) |

### `webcams`, `radio_stations`, `crypto`, `forex`
Standard tables for each domain with relevant fields.

---

## Integrations

### USGS Earthquakes (`backend/app/sources/usgs.py`)
- **API**: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson`
- **Frequency**: every 10s
- **Data**: earthquakes > M2.5 with coordinates, magnitude, location
- **Map events**: category = `disaster`, severity based on magnitude
- **Fallback**: hardcoded demo earthquakes if API unavailable

### RSS News Feeds (`backend/app/sources/news_feeds.py`)
- **98 feeds** from 50+ countries (BBC, Reuters, CNN, Al Jazeera, NYT, El País, etc.)
- **Frequency**: every 10s (semaphore-limited to 10 concurrent parses)
- **Parser**: `feedparser` via `asyncio.to_thread`
- **Storage**: all articles upserted into `news` table

### Groq AI Classifier (`backend/app/services/news_classifier.py`)
- **Provider**: Groq (`llama-3.1-8b-instant`)
- **API Key**: `DASHBOARD_GROQ_API_KEY` in `.env`
- **Frequency**: every 60s, 20 articles per batch (respects 6000 TPM free tier limit)
- **Output**: per article → `{category, location}` (category + country name)
- **Categories**: `disaster` · `conflict` · `cyber` · `politics` · `other`
- **Location mapping**: `country_coords.py` maps country names to lat/lng

### News-derived Map Events (`backend/app/ingest.py`)
Articles classified as `disaster`/`conflict`/`cyber` with a recognized country → automatically create map events with coordinates from `country_coords.py`. This **replaces GDELT** as the event source for conflicts and cyber.

### CoinGecko Crypto (`backend/app/sources/coingecko.py`)
- **API**: CoinGecko markets endpoint (10 major coins)
- **Frequency**: every 10s
- **Data**: BTC, ETH, USDT, XRP, SOL, BNB, DOGE, USDC, ADA, STETH

### Frankfurter Forex (`backend/app/sources/frankfurter.py`)
- **API**: Frankfurter.dev (EUR base, 31 currencies)
- **Frequency**: every 10s
- **Data**: exchange rates for EUR, USD, GBP, JPY, etc.

### Webcams (`backend/app/sources/`)
- **Seed**: 109 curated webcams from YouTube, EarthCam, Bergfex, Explore
- **Discovery**: 303 EarthCam webcams via `mapsearch API`, refreshed hourly
- **Health check**: HEAD request every 5 minutes, deactivates broken URLs

### Radio (`backend/app/sources/`)
- **Internet radio**: 9,755 stations from 197 countries via Radio Browser API, rediscovered every 2h
- **Terrestrial FM/AM**: 236 stations from 50+ countries with real frequencies, seeded on startup
- **Frontend**: search, country filter, pagination (30/page), inline HTML5 audio player

---

## Frontend Architecture

### Components

| Component | Description |
|-----------|-------------|
| `WorldMap.tsx` | Leaflet map (CartoDB dark tiles). Markers use **color + shape**: red circle (disaster), cyan diamond (conflict), magenta triangle (cyber) |
| `Legend.tsx` | Header legend matching map colors + shapes |
| `SidePanel.tsx` | Category accordion with per-event lists and shape icons |
| `Ticker.tsx` | Scrolling news ticker with color-coded labels |
| `TimeFilter.tsx` | Time range selector (1h / 6h / 24h / 7d / 30d) |
| `NewsPanel.tsx` | News articles with category badges and country filter |
| `MarketsPanel.tsx` | Crypto + forex tables with auto-refresh |
| `WebcamPanel.tsx` | Webcam thumbnails with country filter |
| `RadioPanel.tsx` | Radio stations with search, country pills, pagination, audio player. Terrestrial stations show frequency badge |

### Data Hooks
Each hook polls its API endpoint every 10s and provides `{data, loading, error}`:

- `useEvents.ts` → `/api/events/{disasters,conflicts,cyber}?hours=`
- `useMarkets.ts` → `/api/markets/{crypto,forex}`
- `useNews.ts` → `/api/news?country=&hours=`
- `useWebcams.ts` → `/api/webcams`
- `useRadio.ts` → `/api/radio?country=&limit=`

---

## Map Event Visual Guide

| Category | Color | Shape | Source |
|----------|-------|-------|--------|
| **Disaster** | `#ff2222` red | ● circle | USGS + classified news |
| **Conflict** | `#00eeff` cyan | ◆ diamond | Classified news only |
| **Cyber** | `#ff44ff` magenta | ▲ triangle | Classified news only |

---

## Configuration

### `.env`
```
DASHBOARD_GROQ_API_KEY=gsk-...
```

### `backend/app/config.py`
All settings via `pydantic-settings` with `DASHBOARD_` prefix and `.env` auto-load.

### `backend/requirements.txt`
```
fastapi, uvicorn, httpx, pydantic, pydantic-settings, aiosqlite, groq
```

---

## Files Structure (key files)

```
backend/app/
├── main.py                  # FastAPI entry, lifespan (seed data, start ingestion)
├── config.py                # pydantic-settings
├── database.py              # Schema + CRUD (events, news, webcams, radio, crypto, forex)
├── ingest.py                # Background ingestion loop
├── models.py                # Pydantic models
├── routers/
│   ├── events.py            # GET /api/events/{disasters,conflicts,cyber}
│   ├── news.py              # GET /api/news, /api/news/countries
│   ├── markets.py           # GET /api/markets/{crypto,forex}
│   ├── webcams.py           # GET /api/webcams
│   └── radio.py             # GET /api/radio, /api/radio/countries
├── services/
│   └── news_classifier.py   # Groq-based classification (category + location)
└── sources/
    ├── usgs.py              # USGS earthquakes
    ├── news_feeds.py        # 98 RSS feeds
    ├── coingecko.py         # Crypto prices
    ├── frankfurter.py       # Forex rates
    ├── webcam_finder.py     # EarthCam discovery
    ├── webcams_seed.py      # 109 curated webcams
    ├── radio_discovery.py   # Radio Browser API
    ├── radio_frequencies_seed.py  # 236 terrestrial FM/AM stations
    └── country_coords.py    # Country → lat/lng mapping

frontend/src/
├── App.tsx                  # Layout, tabs, ticker, time filter
├── types/index.ts           # All TypeScript interfaces
├── hooks/
│   ├── useEvents.ts
│   ├── useMarkets.ts
│   ├── useNews.ts
│   ├── useWebcams.ts
│   └── useRadio.ts
└── components/
    ├── WorldMap.tsx         # Leaflet map with color + shape markers
    ├── Legend.tsx           # Map legend in header
    ├── SidePanel.tsx        # Event list with category accordion
    ├── Ticker.tsx           # Scrolling headlines
    ├── TimeFilter.tsx       # Time range selector
    ├── NewsPanel.tsx        # News with category badges
    ├── MarketsPanel.tsx     # Crypto + forex tables
    ├── WebcamPanel.tsx      # Webcam grid
    └── RadioPanel.tsx       # Radio search, player, frequency badges
```
