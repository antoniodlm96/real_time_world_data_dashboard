from fastapi import APIRouter

from backend.app.database import get_events_from_db

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/disasters")
async def get_disasters(hours: int = 24):
    data = await get_events_from_db("disaster", hours)
    return {"events": data, "count": len(data)}


@router.get("/conflicts")
async def get_conflicts(hours: int = 24):
    data = await get_events_from_db("conflict", hours)
    return {"events": data, "count": len(data)}


@router.get("/cyber")
async def get_cyber(hours: int = 24):
    data = await get_events_from_db("cyber", hours)
    return {"events": data, "count": len(data)}
