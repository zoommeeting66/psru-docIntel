"""Auth & RBAC helpers (simplified for Phase 1).

Prod: validate OIDC (Keycloak) JWTs and map roles. Here we accept an
optional bearer token and allow anonymous kiosk/guest principals so the
capture flow is usable without a full identity provider yet.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from .config import get_settings

settings = get_settings()
_bearer = HTTPBearer(auto_error=False)


@dataclass
class Principal:
    subject: str
    role: str
    anonymous: bool = False

    def require(self, *roles: str) -> None:
        if self.role == "admin":
            return
        if roles and self.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="insufficient_role",
            )


def get_principal(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Principal:
    if creds is None:
        # Anonymous kiosk/guest — allowed to run the capture flow.
        return Principal(subject="anonymous", role="user", anonymous=True)
    try:
        payload = jwt.decode(
            creds.credentials, settings.jwt_secret, algorithms=[settings.jwt_alg]
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token"
        )
    return Principal(
        subject=payload.get("sub", "unknown"),
        role=payload.get("role", "user"),
    )


def require_role(*roles: str):
    def _dep(principal: Principal = Depends(get_principal)) -> Principal:
        principal.require(*roles)
        return principal

    return _dep
