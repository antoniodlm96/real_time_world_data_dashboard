from fastapi import APIRouter

from backend.app.sources.flights import fetch_flights

router = APIRouter(prefix="/flights", tags=["flights"])


@router.get("")
async def list_flights():
    data = await fetch_flights()
    return {"flights": data, "count": len(data)}
