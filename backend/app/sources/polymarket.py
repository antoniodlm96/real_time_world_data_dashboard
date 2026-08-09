import json
import logging

import httpx

from backend.app.cache import cache
from backend.app.config import settings

logger = logging.getLogger("polymarket")

GAMMA_URL = "https://gamma-api.polymarket.com/markets"
UA = "Mozilla/5.0 (compatible; WorldDataDashboard/1.0)"


def _parse_json_field(value) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return []


async def fetch_prediction_markets(limit: int = 30) -> list[dict]:
    params = {
        "active": "true",
        "closed": "false",
        "order": "volume24hr",
        "ascending": "false",
        "limit": limit,
    }
    try:
        async with httpx.AsyncClient(timeout=20, headers={"User-Agent": UA}) as client:
            resp = await client.get(GAMMA_URL, params=params)
            resp.raise_for_status()
            raw = resp.json()
    except Exception as e:
        logger.warning("polymarket fetch failed: %s", e)
        return []

    markets = []
    for m in raw:
        if not isinstance(m, dict):
            continue
        outcomes = _parse_json_field(m.get("outcomes"))
        prices = _parse_json_field(m.get("outcomePrices"))
        volume = m.get("volume24hr")
        try:
            volume = float(volume) if volume is not None else 0.0
        except (TypeError, ValueError):
            volume = 0.0
        outcome_data = []
        for i, name in enumerate(outcomes):
            price = None
            if i < len(prices):
                try:
                    price = round(float(prices[i]) * 100, 1)
                except (TypeError, ValueError):
                    price = None
            outcome_data.append({"name": name, "price": price})

        markets.append({
            "id": m.get("id"),
            "condition_id": m.get("conditionId"),
            "question": m.get("question"),
            "slug": m.get("slug"),
            "outcomes": outcome_data,
            "volume24hr": volume,
            "end_date": m.get("endDate"),
            "last_trade_price": m.get("lastTradePrice"),
            "category": m.get("category", ""),
            "url": f"https://polymarket.com/event/{m.get('slug', '')}" if m.get("slug") else None,
        })

    markets.sort(key=lambda x: x["volume24hr"], reverse=True)
    return markets


async def get_prediction_markets(limit: int = 30) -> list[dict]:
    return await cache.get_or_fetch(
        f"polymarket:markets:{limit}",
        settings.cache_ttl_crypto,
        lambda: fetch_prediction_markets(limit),
    )
