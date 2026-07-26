from fastapi import APIRouter

from backend.app.database import get_weather_from_db

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("")
async def get_weather():
    data = await get_weather_from_db()
    return {"weather": data, "count": len(data)}
