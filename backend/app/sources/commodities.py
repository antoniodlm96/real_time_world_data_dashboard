import logging

import pandas as pd
import yfinance as yf

logger = logging.getLogger("commodities")

SYMBOLS = {
    "BZ=F": "Brent Crude Oil",
    "GC=F": "Gold",
    "NG=F": "Natural Gas",
}


async def fetch_commodities() -> list[dict]:
    results = []
    for symbol, name in SYMBOLS.items():
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="1mo")
            info = ticker.info if hasattr(ticker, "info") else {}
        except Exception as e:
            logger.warning("yfinance (%s) failed: %s", symbol, e)
            continue

        if hist.empty:
            logger.warning("yfinance (%s): no history", symbol)
            continue

        latest = hist.iloc[-1]
        prev = hist.iloc[-2] if len(hist) >= 2 else latest
        current_price = float(latest["Close"])
        prev_close = float(prev["Close"])
        change = round(current_price - prev_close, 2)
        change_pct = round((current_price - prev_close) / prev_close * 100, 2) if prev_close else None

        series = []
        for ts, row in hist.iterrows():
            series.append({
                "time": int(ts.timestamp()),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]) if not pd.isna(row["Volume"]) else 0,
            })

        results.append({
            "symbol": symbol,
            "name": name,
            "current_price": current_price,
            "previous_close": prev_close,
            "change": change,
            "change_pct": change_pct,
            "currency": info.get("currency", "USD"),
            "series": series,
        })

    logger.info("Commodities: %d symbols fetched", len(results))
    return results
