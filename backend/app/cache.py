import json
from datetime import datetime, timezone

import redis.asyncio as aioredis

from backend.app.config import settings


class Cache:
    def __init__(self):
        self._client: aioredis.Redis | None = None

    async def connect(self):
        if self._client is None:
            try:
                self._client = await aioredis.from_url(
                    settings.redis_url, decode_responses=True
                )
                await self._client.ping()
            except Exception:
                self._client = None

    async def disconnect(self):
        if self._client:
            await self._client.close()
            self._client = None

    async def get(self, key: str) -> dict | None:
        if not self._client:
            return None
        data = await self._client.get(key)
        if data is None:
            return None
        try:
            return json.loads(data)
        except (json.JSONDecodeError, TypeError):
            return None

    async def set(self, key: str, value: dict, ttl: int) -> None:
        if not self._client:
            return
        await self._client.setex(key, ttl, json.dumps(value, default=str))

    async def get_or_fetch(
        self, key: str, ttl: int, fetcher
    ) -> dict:
        cached = await self.get(key)
        if cached is not None:
            return cached
        data = await fetcher()
        if data is not None:
            await self.set(key, data, ttl)
        return data or self._fallback(key)

    def _fallback(self, key: str) -> dict:
        return {"data": [], "source": "fallback", "fallback": True}


cache = Cache()
