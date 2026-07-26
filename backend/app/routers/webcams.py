from fastapi import APIRouter, HTTPException

from backend.app.database import (
    get_webcams,
    get_webcam_countries,
    deactivate_webcam,
    upsert_webcam,
)

router = APIRouter(prefix="/webcams", tags=["webcams"])


@router.get("")
async def list_webcams(
    country: str | None = None,
    city: str | None = None,
    active_only: bool = True,
):
    data = await get_webcams(country, city, active_only)
    return {"webcams": data, "count": len(data)}


@router.get("/countries")
async def list_countries():
    data = await get_webcam_countries()
    return {"countries": data}


@router.post("")
async def add_webcam(w: dict):
    from datetime import datetime, timezone
    w["id"] = w.get("id", w["url"])
    w["created_at"] = datetime.now(timezone.utc).isoformat()
    w["last_checked"] = w["created_at"]
    w["is_active"] = 1
    await upsert_webcam(w)
    return {"status": "ok", "id": w["id"]}


@router.patch("/{webcam_id}/deactivate")
async def remove_webcam(webcam_id: str):
    await deactivate_webcam(webcam_id)
    return {"status": "ok", "id": webcam_id}
