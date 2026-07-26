from fastapi import APIRouter

from backend.app.database import get_fires_from_db

router = APIRouter(prefix="/fires", tags=["fires"])


@router.get("")
async def list_fires():
    data = await get_fires_from_db(active_only=True)
    return {"fires": data, "count": len(data)}
