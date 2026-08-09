from fastapi import APIRouter, Query

from backend.app.services.cascade import get_cascades

router = APIRouter(prefix="/cascades", tags=["cascades"])


@router.get("")
async def list_cascades(hours: int = Query(24, ge=1, le=72)):
    data = await get_cascades(hours)
    return {"cascades": data, "count": len(data)}
