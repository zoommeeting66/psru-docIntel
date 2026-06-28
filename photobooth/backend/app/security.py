"""Auth & RBAC.

Two validation paths, chosen by config:

1. **Production (OIDC / Keycloak)** — when ``OIDC_ISSUER`` is set, bearer tokens
   are validated as RS256 against the realm JWKS (issuer + audience checked),
   and roles are read from Keycloak's ``realm_access.roles``.
2. **Dev** — otherwise, HS256 tokens signed with ``JWT_SECRET`` are accepted
   (issued by ``POST /auth/dev-token``). Lets the stack run/tested without a
   live Keycloak.

Anonymous requests are allowed (guest/kiosk); ``require_role`` rejects them.
"""
from __future__ import annotations

import json
import time
import urllib.request
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from .config import get_settings

settings = get_settings()
_bearer = HTTPBearer(auto_error=False)

# ---- JWKS cache (production) ----
_jwks: dict | None = None
_jwks_fetched_at: float = 0.0
_JWKS_TTL = 3600.0


def _get_jwks() -> dict:
    global _jwks, _jwks_fetched_at
    if _jwks is None or (time.time() - _jwks_fetched_at) > _JWKS_TTL:
        with urllib.request.urlopen(settings.oidc_jwks_url, timeout=5) as r:  # noqa: S310
            _jwks = json.loads(r.read())
        _jwks_fetched_at = time.time()
    return _jwks


def _extract_role(payload: dict) -> str:
    # Keycloak realm roles, or a flat "role" claim (dev tokens)
    roles = set(payload.get("realm_access", {}).get("roles", []))
    if "role" in payload:
        roles.add(payload["role"])
    for r in settings.oidc_role_priority:  # highest-privilege known role wins
        if r in roles:
            return r
    return "user"


@dataclass
class Principal:
    subject: str
    role: str
    anonymous: bool = False

    def require(self, *roles: str) -> None:
        if self.anonymous:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="authentication_required"
            )
        if self.role == "admin":
            return  # admin is a superset
        if roles and self.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="insufficient_role"
            )


def _decode(token: str) -> dict:
    if settings.oidc_enabled:
        return jwt.decode(
            token,
            _get_jwks(),
            algorithms=["RS256"],
            audience=settings.oidc_audience,
            issuer=settings.oidc_issuer,
        )
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])


def get_principal(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Principal:
    if creds is None:
        return Principal(subject="anonymous", role="user", anonymous=True)
    try:
        payload = _decode(creds.credentials)
    except (JWTError, Exception):  # noqa: BLE001 — any decode/JWKS error → 401
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token"
        )
    return Principal(subject=payload.get("sub", "unknown"), role=_extract_role(payload))


def require_role(*roles: str):
    def _dep(principal: Principal = Depends(get_principal)) -> Principal:
        principal.require(*roles)
        return principal

    return _dep
