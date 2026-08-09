import time
from datetime import datetime, timezone

from backend.app.cache import cache

HEALTH_KEY = "seed-meta:source-health"
DEFAULT_MAX_STALE_MIN = 30

_health: dict[str, dict] = {}


def _iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def _now() -> float:
    return time.time()


async def record_source(name: str, ok: bool, max_stale_min: int = DEFAULT_MAX_STALE_MIN, source_version: str = "1") -> None:
    now = _now()
    entry = _health.setdefault(name, {"success": 0, "failures": 0})
    entry["name"] = name
    entry["max_stale_min"] = max_stale_min
    entry["source_version"] = source_version
    if ok:
        entry["last_success"] = now
        entry["last_success_iso"] = _iso(now)
        entry["success"] += 1
    else:
        entry["last_failure"] = now
        entry["last_failure_iso"] = _iso(now)
        entry["failures"] += 1
    entry["last_attempt"] = now
    entry["last_attempt_iso"] = _iso(now)
    entry["stale"] = now - entry.get("last_success", now) > max_stale_min * 60
    entry["status"] = "ok" if not entry["stale"] else "stale"
    await cache.set(f"{HEALTH_KEY}:{name}", entry, 86400)


async def get_source_health() -> list[dict]:
    snapshot = []
    for name, entry in _health.items():
        now = _now()
        last_success = entry.get("last_success")
        if last_success is not None:
            age_min = round((now - last_success) / 60, 1)
        else:
            age_min = None
        snapshot.append({
            "name": name,
            "status": entry.get("status", "unknown"),
            "last_success": entry.get("last_success_iso"),
            "last_failure": entry.get("last_failure_iso"),
            "last_attempt": entry.get("last_attempt_iso"),
            "age_min": age_min,
            "max_stale_min": entry.get("max_stale_min", DEFAULT_MAX_STALE_MIN),
            "source_version": entry.get("source_version", "1"),
            "success_count": entry.get("success", 0),
            "failure_count": entry.get("failures", 0),
        })
    return sorted(snapshot, key=lambda s: s["status"] != "ok")
