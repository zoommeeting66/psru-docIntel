from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Outfit, Scene
from ..schemas import OutfitOut, SceneOut
from .. import storage

router = APIRouter(tags=["Scenes"])


def _scene_out(s: Scene) -> SceneOut:
    return SceneOut(
        id=s.id,
        name=s.name,
        category=s.category.name if s.category else None,
        thumbnail_url=storage.url_for(s.thumbnail_key),
        is_360=s.is_360,
        is_symbolic_restricted=s.is_symbolic_restricted,
    )


@router.get("/scenes", response_model=list[SceneOut])
async def list_scenes(
    category: Optional[str] = None,
    is_360: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Scene).where(Scene.is_active.is_(True))
    if is_360 is not None:
        stmt = stmt.where(Scene.is_360.is_(is_360))
    rows = (await db.scalars(stmt)).all()
    out = [_scene_out(s) for s in rows]
    if category:
        out = [s for s in out if s.category == category]
    return out


@router.get("/scenes/{scene_id}", response_model=SceneOut)
async def get_scene(scene_id: str, db: AsyncSession = Depends(get_db)):
    s = await db.get(Scene, scene_id)
    if not s or not s.is_active:
        raise HTTPException(404, "scene_not_found")
    return _scene_out(s)


@router.get("/outfits", response_model=list[OutfitOut])
async def list_outfits(db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(select(Outfit).where(Outfit.is_active.is_(True)))).all()
    return rows
