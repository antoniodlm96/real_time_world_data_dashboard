import httpx
from datetime import datetime, timezone

from backend.app.config import settings


TOP_COINS = [
    "bitcoin", "ethereum", "tether", "ripple", "solana",
    "binancecoin", "dogecoin", "usd-coin", "cardano", "staked-ether",
]


async def fetch_crypto() -> list[dict]:
    params = {
        "ids": ",".join(TOP_COINS),
        "vs_currency": "usd",
        "order": "market_cap_desc",
        "per_page": 50,
        "page": 1,
        "sparkline": "false",
        "price_change_percentage": "24h",
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{settings.coingecko_url}/coins/markets", params=params
            )
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, httpx.TimeoutException, ValueError):
        return _fallback_crypto()

    result = []
    now = datetime.now(timezone.utc)
    for coin in data:
        result.append({
            "id": coin.get("id", "unknown"),
            "name": coin.get("name", "Unknown"),
            "symbol": coin.get("symbol", "?").upper(),
            "current_price": coin.get("current_price", 0),
            "market_cap": coin.get("market_cap"),
            "price_change_24h": coin.get("price_change_percentage_24h"),
            "last_updated": coin.get("last_updated", now.isoformat()),
        })
    return result


def _fallback_crypto() -> list[dict]:
    return [
        {"id": "bitcoin", "name": "Bitcoin", "symbol": "BTC",
         "current_price": 67500, "market_cap": 1320000000000,
         "price_change_24h": 2.5, "last_updated": "2025-01-01T00:00:00Z"},
        {"id": "ethereum", "name": "Ethereum", "symbol": "ETH",
         "current_price": 3400, "market_cap": 410000000000,
         "price_change_24h": 1.8, "last_updated": "2025-01-01T00:00:00Z"},
    ]
