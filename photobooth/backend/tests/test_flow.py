"""End-to-end Phase 1 flow: session → consent → capture → render → output."""
import asyncio
import io

import pytest

API = "/api/v1"


@pytest.mark.asyncio
async def test_health(client):
    r = await client.get(f"{API}/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_scenes_seeded(client):
    r = await client.get(f"{API}/scenes")
    assert r.status_code == 200
    scenes = r.json()
    assert len(scenes) >= 10
    # symbolic-restricted guardrail flag is exposed
    assert any(s["is_symbolic_restricted"] for s in scenes)


@pytest.mark.asyncio
async def test_capture_requires_consent(client):
    sid = (await client.post(f"{API}/sessions", json={"channel": "kiosk"})).json()["id"]
    files = {"file": ("c.jpg", io.BytesIO(b"\xff\xd8\xff"), "image/jpeg")}
    r = await client.post(f"{API}/sessions/{sid}/captures", files=files)
    assert r.status_code == 422  # consent_required_before_capture


@pytest.mark.asyncio
async def test_full_flow(client):
    # 1. session
    sid = (await client.post(f"{API}/sessions", json={"channel": "kiosk"})).json()["id"]

    # 2. consent (biometric required)
    r = await client.post(
        f"{API}/sessions/{sid}/consent",
        json={"biometric_ok": True, "marketing_ok": True, "policy_version": "2026.1"},
    )
    assert r.status_code == 201

    # 3. capture
    files = {"file": ("c.jpg", io.BytesIO(b"\xff\xd8\xff\x00" * 50), "image/jpeg")}
    cap = (await client.post(f"{API}/sessions/{sid}/captures", files=files)).json()

    # 4. pick a scene + render job
    scene = (await client.get(f"{API}/scenes")).json()[0]
    r = await client.post(
        f"{API}/jobs",
        json={"capture_id": cap["id"], "scene_id": scene["id"], "fx": {"confetti": True}},
    )
    assert r.status_code == 202
    job_id = r.json()["id"]

    # 5. poll job to completion
    output_id = None
    for _ in range(60):
        jr = (await client.get(f"{API}/jobs/{job_id}")).json()
        if jr["status"] == "succeeded":
            output_id = jr["output_id"]
            break
        if jr["status"] == "failed":
            pytest.fail(f"job failed: {jr}")
        await asyncio.sleep(0.05)
    assert output_id, "job did not finish"

    # 6. output + share + feedback
    out = (await client.get(f"{API}/outputs/{output_id}")).json()
    assert out["final_url"]
    share = await client.post(f"{API}/outputs/{output_id}/share")
    assert share.status_code == 201 and share.json()["share_token"]
    fb = await client.post(f"{API}/outputs/{output_id}/feedback", json={"rating": 5})
    assert fb.status_code == 201


@pytest.mark.asyncio
async def test_guardrail_rejects_deepfake(client):
    sid = (await client.post(f"{API}/sessions", json={"channel": "web"})).json()["id"]
    await client.post(
        f"{API}/sessions/{sid}/consent",
        json={"biometric_ok": True, "policy_version": "2026.1"},
    )
    files = {"file": ("c.jpg", io.BytesIO(b"\xff\xd8\xff"), "image/jpeg")}
    cap = (await client.post(f"{API}/sessions/{sid}/captures", files=files)).json()
    scene = (await client.get(f"{API}/scenes")).json()[0]
    r = await client.post(
        f"{API}/jobs",
        json={"capture_id": cap["id"], "scene_id": scene["id"], "fx": {"deepfake": True}},
    )
    assert r.status_code == 422
