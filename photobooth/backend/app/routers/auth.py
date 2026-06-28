"""Auth endpoints.

- ``GET  /auth/config``    — tells the frontend whether OIDC is enabled
- ``POST /auth/dev-token`` — (dev only) mint an HS256 token for a role
- ``GET  /auth/me``        — current principal (role)

In production the SPA obtains tokens from Keycloak via OIDC (Authorization Code
+ PKCE); /auth/dev-token is disabled when ``AUTH_DEV_MODE=false``.
"""
from __future__ import annotations

import time
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_db
from ..models import AuditLog
from ..security import Principal, get_principal

router = APIRouter(prefix="/auth", tags=["Auth"])
settings = get_settings()

DevRole = Literal["admin", "operator", "executive", "user"]


class DevTokenReq(BaseModel):
    role: DevRole = "executive"
    sub: str | None = None


@router.get("/config")
async def auth_config():
    return {
        "oidc_enabled": settings.oidc_enabled,
        "issuer": settings.oidc_issuer,
        "audience": settings.oidc_audience,
        "dev_mode": settings.auth_dev_mode,
    }


@router.post("/dev-token")
async def dev_token(body: DevTokenReq, db: AsyncSession = Depends(get_db)):
    if not settings.auth_dev_mode:
        raise HTTPException(404, "dev_token_disabled")
    sub = body.sub or f"dev-{body.role}"
    now = int(time.time())
    token = jwt.encode(
        {"sub": sub, "role": body.role, "iat": now, "exp": now + 8 * 3600},
        settings.jwt_secret,
        algorithm=settings.jwt_alg,
    )
    db.add(AuditLog(actor_id=None, action="auth.dev_login", entity="user",
                    entity_id=sub, extra={"role": body.role}))
    await db.commit()
    return {"access_token": token, "token_type": "bearer", "role": body.role}


@router.get("/me")
async def me(principal: Principal = Depends(get_principal)):
    return {
        "sub": principal.subject,
        "role": principal.role,
        "anonymous": principal.anonymous,
    }
