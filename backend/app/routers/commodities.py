from fastapi import APIRouter

from backend.app.sources.commodities import fetch_commodities

router = APIRouter(prefix="/markets", tags=["markets"])


@router.get("/commodities")
async def get_commodities():
    data = await fetch_commodities()
    return {"commodities": data, "count": len(data)}
