from fastapi import APIRouter

from backend.app.database import get_radio_stations, get_radio_countries

router = APIRouter(prefix="/radio", tags=["radio"])


@router.get("")
async def list_radio(country: str | None = None, limit: int = 200):
    data = await get_radio_stations(country, limit)
    return {"stations": data, "count": len(data)}


@router.get("/countries")
async def list_countries():
    data = await get_radio_countries()
    return {"countries": data}
