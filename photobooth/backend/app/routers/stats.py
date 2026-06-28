from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Download, Feedback, Output, RenderJob, Session
from ..schemas import StatsOverview

router = APIRouter(tags=["Stats"])


@router.get("/stats/overview", response_model=StatsOverview)
async def overview(db: AsyncSession = Depends(get_db)):
    sessions_total = await db.scalar(select(func.count()).select_from(Session)) or 0
    images_total = await db.scalar(select(func.count()).select_from(Output)) or 0
    downloads_total = await db.scalar(select(func.count()).select_from(Download)) or 0
    avg_rating = await db.scalar(select(func.avg(Feedback.rating))) or 0.0
    avg_render = await db.scalar(
        select(func.avg(RenderJob.duration_ms)).where(RenderJob.status == "succeeded")
    ) or 0
    return StatsOverview(
        sessions_total=int(sessions_total),
        images_total=int(images_total),
        downloads_total=int(downloads_total),
        avg_rating=round(float(avg_rating), 2),
        avg_render_ms=int(avg_render),
    )


@router.get("/stats/scenes")
async def popular_scenes(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(RenderJob.scene_id, func.count().label("n"))
        .where(RenderJob.status == "succeeded")
        .group_by(RenderJob.scene_id)
        .order_by(func.count().desc())
        .limit(10)
    )
    rows = (await db.execute(stmt)).all()
    return [{"scene_id": r[0], "count": r[1]} for r in rows]
