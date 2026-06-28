"""Auth & RBAC tests (dev-mode HS256 tokens)."""
import pytest

API = "/api/v1"


async def _token(client, role: str) -> str:
    r = await client.post(f"{API}/auth/dev-token", json={"role": role})
    assert r.status_code == 200
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_auth_config(client):
    r = await client.get(f"{API}/auth/config")
    assert r.status_code == 200
    assert r.json()["dev_mode"] is True
    assert r.json()["oidc_enabled"] is False


@pytest.mark.asyncio
async def test_me_anonymous_vs_token(client):
    anon = (await client.get(f"{API}/auth/me")).json()
    assert anon["anonymous"] is True
    tok = await _token(client, "executive")
    me = (await client.get(f"{API}/auth/me", headers=_auth(tok))).json()
    assert me["role"] == "executive" and me["anonymous"] is False


@pytest.mark.asyncio
async def test_stats_requires_executive(client):
    # no token → 401
    assert (await client.get(f"{API}/stats/overview")).status_code == 401
    # user role → 403
    utok = await _token(client, "user")
    assert (
        await client.get(f"{API}/stats/overview", headers=_auth(utok))
    ).status_code == 403
    # executive → 200
    etok = await _token(client, "executive")
    assert (
        await client.get(f"{API}/stats/overview", headers=_auth(etok))
    ).status_code == 200
    # admin bypasses → 200
    atok = await _token(client, "admin")
    assert (
        await client.get(f"{API}/stats/overview", headers=_auth(atok))
    ).status_code == 200


@pytest.mark.asyncio
async def test_admin_endpoints_rbac(client):
    etok = await _token(client, "executive")
    # executive cannot reach admin endpoints
    assert (
        await client.get(f"{API}/admin/audit", headers=_auth(etok))
    ).status_code == 403
    # admin can
    atok = await _token(client, "admin")
    assert (
        await client.get(f"{API}/admin/audit", headers=_auth(atok))
    ).status_code == 200
    # admin can create a scene (and it shows up)
    r = await client.post(
        f"{API}/admin/scenes",
        headers=_auth(atok),
        json={"name": "ฉากทดสอบ E2E", "is_360": True},
    )
    assert r.status_code == 201
    scenes = (await client.get(f"{API}/scenes")).json()
    assert any(s["name"] == "ฉากทดสอบ E2E" for s in scenes)


@pytest.mark.asyncio
async def test_invalid_token_rejected(client):
    assert (
        await client.get(f"{API}/auth/me", headers=_auth("garbage.token.value"))
    ).status_code == 401
