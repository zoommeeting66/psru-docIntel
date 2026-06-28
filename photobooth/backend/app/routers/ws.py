"""WebSocket endpoint for live job progress.

Pushes job snapshots as the pipeline advances. Subscribes to the in-process
hub for real-time events, and also self-heals by reading a DB snapshot on a
1s heartbeat (covers a late connect or a missed event). Closes when the job
reaches a terminal state.
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from ..db import SessionLocal
from ..events import hub
from ..models import Output, RenderJob

router = APIRouter(tags=["Jobs"])

TERMINAL = {"succeeded", "failed", "canceled"}


async def _snapshot(job_id: str) -> dict | None:
    async with SessionLocal() as db:
        job = await db.get(RenderJob, job_id)
        if job is None:
            return None
        output_id = await db.scalar(
            select(Output.id).where(Output.render_job_id == job_id).limit(1)
        )
        return {
            "id": job.id,
            "status": job.status,
            "progress": job.progress,
            "stage": job.stage,
            "pipeline_steps": dict(job.pipeline_steps or {}),
            "output_id": output_id,
            "error": job.error,
        }


@router.websocket("/ws/jobs/{job_id}")
async def ws_job(websocket: WebSocket, job_id: str):
    await websocket.accept()
    queue = hub.subscribe(job_id)
    try:
        # initial snapshot (subscribe first, then read, to avoid a race)
        snap = await _snapshot(job_id)
        if snap is None:
            await websocket.send_json({"error": "job_not_found"})
            return
        await websocket.send_json(snap)
        if snap["status"] in TERMINAL:
            return

        while True:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                # heartbeat: re-read DB in case an event was missed
                msg = await _snapshot(job_id)
                if msg is None:
                    return
            await websocket.send_json(msg)
            if msg.get("status") in TERMINAL:
                return
    except WebSocketDisconnect:
        pass
    finally:
        hub.unsubscribe(job_id, queue)
