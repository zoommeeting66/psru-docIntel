import os
import tempfile

# Isolate test DB/storage before app modules read settings.
_tmp = tempfile.mkdtemp(prefix="pb-test-")
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test.db"
os.environ["STORAGE_DIR"] = f"{_tmp}/storage"
os.environ["PIPELINE_MOCK"] = "true"
os.environ["PIPELINE_STAGE_DELAY_MS"] = "1"

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.db import init_db
from app.main import app
from app.seed import seed


@pytest_asyncio.fixture
async def client():
    await init_db()
    await seed()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
