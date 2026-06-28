"""Application configuration (env-driven via pydantic-settings)."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "PSRU AI Virtual Photo Booth API"
    env: str = "dev"

    database_url: str = "sqlite+aiosqlite:///./data/photobooth.db"
    storage_dir: str = "./data/storage"
    public_base_url: str = "http://localhost:8000"

    jwt_secret: str = "dev-insecure-secret-change-me"
    jwt_alg: str = "HS256"

    pipeline_mock: bool = True
    pipeline_stage_delay_ms: int = 400

    capture_ttl_hours: int = 24
    output_ttl_days: int = 30
    policy_version: str = "2026.1"

    # CORS — restrict to PSRU origins in prod
    cors_origins: list[str] = ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
