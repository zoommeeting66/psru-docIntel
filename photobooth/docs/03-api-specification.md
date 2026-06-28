# 3. REST API Specification

Base URL: `https://api.photobooth.psru.ac.th/v1`
Auth: `Authorization: Bearer <JWT>` (OIDC จาก Keycloak) · Kiosk ใช้ device token
Format: `application/json` (ภาพอัปโหลดเป็น `multipart/form-data`)
Realtime: WebSocket `wss://api.photobooth.psru.ac.th/v1/ws/jobs/{job_id}`

> สเปกเครื่องอ่านได้ (OpenAPI 3.1) อยู่ที่ [`../openapi.yaml`](../openapi.yaml)

## 3.1 ภาพรวม Endpoints

| โดเมน | Method & Path | คำอธิบาย |
|-------|---------------|----------|
| Health | `GET /health` | ตรวจสถานะระบบ + queue depth |
| Auth | `POST /auth/token` · `POST /auth/refresh` | แลก/ต่ออายุ token |
| Session | `POST /sessions` · `GET /sessions/{id}` · `POST /sessions/{id}/end` | จัดการรอบใช้งาน |
| Consent | `POST /sessions/{id}/consent` | บันทึกความยินยอม PDPA |
| Capture | `POST /sessions/{id}/captures` (multipart) | อัปโหลดภาพต้นฉบับ |
| Scenes | `GET /scenes` · `GET /scenes/{id}` · `GET /scenes/recommend` | คลังฉาก + แนะนำ |
| Outfits | `GET /outfits` | คลังเครื่องแต่งกาย |
| Jobs | `POST /jobs` · `GET /jobs/{id}` · `POST /jobs/{id}/cancel` | สั่ง/ติดตามงาน AI |
| Outputs | `GET /outputs/{id}` · `GET /outputs/{id}/download?fmt=` · `POST /outputs/{id}/share` | ผลลัพธ์/ดาวน์โหลด/แชร์ |
| Feedback | `POST /outputs/{id}/feedback` | ให้คะแนนความพึงพอใจ |
| Stats | `GET /stats/overview` · `GET /stats/scenes` · `GET /stats/heatmap` | Dashboard |
| Admin | `CRUD /admin/scenes` · `/admin/branding` · `/admin/prompts` · `/admin/events` · `/admin/users` | จัดการระบบ (RBAC) |
| Audit | `GET /admin/audit` | Audit trail |

## 3.2 ตัวอย่าง Request/Response

### สร้าง session + consent
```http
POST /v1/sessions
{ "channel": "kiosk", "event_id": "…", "device_id": "kiosk-hall-01" }
→ 201 { "id": "9f…", "status": "active", "started_at": "2026-06-28T09:00:00Z" }

POST /v1/sessions/9f…/consent
{ "biometric_ok": true, "age_gender_ok": false, "marketing_ok": true,
  "policy_version": "2026.1" }
→ 201 { "id": "c1…", "consented_at": "…" }
```

### อัปโหลดภาพ + สั่ง render
```http
POST /v1/sessions/9f…/captures      (multipart: file=<jpeg>)
→ 201 { "id": "cap…", "people_count": 2, "width": 4000, "height": 6000 }

POST /v1/jobs
{ "capture_id": "cap…",
  "scene_id": "scene-graduation-hall",
  "outfit_id": "outfit-gown",
  "fx": { "confetti": true, "lighting": "warm" },
  "branding_id": "brand-grad-2026" }
→ 202 { "id": "job…", "status": "queued", "progress": 0 }
```

### ติดตามผ่าน WebSocket
```jsonc
// ← server push
{ "job_id": "job…", "status": "running", "progress": 45, "stage": "generate_scene" }
{ "job_id": "job…", "status": "succeeded", "progress": 100,
  "output_id": "out…", "thumb_url": "https://cdn…/thumb.jpg" }
```

### ดาวน์โหลด/แชร์
```http
GET  /v1/outputs/out…/download?fmt=png   → 302 → signed CDN URL (มีอายุ)
POST /v1/outputs/out…/share { "channel": "qr" }
→ 201 { "share_token": "ab12…", "qr_url": "https://cdn…/qr.png",
        "expires_at": "2026-07-28T00:00:00Z" }
```

## 3.3 มาตรฐานทั่วไป

- **Pagination:** `?limit=&offset=` (ค่า default 20/หน้า), response มี `total`
- **Errors:** รูปแบบเดียวกัน `{ "error": { "code", "message", "trace_id" } }`
  รหัส HTTP: 400 (validate), 401/403 (auth/RBAC), 404, 409 (state), 429 (rate limit), 422 (guardrail ปฏิเสธฉาก/prompt)
- **Idempotency:** `POST /jobs` รองรับ header `Idempotency-Key`
- **Rate limit:** ต่อ device/user, ส่ง `X-RateLimit-Remaining`
- **Versioning:** prefix `/v1`; breaking change ขึ้น `/v2`
- **CORS:** จำกัด origin เฉพาะโดเมน PSRU + kiosk
