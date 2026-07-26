from fastapi import APIRouter

from backend.app.database import get_crypto_from_db, get_forex_from_db

router = APIRouter(prefix="/markets", tags=["markets"])


@router.get("/crypto")
async def get_crypto():
    data = await get_crypto_from_db()
    return {"crypto": data, "count": len(data)}


@router.get("/forex")
async def get_forex():
    data = await get_forex_from_db()
    return {"forex": data}
