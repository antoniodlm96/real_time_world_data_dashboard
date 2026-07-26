from fastapi import APIRouter

from backend.app.database import get_flights_from_db

router = APIRouter(prefix="/flights", tags=["flights"])


@router.get("")
async def list_flights():
    data = await get_flights_from_db(active_only=True)
    return {"flights": data, "count": len(data)}
