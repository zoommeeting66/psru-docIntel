from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_db
from ..models import Download, Feedback, Output
from ..schemas import FeedbackCreate, OutputOut, ShareOut
from .. import branding, storage

router = APIRouter(tags=["Outputs"])
settings = get_settings()


def _out(o: Output) -> OutputOut:
    return OutputOut(
        id=o.id,
        image_no=o.image_no,
        final_url=storage.url_for(o.final_key),
        thumb_url=storage.url_for(o.thumb_key),
        formats=o.formats or {},
        expires_at=o.expires_at,
    )


@router.get("/outputs/{output_id}", response_model=OutputOut)
async def get_output(output_id: str, db: AsyncSession = Depends(get_db)):
    o = await db.get(Output, output_id)
    if not o:
        raise HTTPException(404, "output_not_found")
    return _out(o)


@router.get("/outputs/{output_id}/download")
async def download_output(
    output_id: str, request: Request, fmt: str = "png", db: AsyncSession = Depends(get_db)
):
    o = await db.get(Output, output_id)
    if not o:
        raise HTTPException(404, "output_not_found")
    key = (o.formats or {}).get(fmt) or o.final_key
    db.add(Download(output_id=o.id, format=fmt, channel="direct",
                    ip_address=request.client.host if request.client else None))
    await db.commit()
    url = storage.url_for(key)
    return RedirectResponse(url, status_code=302)


@router.post("/outputs/{output_id}/share", response_model=ShareOut, status_code=201)
async def share_output(output_id: str, db: AsyncSession = Depends(get_db)):
    o = await db.get(Output, output_id)
    if not o:
        raise HTTPException(404, "output_not_found")
    base = settings.public_base_url.rstrip("/")
    share_url = f"{base}/s/{o.share_token}"
    return ShareOut(
        share_token=o.share_token,
        share_url=share_url,
        qr_url=f"{base}/api/v1/outputs/{output_id}/qr",
        expires_at=o.expires_at,
    )


@router.get("/outputs/{output_id}/qr")
async def output_qr(output_id: str, db: AsyncSession = Depends(get_db)):
    o = await db.get(Output, output_id)
    if not o:
        raise HTTPException(404, "output_not_found")
    share_url = f"{settings.public_base_url.rstrip('/')}/s/{o.share_token}"
    return Response(content=branding.make_qr(share_url), media_type="image/png")


@router.post("/outputs/{output_id}/feedback", status_code=201)
async def add_feedback(
    output_id: str, body: FeedbackCreate, db: AsyncSession = Depends(get_db)
):
    o = await db.get(Output, output_id)
    if not o:
        raise HTTPException(404, "output_not_found")
    db.add(Feedback(output_id=output_id, rating=body.rating, comment=body.comment))
    await db.commit()
    return {"ok": True}
