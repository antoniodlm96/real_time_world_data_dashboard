from fastapi import APIRouter, Query

from backend.app.sources.polymarket import get_prediction_markets

router = APIRouter(prefix="/prediction", tags=["prediction"])


@router.get("/markets")
async def list_prediction_markets(limit: int = Query(30, ge=1, le=100)):
    data = await get_prediction_markets(limit)
    return {"markets": data, "count": len(data)}
