"""FastAPI application entrypoint.

Run (dev):  uvicorn app.main:app --reload
Docs:       http://localhost:8000/docs
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import __version__
from .config import get_settings
from .db import init_db
from .routers import health, jobs, outputs, scenes, sessions, stats
from .seed import seed
from .storage import storage_root

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed()
    yield


app = FastAPI(
    title=settings.app_name,
    version=__version__,
    description="PSRU AI Virtual Photo Booth & VR Studio — Core API (Phase 1 MVP)",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

API = "/api/v1"
app.include_router(health.router, prefix=API)
app.include_router(sessions.router, prefix=API)
app.include_router(scenes.router, prefix=API)
app.include_router(jobs.router, prefix=API)
app.include_router(outputs.router, prefix=API)
app.include_router(stats.router, prefix=API)

# Serve stored files (dev only; prod uses CDN + signed URLs)
app.mount("/files", StaticFiles(directory=storage_root()), name="files")


@app.get("/")
async def root():
    return {
        "service": settings.app_name,
        "version": __version__,
        "docs": "/docs",
        "api_base": API,
    }
