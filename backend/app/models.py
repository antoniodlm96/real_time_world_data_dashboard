from datetime import datetime
from pydantic import BaseModel


class EventLocation(BaseModel):
    lat: float
    lng: float
    place: str | None = None


class UnifiedEvent(BaseModel):
    id: str
    category: str
    title: str
    description: str | None = None
    location: EventLocation | None = None
    magnitude: float | None = None
    timestamp: datetime
    source: str
    source_url: str | None = None
    severity: str | None = None


class CryptoEntry(BaseModel):
    id: str
    name: str
    symbol: str
    current_price: float
    market_cap: float | None = None
    price_change_24h: float | None = None
    last_updated: datetime


class ForexEntry(BaseModel):
    base: str
    rates: dict[str, float]
    date: str
    last_updated: datetime


class MarketData(BaseModel):
    crypto: list[CryptoEntry]
    forex: ForexEntry | None = None
    last_updated: datetime
