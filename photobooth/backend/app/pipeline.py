"""AI Orchestrator — runs a render job through the pipeline DAG.

Phase 1 (`PIPELINE_MOCK=true`) simulates the GPU stages with short delays and
produces a real branded image via the Branding Engine, so the end-to-end flow
(capture → render → output → QR) works without a GPU. Phase 2 swaps the mock
stage functions for real model calls (SAM2 / SDXL+ControlNet / IC-Light /
IP-Adapter) served by Triton — the orchestration here stays the same.
"""
from __future__ import annotations

import asyncio
import secrets
from datetime import timedelta

from . import branding, storage
from .config import get_settings
from .events import hub
from .db import SessionLocal, new_uuid, utcnow
from .models import (
    BrandingTemplate,
    Capture,
    Event,
    Output,
    Outfit,
    RenderJob,
    Scene,
    Session,
)

settings = get_settings()

# Ordered pipeline stages (mirrors docs/04-ai-workflow.md)
STAGES = [
    ("segmentation", "Segmentation (SAM 2)", False),
    ("face_pose", "Face & Pose", True),  # requires biometric consent
    ("scene_generate", "Scene Generate (SDXL)", False),
    ("relight", "Relighting (IC-Light)", False),
    ("perspective", "Perspective Match", False),
    ("beauty", "Beauty Enhance", False),
    ("outfit", "AI Outfit", False),
    ("branding", "Branding Engine", False),
]


class GuardrailError(Exception):
    """Raised when content guardrails reject a job (→ HTTP 422)."""


def _snapshot(job: RenderJob, output_id: str | None = None) -> dict:
    return {
        "id": job.id,
        "status": job.status,
        "progress": job.progress,
        "stage": job.stage,
        "pipeline_steps": dict(job.pipeline_steps or {}),
        "output_id": output_id,
        "error": job.error,
    }


def check_guardrails(scene: Scene, fx: dict) -> None:
    # Symbolic-restricted scenes are allowed but constrained; deepfake/
    # impersonation requests are rejected outright.
    if fx.get("impersonate") or fx.get("deepfake"):
        raise GuardrailError("impersonation_not_allowed")


async def run_render_job(job_id: str, biometric_ok: bool = False) -> None:
    """Background task: advance a job to completion and create its Output."""
    delay = settings.pipeline_stage_delay_ms / 1000.0
    started = utcnow()

    async with SessionLocal() as db:
        job = await db.get(RenderJob, job_id)
        if job is None:
            return
        capture = await db.get(Capture, job.capture_id)
        scene = await db.get(Scene, job.scene_id) if job.scene_id else None
        outfit = await db.get(Outfit, job.outfit_id) if job.outfit_id else None

        try:
            if scene is not None:
                check_guardrails(scene, job.fx or {})

            job.status = "running"
            job.gpu_node = "mock-gpu-0" if settings.pipeline_mock else "gpu-0"
            steps: dict = {}

            total = len(STAGES)
            for i, (key, label, needs_bio) in enumerate(STAGES, start=1):
                if needs_bio and not biometric_ok:
                    steps[key] = {"status": "skipped", "reason": "no_biometric_consent"}
                else:
                    await asyncio.sleep(delay)
                    steps[key] = {"status": "done"}
                job.stage = label
                job.progress = int(i / total * 100)
                job.pipeline_steps = dict(steps)
                await db.commit()
                hub.publish(job.id, _snapshot(job))

            # ---- produce the output via the Branding Engine ----
            session = await db.get(Session, capture.session_id) if capture else None
            event = (
                await db.get(Event, session.event_id)
                if session and session.event_id
                else None
            )
            event_title = event.name if event else "PSRU Virtual Photo Booth"
            branding_tpl = (
                await db.get(BrandingTemplate, job.branding_id)
                if job.branding_id
                else None
            )
            show_qr = branding_tpl.show_qr if branding_tpl else True

            image_no = f"{secrets.randbelow(9999):04d}"
            share_token = secrets.token_urlsafe(12)
            share_url = f"{settings.public_base_url.rstrip('/')}/s/{share_token}"

            final_bytes, thumb_bytes = branding.compose_final(
                scene_name=scene.name if scene else "PSRU",
                event_title=event_title,
                image_no=image_no,
                outfit_name=outfit.name if outfit else None,
                share_url=share_url,
                show_qr=show_qr,
            )

            out_id = new_uuid()
            final_key = f"outputs/{out_id}/final.png"
            thumb_key = f"outputs/{out_id}/thumb.png"
            storage.save_bytes(final_key, final_bytes)
            storage.save_bytes(thumb_key, thumb_bytes)

            output = Output(
                id=out_id,
                render_job_id=job.id,
                branding_id=job.branding_id,
                image_no=image_no,
                final_key=final_key,
                thumb_key=thumb_key,
                formats={"png": final_key},
                share_token=share_token,
                expires_at=utcnow() + timedelta(days=settings.output_ttl_days),
            )
            db.add(output)

            job.status = "succeeded"
            job.progress = 100
            job.stage = "completed"
            job.duration_ms = int((utcnow() - started).total_seconds() * 1000)
            await db.commit()
            hub.publish(job.id, _snapshot(job, output_id=out_id))

        except GuardrailError as e:
            job.status = "failed"
            job.error = f"guardrail:{e}"
            await db.commit()
            hub.publish(job.id, _snapshot(job))
        except Exception as e:  # noqa: BLE001 — record any stage failure
            job.status = "failed"
            job.error = str(e)
            await db.commit()
            hub.publish(job.id, _snapshot(job))
