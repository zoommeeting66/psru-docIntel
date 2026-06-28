from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Capture, Consent, Output, RenderJob, Scene
from ..pipeline import check_guardrails, GuardrailError, run_render_job
from ..schemas import JobCreate, JobOut

router = APIRouter(tags=["Jobs"])


@router.post("/jobs", response_model=JobOut, status_code=202)
async def create_job(
    body: JobCreate, bg: BackgroundTasks, db: AsyncSession = Depends(get_db)
):
    capture = await db.get(Capture, body.capture_id)
    if not capture:
        raise HTTPException(404, "capture_not_found")
    scene = await db.get(Scene, body.scene_id)
    if not scene or not scene.is_active:
        raise HTTPException(404, "scene_not_found")

    # content guardrails (deepfake/impersonation) — reject with 422
    try:
        check_guardrails(scene, body.fx or {})
    except GuardrailError as e:
        raise HTTPException(422, f"guardrail_rejected:{e}")

    consent = await db.scalar(
        select(Consent).where(Consent.session_id == capture.session_id).limit(1)
    )
    biometric_ok = bool(consent and consent.biometric_ok)

    job = RenderJob(
        capture_id=body.capture_id,
        scene_id=body.scene_id,
        outfit_id=body.outfit_id,
        branding_id=body.branding_id,
        fx=body.fx or {},
        status="queued",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    bg.add_task(run_render_job, job.id, biometric_ok)
    return job


@router.get("/jobs/{job_id}", response_model=JobOut)
async def get_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await db.get(RenderJob, job_id)
    if not job:
        raise HTTPException(404, "job_not_found")
    output_id = await db.scalar(
        select(Output.id).where(Output.render_job_id == job_id).limit(1)
    )
    data = JobOut.model_validate(job, from_attributes=True)
    data.output_id = output_id
    return data


@router.post("/jobs/{job_id}/cancel", response_model=JobOut)
async def cancel_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await db.get(RenderJob, job_id)
    if not job:
        raise HTTPException(404, "job_not_found")
    if job.status in ("queued", "running"):
        job.status = "canceled"
        await db.commit()
        await db.refresh(job)
    return job
