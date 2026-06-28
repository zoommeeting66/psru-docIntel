"""Storage abstraction.

Phase 1 uses the local filesystem. In prod, swap the implementation for
S3 / MinIO / Cloudflare R2 behind the same `save_bytes` / `url_for` API.
"""
from __future__ import annotations

import os
from pathlib import Path

from .config import get_settings

settings = get_settings()
_ROOT = Path(settings.storage_dir)


def _path(key: str) -> Path:
    p = _ROOT / key
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def save_bytes(key: str, data: bytes) -> str:
    """Persist bytes under `key`; return the key."""
    _path(key).write_bytes(data)
    return key


def read_bytes(key: str) -> bytes:
    return _path(key).read_bytes()


def exists(key: str) -> bool:
    return (_ROOT / key).exists()


def url_for(key: str | None) -> str | None:
    """Public URL for a stored object.

    In prod this returns a signed, time-limited CDN URL. Here it points at
    the API's static `/files` mount.
    """
    if not key:
        return None
    return f"{settings.public_base_url.rstrip('/')}/files/{key}"


def storage_root() -> str:
    os.makedirs(_ROOT, exist_ok=True)
    return str(_ROOT)
