from fastapi import APIRouter

from backend.app.database import get_news, get_news_countries

router = APIRouter(prefix="/news", tags=["news"])


@router.get("")
async def list_news(country: str | None = None, limit: int = 50, hours: int = 24):
    data = await get_news(country, limit, hours)
    return {"news": data, "count": len(data)}


@router.get("/countries")
async def list_countries():
    data = await get_news_countries()
    return {"countries": data}
