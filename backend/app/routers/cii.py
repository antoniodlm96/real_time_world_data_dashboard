from fastapi import APIRouter, Query

from backend.app.services.cii import get_cii_scores

router = APIRouter(prefix="/cii", tags=["cii"])


@router.get("")
async def list_cii(hours: int = Query(48, ge=1, le=168)):
    data = await get_cii_scores(hours)
    return {"scores": data, "count": len(data)}
