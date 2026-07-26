import hashlib

import aiosqlite
import json
from datetime import datetime, timezone

from backend.app.config import settings

DB_PATH = settings.db_path


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    return db


async def init_db():
    db = await get_db()
    try:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                lat REAL,
                lng REAL,
                place TEXT,
                magnitude REAL,
                event_timestamp TEXT NOT NULL,
                source TEXT NOT NULL,
                source_url TEXT,
                severity TEXT,
                ingested_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS crypto (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                symbol TEXT NOT NULL,
                current_price REAL NOT NULL,
                market_cap REAL,
                price_change_24h REAL,
                last_updated TEXT NOT NULL,
                ingested_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS forex (
                base_currency TEXT PRIMARY KEY,
                rates TEXT NOT NULL,
                date TEXT NOT NULL,
                last_updated TEXT NOT NULL,
                ingested_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
            CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(event_timestamp);
            CREATE INDEX IF NOT EXISTS idx_events_ingested ON events(ingested_at);

            CREATE TABLE IF NOT EXISTS webcams (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                platform TEXT NOT NULL,
                country TEXT,
                province TEXT,
                city TEXT,
                lat REAL,
                lng REAL,
                thumbnail_url TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                last_checked TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_webcams_country ON webcams(country);
            CREATE INDEX IF NOT EXISTS idx_webcams_active ON webcams(is_active);

            CREATE TABLE IF NOT EXISTS news (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                url TEXT NOT NULL,
                image_url TEXT,
                source_name TEXT NOT NULL,
                source_country TEXT,
                published_at TEXT NOT NULL,
                category TEXT,
                ingested_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_news_country ON news(source_country);
            CREATE INDEX IF NOT EXISTS idx_news_published ON news(published_at);

            CREATE TABLE IF NOT EXISTS radio_stations (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                frequency TEXT,
                description TEXT,
                url TEXT,
                stream_url TEXT,
                country TEXT,
                country_code TEXT,
                state TEXT,
                language TEXT,
                tags TEXT,
                codec TEXT,
                bitrate INTEGER,
                geo_lat REAL,
                geo_lng REAL,
                homepage TEXT,
                favicon TEXT,
                is_online INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_radio_country ON radio_stations(country);
            CREATE INDEX IF NOT EXISTS idx_radio_name ON radio_stations(name);
            CREATE INDEX IF NOT EXISTS idx_radio_online ON radio_stations(is_online);

            CREATE TABLE IF NOT EXISTS fires (
                id TEXT PRIMARY KEY,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                brightness REAL,
                frp REAL,
                confidence TEXT,
                satellite TEXT,
                acq_date TEXT,
                acq_time TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_fires_active ON fires(is_active);
            CREATE INDEX IF NOT EXISTS idx_fires_started ON fires(started_at);

            CREATE TABLE IF NOT EXISTS flights (
                id TEXT PRIMARY KEY,
                icao24 TEXT,
                callsign TEXT,
                origin_country TEXT,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                altitude REAL,
                speed REAL,
                heading REAL,
                is_active INTEGER NOT NULL DEFAULT 1,
                first_seen TEXT NOT NULL,
                last_seen TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_flights_active ON flights(is_active);
            CREATE INDEX IF NOT EXISTS idx_flights_lastseen ON flights(last_seen);

            CREATE TABLE IF NOT EXISTS weather_current (
                city TEXT PRIMARY KEY,
                country TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                temperature REAL,
                apparent_temperature REAL,
                humidity REAL,
                weather_code INTEGER,
                weather_description TEXT,
                weather_icon TEXT,
                wind_speed REAL,
                wind_gusts REAL,
                pressure REAL,
                severe INTEGER NOT NULL DEFAULT 0,
                forecast TEXT,
                recorded_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS weather_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                city TEXT NOT NULL,
                country TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                temperature REAL,
                apparent_temperature REAL,
                humidity REAL,
                weather_code INTEGER,
                weather_description TEXT,
                wind_speed REAL,
                wind_gusts REAL,
                pressure REAL,
                recorded_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_weather_city ON weather_history(city);
            CREATE INDEX IF NOT EXISTS idx_weather_recorded ON weather_history(recorded_at);
        """)
        await db.commit()

        now_literal = datetime.now(timezone.utc).isoformat()
        for table in ("events", "crypto", "forex", "news", "radio_stations"):
            for col in ("created_at", "updated_at"):
                try:
                    await db.execute(f"ALTER TABLE {table} ADD COLUMN {col} TEXT")
                    await db.execute(f"UPDATE {table} SET {col}=?", (now_literal,))
                except Exception:
                    pass
        await db.commit()
    finally:
        await db.close()


async def upsert_events(events: list[dict]):
    if not events:
        return
    db = await get_db()
    now = datetime.now(timezone.utc).isoformat()
    try:
        for e in events:
            loc = e.get("location") or {}
            await db.execute(
                """INSERT INTO events
                   (id, category, title, description, lat, lng, place,
                    magnitude, event_timestamp, source, source_url, severity, ingested_at,
                    created_at, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(id) DO UPDATE SET
                    title=excluded.title, description=excluded.description,
                    lat=excluded.lat, lng=excluded.lng, place=excluded.place,
                    magnitude=excluded.magnitude, event_timestamp=excluded.event_timestamp,
                    source=excluded.source, source_url=excluded.source_url,
                    severity=excluded.severity, ingested_at=excluded.ingested_at,
                    updated_at=excluded.updated_at""",
                (
                    e["id"], e["category"], e["title"], e.get("description"),
                    loc.get("lat"), loc.get("lng"), loc.get("place"),
                    e.get("magnitude"), str(e["timestamp"]),
                    e["source"], e.get("source_url"), e.get("severity"), now,
                    now, now,
                ),
            )
        await db.commit()
    finally:
        await db.close()


async def upsert_crypto(coins: list[dict]):
    if not coins:
        return
    db = await get_db()
    now = datetime.now(timezone.utc).isoformat()
    try:
        for c in coins:
            await db.execute(
                """INSERT INTO crypto
                   (id, name, symbol, current_price, market_cap, price_change_24h, last_updated, ingested_at,
                    created_at, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name, symbol=excluded.symbol,
                    current_price=excluded.current_price, market_cap=excluded.market_cap,
                    price_change_24h=excluded.price_change_24h, last_updated=excluded.last_updated,
                    ingested_at=excluded.ingested_at, updated_at=excluded.updated_at""",
                (
                    c["id"], c["name"], c["symbol"], c["current_price"],
                    c.get("market_cap"), c.get("price_change_24h"),
                    str(c["last_updated"]), now,
                    now, now,
                ),
            )
        await db.commit()
    finally:
        await db.close()


async def upsert_forex(data: dict):
    if not data:
        return
    db = await get_db()
    now = datetime.now(timezone.utc).isoformat()
    try:
        await db.execute(
            """INSERT INTO forex
               (base_currency, rates, date, last_updated, ingested_at, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?)
               ON CONFLICT(base_currency) DO UPDATE SET
                rates=excluded.rates, date=excluded.date,
                last_updated=excluded.last_updated, ingested_at=excluded.ingested_at,
                updated_at=excluded.updated_at""",
            (
                data["base"], json.dumps(data["rates"]),
                data["date"], str(data["last_updated"]), now,
                now, now,
            ),
        )
        await db.commit()
    finally:
        await db.close()


async def upsert_webcam(w: dict):
    db = await get_db()
    now = datetime.now(timezone.utc).isoformat()
    try:
        await db.execute(
            """INSERT INTO webcams
               (id, title, url, platform, country, province, city, lat, lng,
                thumbnail_url, is_active, last_checked, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT(id) DO UPDATE SET
                title=excluded.title, url=excluded.url, platform=excluded.platform,
                country=excluded.country, province=excluded.province, city=excluded.city,
                lat=excluded.lat, lng=excluded.lng, thumbnail_url=excluded.thumbnail_url,
                is_active=excluded.is_active, last_checked=excluded.last_checked,
                updated_at=excluded.updated_at""",
            (
                w["id"], w["title"], w["url"], w["platform"],
                w.get("country"), w.get("province"), w.get("city"),
                w.get("lat"), w.get("lng"), w.get("thumbnail_url"),
                w.get("is_active", 1), w.get("last_checked"),
                w.get("created_at", now), now,
            ),
        )
        await db.commit()
    finally:
        await db.close()


async def get_webcams(
    country: str | None = None,
    city: str | None = None,
    active_only: bool = True,
) -> list[dict]:
    db = await get_db()
    try:
        parts = ["SELECT * FROM webcams WHERE 1=1"]
        params = []
        if active_only:
            parts.append("AND is_active = 1")
        if country:
            parts.append("AND country = ?")
            params.append(country)
        if city:
            parts.append("AND city = ?")
            params.append(city)
        parts.append("ORDER BY country, city, title")
        cursor = await db.execute(" ".join(parts), params)
        rows = await cursor.fetchall()
        result = []
        for r in rows:
            result.append({
                "id": r["id"],
                "title": r["title"],
                "url": r["url"],
                "platform": r["platform"],
                "country": r["country"],
                "province": r["province"],
                "city": r["city"],
                "lat": r["lat"],
                "lng": r["lng"],
                "thumbnail_url": r["thumbnail_url"],
                "is_active": bool(r["is_active"]),
                "last_checked": r["last_checked"],
                "created_at": r["created_at"],
            })
        return result
    finally:
        await db.close()


async def get_webcam_countries() -> list[str]:
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT DISTINCT country FROM webcams WHERE is_active = 1 AND country IS NOT NULL ORDER BY country"
        )
        return [r["country"] for r in await cursor.fetchall()]
    finally:
        await db.close()


async def deactivate_webcam(webcam_id: str):
    db = await get_db()
    try:
        await db.execute(
            "UPDATE webcams SET is_active = 0, updated_at = ? WHERE id = ?",
            (datetime.now(timezone.utc).isoformat(), webcam_id),
        )
        await db.commit()
    finally:
        await db.close()


async def seed_radio_frequencies(stations: list[dict]):
    for s in stations:
        station_id = hashlib.md5(s["name"].encode()).hexdigest()[:16]
        entry = {
            "id": f"freq-{station_id}",
            "name": s["name"],
            "frequency": s.get("frequency"),
            "description": s.get("description"),
            "url": None,
            "stream_url": None,
            "country": s.get("country"),
            "country_code": None,
            "state": None,
            "language": None,
            "tags": None,
            "codec": None,
            "bitrate": None,
            "geo_lat": None,
            "geo_lng": None,
            "homepage": None,
            "favicon": None,
            "is_online": 1,
        }
        await upsert_radio_stations([entry])


async def seed_webcams(webcams: list[dict]):
    for w in webcams:
        exists = None
        db = await get_db()
        try:
            cursor = await db.execute("SELECT id FROM webcams WHERE id = ?", (w["id"],))
            exists = await cursor.fetchone()
        finally:
            await db.close()
        if not exists:
            now = datetime.now(timezone.utc).isoformat()
            w["created_at"] = now
            w["last_checked"] = now
            await upsert_webcam(w)


async def upsert_news(articles: list[dict]):
    if not articles:
        return
    db = await get_db()
    now = datetime.now(timezone.utc).isoformat()
    try:
        for a in articles:
            await db.execute(
                """INSERT INTO news
                   (id, title, description, url, image_url, source_name, source_country,
                    published_at, category, ingested_at, created_at, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(id) DO UPDATE SET
                    title=excluded.title, description=excluded.description,
                    url=excluded.url, image_url=excluded.image_url,
                    source_name=excluded.source_name, source_country=excluded.source_country,
                    published_at=excluded.published_at,
                    ingested_at=excluded.ingested_at, updated_at=excluded.updated_at""",
                (
                    a["id"], a["title"], a.get("description"), a["url"],
                    a.get("image_url"), a["source_name"], a.get("source_country"),
                    a["published_at"], a.get("category"), now,
                    now, now,
                ),
            )
        await db.commit()
    finally:
        await db.close()


async def get_unclassified_news(limit: int = 100) -> list[dict]:
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM news WHERE category IS NULL ORDER BY published_at DESC LIMIT ?",
            (limit,),
        )
        rows = await cursor.fetchall()
        return [{k: r[k] for k in r.keys()} for r in rows]
    finally:
        await db.close()


async def update_news_categories(classifications: dict[str, dict]):
    if not classifications:
        return
    db = await get_db()
    now = datetime.now(timezone.utc).isoformat()
    try:
        for article_id, data in classifications.items():
            cat = data["category"] if isinstance(data, dict) else data
            await db.execute(
                "UPDATE news SET category = ?, updated_at = ? WHERE id = ?",
                (cat, now, article_id),
            )
        await db.commit()
    finally:
        await db.close()


async def get_news(
    country: str | None = None,
    limit: int = 50,
    hours: int | None = None,
) -> list[dict]:
    db = await get_db()
    try:
        parts = ["SELECT * FROM news WHERE 1=1"]
        params = []
        if country:
            parts.append("AND source_country = ?")
            params.append(country)
        if hours:
            parts.append("AND published_at >= datetime('now', ?)")
            params.append(f"-{hours} hours")
        parts.append("ORDER BY published_at DESC LIMIT ?")
        params.append(limit)
        cursor = await db.execute(" ".join(parts), params)
        rows = await cursor.fetchall()
        result = []
        for r in rows:
            result.append({
                "id": r["id"],
                "title": r["title"],
                "description": r["description"],
                "url": r["url"],
                "image_url": r["image_url"],
                "source_name": r["source_name"],
                "source_country": r["source_country"],
                "published_at": r["published_at"],
                "category": r["category"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
            })
        return result
    finally:
        await db.close()


async def get_news_countries() -> list[str]:
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT DISTINCT source_country FROM news WHERE source_country IS NOT NULL ORDER BY source_country"
        )
        return [r["source_country"] for r in await cursor.fetchall()]
    finally:
        await db.close()


async def clean_old_news(hours: int = 48):
    db = await get_db()
    try:
        await db.execute(
            "DELETE FROM news WHERE ingested_at < datetime('now', ?)",
            (f"-{hours} hours",),
        )
        await db.commit()
    finally:
        await db.close()


async def clean_old_events(hours: int = 24):
    db = await get_db()
    try:
        cutoff = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "DELETE FROM events WHERE ingested_at < datetime('now', ?)",
            (f"-{hours} hours",),
        )
        await db.commit()
    finally:
        await db.close()


async def get_events_from_db(category: str | None = None, hours: int | None = None) -> list[dict]:
    db = await get_db()
    try:
        parts = ["SELECT * FROM events WHERE 1=1"]
        params = []
        if category:
            parts.append("AND category = ?")
            params.append(category)
        if hours:
            parts.append("AND event_timestamp >= datetime('now', ?)")
            params.append(f"-{hours} hours")
        parts.append("ORDER BY event_timestamp DESC LIMIT 100")
        cursor = await db.execute(" ".join(parts), params)
        rows = await cursor.fetchall()
        result = []
        for r in rows:
            result.append({
                "id": r["id"],
                "category": r["category"],
                "title": r["title"],
                "description": r["description"],
                "location": {"lat": r["lat"], "lng": r["lng"], "place": r["place"]},
                "magnitude": r["magnitude"],
                "timestamp": r["event_timestamp"],
                "source": r["source"],
                "source_url": r["source_url"],
                "severity": r["severity"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
            })
        return result
    finally:
        await db.close()


async def get_crypto_from_db() -> list[dict]:
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM crypto ORDER BY market_cap DESC LIMIT 50"
        )
        rows = await cursor.fetchall()
        result = []
        for r in rows:
            result.append({
                "id": r["id"],
                "name": r["name"],
                "symbol": r["symbol"],
                "current_price": r["current_price"],
                "market_cap": r["market_cap"],
                "price_change_24h": r["price_change_24h"],
                "last_updated": r["last_updated"],
            })
        return result
    finally:
        await db.close()


async def upsert_radio_stations(stations: list[dict]):
    if not stations:
        return
    db = await get_db()
    now = datetime.now(timezone.utc).isoformat()
    try:
        for s in stations:
            await db.execute(
                """INSERT INTO radio_stations
                   (id, name, frequency, description, url, stream_url,
                    country, country_code, state, language, tags,
                    codec, bitrate, geo_lat, geo_lng, homepage, favicon,
                    is_online, created_at, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name, frequency=excluded.frequency,
                    description=excluded.description, url=excluded.url,
                    stream_url=excluded.stream_url, country=excluded.country,
                    country_code=excluded.country_code, state=excluded.state,
                    language=excluded.language, tags=excluded.tags,
                    codec=excluded.codec, bitrate=excluded.bitrate,
                    geo_lat=excluded.geo_lat, geo_lng=excluded.geo_lng,
                    homepage=excluded.homepage, favicon=excluded.favicon,
                    is_online=excluded.is_online, updated_at=excluded.updated_at""",
                (
                    s["id"], s["name"], s.get("frequency"), s.get("description"),
                    s.get("url"), s.get("stream_url"),
                    s.get("country"), s.get("country_code"), s.get("state"),
                    s.get("language"), s.get("tags"), s.get("codec"),
                    s.get("bitrate"), s.get("geo_lat"), s.get("geo_lng"),
                    s.get("homepage"), s.get("favicon"),
                    s.get("is_online", 1), now, now,
                ),
            )
        await db.commit()
    finally:
        await db.close()


async def get_radio_stations(
    country: str | None = None,
    limit: int = 200,
    online_only: bool = True,
) -> list[dict]:
    db = await get_db()
    try:
        parts = ["SELECT * FROM radio_stations WHERE 1=1"]
        params = []
        if online_only:
            parts.append("AND is_online = 1")
        if country:
            parts.append("AND country = ?")
            params.append(country)
        parts.append("ORDER BY name ASC LIMIT ?")
        params.append(limit)
        cursor = await db.execute(" ".join(parts), params)
        rows = await cursor.fetchall()
        result = []
        for r in rows:
            result.append({k: r[k] for k in r.keys()})
        return result
    finally:
        await db.close()


async def get_radio_countries() -> list[str]:
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT DISTINCT country FROM radio_stations WHERE country IS NOT NULL ORDER BY country"
        )
        return [r["country"] for r in await cursor.fetchall()]
    finally:
        await db.close()


async def get_forex_from_db() -> dict | None:
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM forex ORDER BY ingested_at DESC LIMIT 1"
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return {
            "base": row["base_currency"],
            "rates": json.loads(row["rates"]),
            "date": row["date"],
            "last_updated": row["last_updated"],
        }
    finally:
        await db.close()


async def upsert_fires(fires: list[dict]):
    if not fires:
        return
    db = await get_db()
    now = datetime.now(timezone.utc).isoformat()
    try:
        for f in fires:
            await db.execute(
                """INSERT INTO fires
                   (id, lat, lng, brightness, frp, confidence, satellite,
                    acq_date, acq_time, is_active, started_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                    lat=excluded.lat, lng=excluded.lng,
                    brightness=excluded.brightness, frp=excluded.frp,
                    confidence=excluded.confidence, satellite=excluded.satellite,
                    acq_date=excluded.acq_date, acq_time=excluded.acq_time,
                    is_active=1, ended_at=NULL, updated_at=excluded.updated_at""",
                (f["id"], f["lat"], f["lng"], f.get("brightness"), f.get("frp"),
                 f.get("confidence"), f.get("satellite"), f.get("acq_date"),
                 f.get("acq_time"), now, now),
            )
        await db.commit()
    finally:
        await db.close()


async def deactivate_old_fires(active_ids: set[str]):
    db = await get_db()
    now = datetime.now(timezone.utc).isoformat()
    try:
        await db.execute(
            "UPDATE fires SET is_active=0, ended_at=?, updated_at=? WHERE is_active=1 AND id NOT IN ({})".format(
                ",".join("?" for _ in active_ids) if active_ids else "''"
            ),
            [now, now] + (list(active_ids) if active_ids else []),
        )
        await db.commit()
    finally:
        await db.close()


async def get_fires_from_db(active_only: bool = True) -> list[dict]:
    db = await get_db()
    try:
        if active_only:
            cursor = await db.execute(
                "SELECT * FROM fires WHERE is_active=1 ORDER BY started_at DESC"
            )
        else:
            cursor = await db.execute(
                "SELECT * FROM fires ORDER BY started_at DESC LIMIT 1000"
            )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


async def upsert_flights(flights: list[dict]):
    if not flights:
        return
    db = await get_db()
    now = datetime.now(timezone.utc).isoformat()
    try:
        for f in flights:
            await db.execute(
                """INSERT INTO flights
                   (id, icao24, callsign, origin_country, lat, lng,
                    altitude, speed, heading, is_active, first_seen, last_seen, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                    lat=excluded.lat, lng=excluded.lng,
                    altitude=excluded.altitude, speed=excluded.speed,
                    heading=excluded.heading, is_active=1,
                    last_seen=excluded.last_seen, updated_at=excluded.updated_at""",
                (f["id"], f.get("icao24"), f.get("callsign"), f.get("origin_country"),
                 f["lat"], f["lng"], f.get("altitude"), f.get("speed"),
                 f.get("heading"), now, now, now),
            )
        await db.commit()
    finally:
        await db.close()


async def deactivate_old_flights(active_ids: set[str]):
    db = await get_db()
    now = datetime.now(timezone.utc).isoformat()
    try:
        await db.execute(
            "UPDATE flights SET is_active=0, updated_at=? WHERE is_active=1 AND id NOT IN ({})".format(
                ",".join("?" for _ in active_ids) if active_ids else "''"
            ),
            [now] + (list(active_ids) if active_ids else []),
        )
        await db.commit()
    finally:
        await db.close()


async def get_flights_from_db(active_only: bool = True, limit: int = 500) -> list[dict]:
    db = await get_db()
    try:
        if active_only:
            cursor = await db.execute(
                "SELECT * FROM flights WHERE is_active=1 ORDER BY last_seen DESC LIMIT ?",
                (limit,),
            )
        else:
            cursor = await db.execute(
                "SELECT * FROM flights ORDER BY last_seen DESC LIMIT ?", (limit,)
            )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


async def upsert_weather_current(entries: list[dict]):
    if not entries:
        return
    db = await get_db()
    now = datetime.now(timezone.utc).isoformat()
    try:
        for e in entries:
            await db.execute(
                """INSERT INTO weather_current
                   (city, country, lat, lng, temperature, apparent_temperature,
                    humidity, weather_code, weather_description, weather_icon,
                    wind_speed, wind_gusts, pressure, severe, forecast, recorded_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(city) DO UPDATE SET
                    temperature=excluded.temperature,
                    apparent_temperature=excluded.apparent_temperature,
                    humidity=excluded.humidity,
                    weather_code=excluded.weather_code,
                    weather_description=excluded.weather_description,
                    weather_icon=excluded.weather_icon,
                    wind_speed=excluded.wind_speed,
                    wind_gusts=excluded.wind_gusts,
                    pressure=excluded.pressure,
                    severe=excluded.severe,
                    forecast=excluded.forecast,
                    recorded_at=excluded.recorded_at,
                    updated_at=excluded.updated_at""",
                (e["city"], e["country"], e["lat"], e["lng"],
                 e.get("temperature"), e.get("apparent_temperature"),
                 e.get("humidity"), e.get("weather_code"),
                 e.get("weather_description"), e.get("weather_icon"),
                 e.get("wind_speed"), e.get("wind_gusts"),
                 e.get("pressure"), 1 if e.get("severe") else 0,
                 json.dumps(e.get("forecast", [])),
                 e.get("timestamp", now), now),
            )

            await db.execute(
                """INSERT INTO weather_history
                   (city, country, lat, lng, temperature, apparent_temperature,
                    humidity, weather_code, weather_description,
                    wind_speed, wind_gusts, pressure, recorded_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (e["city"], e["country"], e["lat"], e["lng"],
                 e.get("temperature"), e.get("apparent_temperature"),
                 e.get("humidity"), e.get("weather_code"),
                 e.get("weather_description"),
                 e.get("wind_speed"), e.get("wind_gusts"),
                 e.get("pressure"), e.get("timestamp", now)),
            )
        await db.commit()
    finally:
        await db.close()


async def get_weather_from_db() -> list[dict]:
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM weather_current ORDER BY city")
        rows = await cursor.fetchall()
        result = []
        for r in rows:
            d = dict(r)
            if d.get("forecast"):
                try:
                    d["forecast"] = json.loads(d["forecast"])
                except (json.JSONDecodeError, TypeError):
                    d["forecast"] = []
            result.append(d)
        return result
    finally:
        await db.close()
