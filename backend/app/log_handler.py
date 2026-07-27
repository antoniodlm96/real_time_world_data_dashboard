import logging
from collections import deque
from datetime import datetime, timezone

INTEGRATION_LOGGERS = {"ingest", "bluesky", "fires", "flights", "weather", "commodities", "gdacs"}


class LogBufferHandler(logging.Handler):
    def __init__(self, maxlen: int = 500):
        super().__init__()
        self.buffer: deque[dict] = deque(maxlen=maxlen)

    def emit(self, record: logging.LogRecord):
        try:
            self.buffer.append({
                "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
                "level": record.levelname,
                "logger": record.name,
                "message": self.format(record),
            })
        except Exception:
            self.handleError(record)


_handler: LogBufferHandler | None = None


def get_log_handler() -> LogBufferHandler:
    global _handler
    if _handler is None:
        _handler = LogBufferHandler()
        _handler.setFormatter(logging.Formatter("%(message)s"))
    return _handler


def get_logs(category: str = "all", limit: int = 100) -> list[dict]:
    h = get_log_handler()
    logs = list(h.buffer)
    if category == "integration":
        logs = [r for r in logs if r["logger"] in INTEGRATION_LOGGERS]
    elif category == "trace":
        logs = [r for r in logs if r["logger"] not in INTEGRATION_LOGGERS]
    return logs[-limit:]
