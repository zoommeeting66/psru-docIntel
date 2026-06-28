"""WebSocket job-progress endpoint test (Starlette sync TestClient)."""
import io

from starlette.testclient import TestClient

from app.main import app

API = "/api/v1"


def test_ws_job_progress():
    with TestClient(app) as client:
        sid = client.post(f"{API}/sessions", json={"channel": "kiosk"}).json()["id"]
        client.post(
            f"{API}/sessions/{sid}/consent",
            json={"biometric_ok": True, "policy_version": "2026.1"},
        )
        files = {"file": ("c.jpg", io.BytesIO(b"\xff\xd8\xff" + b"x" * 200), "image/jpeg")}
        cap = client.post(f"{API}/sessions/{sid}/captures", files=files).json()
        scene = client.get(f"{API}/scenes").json()[0]
        job = client.post(
            f"{API}/jobs",
            json={"capture_id": cap["id"], "scene_id": scene["id"]},
        ).json()

        statuses = []
        output_id = None
        with client.websocket_connect(f"{API}/ws/jobs/{job['id']}") as ws:
            for _ in range(50):
                msg = ws.receive_json()
                statuses.append(msg["status"])
                if msg["status"] in ("succeeded", "failed", "canceled"):
                    assert msg["status"] == "succeeded", msg
                    output_id = msg["output_id"]
                    break

        assert output_id, f"no output via WS; statuses={statuses}"
