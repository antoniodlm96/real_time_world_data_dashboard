from fastapi import APIRouter

from backend.app.sources.infrastructure import INFRASTRUCTURE

router = APIRouter(prefix="/infrastructure", tags=["infrastructure"])


@router.get("")
async def list_infrastructure():
    return {"items": INFRASTRUCTURE, "count": len(INFRASTRUCTURE)}
