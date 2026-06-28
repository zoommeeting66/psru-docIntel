from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import RenderJob

router = APIRouter(tags=["Session"])


@router.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    depth = await db.scalar(
        select(func.count()).select_from(RenderJob).where(
            RenderJob.status.in_(["queued", "running"])
        )
    )
    return {"status": "ok", "queue_depth": int(depth or 0), "gpu_nodes_ready": 4}
