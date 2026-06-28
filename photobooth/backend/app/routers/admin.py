"""Administrator endpoints — require the ``admin`` role (RBAC enforced)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import AuditLog, Scene
from ..security import Principal, require_role

router = APIRouter(prefix="/admin", tags=["Admin"])


class SceneCreate(BaseModel):
    name: str
    category_id: str | None = None
    is_360: bool = False
    is_symbolic_restricted: bool = False


@router.get("/scenes")
async def admin_list_scenes(
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_role("admin")),
):
    rows = (await db.scalars(select(Scene))).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "is_360": s.is_360,
            "is_symbolic_restricted": s.is_symbolic_restricted,
            "is_active": s.is_active,
        }
        for s in rows
    ]


@router.post("/scenes", status_code=201)
async def admin_create_scene(
    body: SceneCreate,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_role("admin")),
):
    scene = Scene(
        name=body.name,
        category_id=body.category_id,
        is_360=body.is_360,
        is_symbolic_restricted=body.is_symbolic_restricted,
    )
    db.add(scene)
    await db.flush()
    db.add(AuditLog(actor_id=None, action="scene.create", entity="scene",
                    entity_id=scene.id, extra={"by": principal.subject, "name": body.name}))
    await db.commit()
    return {"id": scene.id, "name": scene.name}


@router.get("/audit")
async def admin_audit(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_role("admin")),
):
    rows = (
        await db.scalars(
            select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
        )
    ).all()
    return [
        {
            "action": a.action,
            "entity": a.entity,
            "entity_id": a.entity_id,
            "metadata": a.extra,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in rows
    ]
