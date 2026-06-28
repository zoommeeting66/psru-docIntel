"""Pydantic request/response models."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Channel = Literal["web", "mobile", "kiosk", "vr"]


# ---------- Sessions / Consent ----------
class SessionCreate(BaseModel):
    channel: Channel
    event_id: Optional[str] = None
    device_id: Optional[str] = None


class SessionOut(BaseModel):
    id: str
    channel: str
    status: str
    started_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConsentCreate(BaseModel):
    biometric_ok: bool = False
    age_gender_ok: bool = False
    marketing_ok: bool = False
    policy_version: str


class ConsentOut(BaseModel):
    id: str
    consented_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------- Captures ----------
class CaptureOut(BaseModel):
    id: str
    width: Optional[int] = None
    height: Optional[int] = None
    people_count: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------- Scenes / Outfits ----------
class SceneOut(BaseModel):
    id: str
    name: str
    category: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_360: bool
    is_symbolic_restricted: bool

    model_config = ConfigDict(from_attributes=True)


class OutfitOut(BaseModel):
    id: str
    name: str
    category: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ---------- Jobs ----------
class JobCreate(BaseModel):
    capture_id: str
    scene_id: str
    outfit_id: Optional[str] = None
    branding_id: Optional[str] = None
    fx: dict[str, Any] = Field(default_factory=dict)


class JobOut(BaseModel):
    id: str
    status: str
    progress: int
    stage: Optional[str] = None
    output_id: Optional[str] = None
    pipeline_steps: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


# ---------- Outputs ----------
class OutputOut(BaseModel):
    id: str
    image_no: Optional[str] = None
    final_url: Optional[str] = None
    thumb_url: Optional[str] = None
    formats: dict[str, Any] = Field(default_factory=dict)
    expires_at: Optional[datetime] = None


class ShareOut(BaseModel):
    share_token: str
    share_url: str
    qr_url: str
    expires_at: Optional[datetime] = None


class FeedbackCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None


# ---------- Stats ----------
class StatsOverview(BaseModel):
    sessions_total: int
    images_total: int
    downloads_total: int
    avg_rating: float
    avg_render_ms: int


class Error(BaseModel):
    code: str
    message: str
    trace_id: Optional[str] = None
