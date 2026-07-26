import httpx
from datetime import datetime, timezone

from backend.app.config import settings


async def fetch_forex() -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(settings.frankfurter_url)
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, httpx.TimeoutException, ValueError):
        return _fallback_forex()

    now = datetime.now(timezone.utc)
    return {
        "base": data.get("base", "EUR"),
        "rates": data.get("rates", {}),
        "date": data.get("date", now.strftime("%Y-%m-%d")),
        "last_updated": now.isoformat(),
    }


def _fallback_forex() -> dict:
    return {
        "base": "EUR",
        "rates": {"USD": 1.08, "GBP": 0.86, "JPY": 162.5, "CHF": 0.94},
        "date": "2025-01-01",
        "last_updated": "2025-01-01T00:00:00Z",
    }
