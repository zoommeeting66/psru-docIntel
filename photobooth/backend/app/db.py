"""Async SQLAlchemy engine, session factory and Base.

Portable across SQLite (dev/test) and PostgreSQL (prod) — models avoid
backend-specific column types so the same scaffold runs on both.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator

from sqlalchemy import DateTime, String
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, mapped_column

from .config import get_settings

settings = get_settings()

engine = create_async_engine(settings.database_url, echo=False, future=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


def new_uuid() -> str:
    return uuid.uuid4().hex


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def pk_column():
    """Primary-key column factory (string UUID, portable)."""
    return mapped_column(String(32), primary_key=True, default=new_uuid)


def ts_column(default_now: bool = True):
    return mapped_column(
        DateTime(timezone=True),
        default=utcnow if default_now else None,
        nullable=not default_now,
    )


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    """Create tables (dev convenience; use schema.sql / Alembic in prod)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
