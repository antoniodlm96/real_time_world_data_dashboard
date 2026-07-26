from fastapi import APIRouter

from backend.app.sources.fires import fetch_fires

router = APIRouter(prefix="/fires", tags=["fires"])


@router.get("")
async def list_fires():
    data = await fetch_fires()
    return {"fires": data, "count": len(data)}
