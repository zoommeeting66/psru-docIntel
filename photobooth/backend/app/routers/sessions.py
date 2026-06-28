from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_db, new_uuid, utcnow
from ..models import AuditLog, Capture, Consent, Session
from ..schemas import (
    CaptureOut,
    ConsentCreate,
    ConsentOut,
    SessionCreate,
    SessionOut,
)
from .. import storage

router = APIRouter(tags=["Session"])
settings = get_settings()


@router.post("/sessions", response_model=SessionOut, status_code=201)
async def create_session(body: SessionCreate, db: AsyncSession = Depends(get_db)):
    s = Session(
        channel=body.channel, event_id=body.event_id, device_id=body.device_id
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return s


@router.get("/sessions/{sid}", response_model=SessionOut)
async def get_session(sid: str, db: AsyncSession = Depends(get_db)):
    s = await db.get(Session, sid)
    if not s:
        raise HTTPException(404, "session_not_found")
    return s


@router.post("/sessions/{sid}/end", response_model=SessionOut)
async def end_session(sid: str, db: AsyncSession = Depends(get_db)):
    s = await db.get(Session, sid)
    if not s:
        raise HTTPException(404, "session_not_found")
    s.status = "completed"
    s.ended_at = utcnow()
    await db.commit()
    await db.refresh(s)
    return s


@router.post("/sessions/{sid}/consent", response_model=ConsentOut, status_code=201)
async def add_consent(
    sid: str, body: ConsentCreate, request: Request, db: AsyncSession = Depends(get_db)
):
    s = await db.get(Session, sid)
    if not s:
        raise HTTPException(404, "session_not_found")
    if not body.biometric_ok:
        # biometric processing is required to build a studio-grade image
        raise HTTPException(422, "biometric_consent_required")
    c = Consent(
        session_id=sid,
        biometric_ok=body.biometric_ok,
        age_gender_ok=body.age_gender_ok,
        marketing_ok=body.marketing_ok,
        policy_version=body.policy_version,
        ip_address=request.client.host if request.client else None,
    )
    db.add(c)
    db.add(AuditLog(action="consent.create", entity="session", entity_id=sid,
                    extra={"marketing_ok": body.marketing_ok}))
    await db.commit()
    await db.refresh(c)
    return c


@router.post("/sessions/{sid}/captures", response_model=CaptureOut, status_code=201)
async def upload_capture(
    sid: str,
    file: UploadFile,
    source_type: str = "kiosk",
    db: AsyncSession = Depends(get_db),
):
    s = await db.get(Session, sid)
    if not s:
        raise HTTPException(404, "session_not_found")

    # require recorded biometric consent before storing any capture
    consent = await db.scalar(
        Consent.__table__.select().where(Consent.session_id == sid).limit(1)
    )
    if consent is None:
        raise HTTPException(422, "consent_required_before_capture")

    data = await file.read()
    cap_id = new_uuid()
    key = f"captures/{cap_id}/original"
    storage.save_bytes(key, data)

    cap = Capture(
        id=cap_id,
        session_id=sid,
        source_type=source_type,
        storage_key=key,
        people_count=1,
        purge_after=utcnow() + timedelta(hours=settings.capture_ttl_hours),
    )
    db.add(cap)
    await db.commit()
    await db.refresh(cap)
    return cap
