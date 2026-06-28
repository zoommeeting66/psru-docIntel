"""ORM models — portable subset of schema.sql for the Phase 1 MVP.

Covered: roles, users, events, branding_templates, scene_categories,
ai_prompts, scenes, outfits, sessions, consents, captures, render_jobs,
outputs, downloads, feedback, audit_logs.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, pk_column, ts_column


class Role(Base):
    __tablename__ = "roles"
    id: Mapped[str] = pk_column()
    name: Mapped[str] = mapped_column(String(50), unique=True)
    permissions: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = ts_column()


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = pk_column()
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role_id: Mapped[Optional[str]] = mapped_column(ForeignKey("roles.id"), nullable=True)
    sso_subject: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = ts_column()


class BrandingTemplate(Base):
    __tablename__ = "branding_templates"
    id: Mapped[str] = pk_column()
    name: Mapped[str] = mapped_column(String(120))
    logo_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    frame_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    watermark: Mapped[dict] = mapped_column(JSON, default=dict)
    show_qr: Mapped[bool] = mapped_column(Boolean, default=True)
    layout: Mapped[dict] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = ts_column()


class Event(Base):
    __tablename__ = "events"
    id: Mapped[str] = pk_column()
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(120), unique=True)
    start_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    end_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    default_branding_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("branding_templates.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = ts_column()


class SceneCategory(Base):
    __tablename__ = "scene_categories"
    id: Mapped[str] = pk_column()
    name: Mapped[str] = mapped_column(String(120))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class AIPrompt(Base):
    __tablename__ = "ai_prompts"
    id: Mapped[str] = pk_column()
    name: Mapped[str] = mapped_column(String(120))
    positive_prompt: Mapped[str] = mapped_column(Text)
    negative_prompt: Mapped[str] = mapped_column(Text, default="")
    params: Mapped[dict] = mapped_column(JSON, default=dict)
    model_ref: Mapped[str] = mapped_column(String(120))
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = ts_column()


class Scene(Base):
    __tablename__ = "scenes"
    id: Mapped[str] = pk_column()
    category_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("scene_categories.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200))
    thumbnail_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    hdri_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    asset_3d_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ai_prompt_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("ai_prompts.id"), nullable=True
    )
    is_360: Mapped[bool] = mapped_column(Boolean, default=False)
    is_symbolic_restricted: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = ts_column()

    category: Mapped[Optional[SceneCategory]] = relationship(lazy="selectin")


class Outfit(Base):
    __tablename__ = "outfits"
    id: Mapped[str] = pk_column()
    name: Mapped[str] = mapped_column(String(120))
    category: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    preview_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    control_asset_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = ts_column()


class Session(Base):
    __tablename__ = "sessions"
    id: Mapped[str] = pk_column()
    user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    event_id: Mapped[Optional[str]] = mapped_column(ForeignKey("events.id"), nullable=True)
    channel: Mapped[str] = mapped_column(String(20))  # web/mobile/kiosk/vr
    device_id: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
    started_at: Mapped[datetime] = ts_column()
    ended_at: Mapped[Optional[datetime]] = ts_column(default_now=False)


class Consent(Base):
    __tablename__ = "consents"
    id: Mapped[str] = pk_column()
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    biometric_ok: Mapped[bool] = mapped_column(Boolean, default=False)
    age_gender_ok: Mapped[bool] = mapped_column(Boolean, default=False)
    marketing_ok: Mapped[bool] = mapped_column(Boolean, default=False)
    policy_version: Mapped[str] = mapped_column(String(20))
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    consented_at: Mapped[datetime] = ts_column()


class Capture(Base):
    __tablename__ = "captures"
    id: Mapped[str] = pk_column()
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    source_type: Mapped[str] = mapped_column(String(40))
    storage_key: Mapped[str] = mapped_column(String(255))
    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    people_count: Mapped[int] = mapped_column(Integer, default=1)
    exif: Mapped[dict] = mapped_column(JSON, default=dict)
    purge_after: Mapped[Optional[datetime]] = ts_column(default_now=False)
    created_at: Mapped[datetime] = ts_column()


class RenderJob(Base):
    __tablename__ = "render_jobs"
    id: Mapped[str] = pk_column()
    capture_id: Mapped[str] = mapped_column(ForeignKey("captures.id", ondelete="CASCADE"))
    scene_id: Mapped[Optional[str]] = mapped_column(ForeignKey("scenes.id"), nullable=True)
    outfit_id: Mapped[Optional[str]] = mapped_column(ForeignKey("outfits.id"), nullable=True)
    branding_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("branding_templates.id"), nullable=True
    )
    fx: Mapped[dict] = mapped_column(JSON, default=dict)
    pipeline_steps: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="queued")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    stage: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    gpu_node: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = ts_column()
    updated_at: Mapped[datetime] = ts_column()


class Output(Base):
    __tablename__ = "outputs"
    id: Mapped[str] = pk_column()
    render_job_id: Mapped[str] = mapped_column(
        ForeignKey("render_jobs.id", ondelete="CASCADE")
    )
    branding_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("branding_templates.id"), nullable=True
    )
    image_no: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    final_key: Mapped[str] = mapped_column(String(255))
    thumb_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    formats: Mapped[dict] = mapped_column(JSON, default=dict)
    share_token: Mapped[Optional[str]] = mapped_column(String(64), unique=True, nullable=True)
    expires_at: Mapped[Optional[datetime]] = ts_column(default_now=False)
    created_at: Mapped[datetime] = ts_column()


class Download(Base):
    __tablename__ = "downloads"
    id: Mapped[str] = pk_column()
    output_id: Mapped[str] = mapped_column(ForeignKey("outputs.id", ondelete="CASCADE"))
    format: Mapped[str] = mapped_column(String(10))
    channel: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = ts_column()


class Feedback(Base):
    __tablename__ = "feedback"
    id: Mapped[str] = pk_column()
    output_id: Mapped[str] = mapped_column(ForeignKey("outputs.id", ondelete="CASCADE"))
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = ts_column()


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[str] = pk_column()
    actor_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(80))
    entity: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    entity_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    extra: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = ts_column()
