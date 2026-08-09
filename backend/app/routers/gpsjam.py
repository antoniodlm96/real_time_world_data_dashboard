from fastapi import APIRouter

from backend.app.sources.gpsjam import get_gpsjam_hexes

router = APIRouter(prefix="/gpsjam", tags=["gpsjam"])


@router.get("")
async def list_gpsjam():
    data = await get_gpsjam_hexes()
    return {"hexes": data, "count": len(data)}
