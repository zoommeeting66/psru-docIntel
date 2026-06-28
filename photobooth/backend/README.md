# PSRU Photo Booth — Core API (Phase 1 MVP)

Backend จริง (รันได้) ของระบบ **PSRU AI Virtual Photo Booth & VR Studio**
สถาปัตยกรรม: **FastAPI (async) + SQLAlchemy 2.0 + PostgreSQL** (dev ใช้ SQLite ได้เลย)

Phase 1 ครอบคลุม flow ครบวงจร: **session → consent (PDPA) → capture → render → output → QR/share → feedback**
โดย AI pipeline ทำงานแบบ **mock** (จำลอง stage จริงด้วย delay สั้น) และสร้าง **ภาพ branded จริง** ด้วย Branding Engine (PIL)
จึงรันได้ทันทีโดย **ไม่ต้องมี GPU** — Phase 2 เพียงสลับฟังก์ชัน stage ไปเรียกโมเดลจริง (SAM2 / SDXL+ControlNet / IC-Light) ผ่าน Triton

## รันแบบเร็วที่สุด (SQLite, ไม่ต้องมี service อื่น)

```bash
cd photobooth/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # ค่าเริ่มต้นใช้ SQLite
uvicorn app.main:app --reload
```

เปิด **http://localhost:8000/docs** (Swagger UI) เพื่อลองยิง API

## รันด้วย Docker Compose (API + PostgreSQL + Redis)

```bash
cd photobooth/backend
docker compose up --build
# API: http://localhost:8000/docs
```

## ทดสอบ (pytest — รัน end-to-end flow จริง)

```bash
cd photobooth/backend
pip install -r requirements.txt
pytest -q
```

เทสต์ครอบคลุม: health, scene seeding, **capture ต้องมี consent ก่อน**,
flow เต็ม (session→…→output→share→feedback) และ **guardrail ปฏิเสธ deepfake (422)**

## ตัวอย่างใช้งานด้วย curl

```bash
B=http://localhost:8000/api/v1
SID=$(curl -s -XPOST $B/sessions -H 'content-type: application/json' -d '{"channel":"kiosk"}' | jq -r .id)
curl -s -XPOST $B/sessions/$SID/consent -H 'content-type: application/json' \
     -d '{"biometric_ok":true,"marketing_ok":true,"policy_version":"2026.1"}'
CAP=$(curl -s -XPOST $B/sessions/$SID/captures -F file=@photo.jpg | jq -r .id)
SCENE=$(curl -s $B/scenes | jq -r '.[0].id')
JOB=$(curl -s -XPOST $B/jobs -H 'content-type: application/json' \
     -d "{\"capture_id\":\"$CAP\",\"scene_id\":\"$SCENE\",\"fx\":{\"confetti\":true}}" | jq -r .id)
curl -s $B/jobs/$JOB        # poll จน status=succeeded แล้วได้ output_id
```

## โครงสร้าง

```
backend/
├── app/
│   ├── main.py          # FastAPI app + routers + static /files
│   ├── config.py        # settings (env)
│   ├── db.py            # async engine/session, Base, helpers
│   ├── models.py        # ORM (portable subset ของ schema.sql)
│   ├── schemas.py       # Pydantic I/O
│   ├── security.py      # JWT/RBAC (เตรียมเชื่อม Keycloak)
│   ├── storage.py       # storage abstraction (local → S3/R2 ใน prod)
│   ├── branding.py      # Branding Engine (PIL: logo/frame/QR/watermark/หมายเลข)
│   ├── pipeline.py      # AI Orchestrator (mock stages → real models ใน Phase 2)
│   ├── seed.py          # ข้อมูลอ้างอิง (ฉาก/ชุด/แบรนด์/event)
│   └── routers/         # health, sessions, scenes, jobs, outputs, stats
├── tests/               # pytest (end-to-end)
├── Dockerfile · docker-compose.yml · requirements.txt · pyproject.toml
```

## Mapping กับ API Spec
ตรงตาม [`../docs/03-api-specification.md`](../docs/03-api-specification.md) และ [`../openapi.yaml`](../openapi.yaml)
(prefix จริงคือ `/api/v1`)

## สิ่งที่ต่อใน Phase 2
- สลับ stage ใน `pipeline.py` → โมเดลจริงผ่าน **Triton**, ใช้ **Redis/Celery** เป็น queue จริง (ปัจจุบันใช้ FastAPI BackgroundTasks)
- เชื่อม **Keycloak (OIDC)** ใน `security.py` + บังคับ MFA สำหรับ admin
- ย้าย storage → **S3/R2** + signed URL, ใช้ `schema.sql` (pgvector) + Alembic migrations
- ~~WebSocket job progress~~ ✅ ทำแล้ว: `WS /api/v1/ws/jobs/{id}` (in-process hub + DB self-heal; frontend ใช้ WS, มี poll เป็น fallback) — Phase 2 เปลี่ยน hub → Redis pub/sub
