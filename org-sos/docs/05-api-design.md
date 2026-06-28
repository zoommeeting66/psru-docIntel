# 05 — API Design

REST over HTTPS (JSON) + WebSocket (WSS) สำหรับ realtime
Base path: `/v1` · Auth: `Authorization: Bearer <JWT>` (ออกโดย Auth Service/Keycloak)

## 5.1 หลักการ
- **Idempotent SOS**: client สร้าง `incident_uuid` (UUIDv7) แนบทุกครั้ง/ทุกช่องทาง; ส่ง header `Idempotency-Key`
- **Versioned**: prefix `/v1`; breaking change → `/v2`
- **RBAC**: ทุก endpoint ตรวจ scope/role; ข้อมูลอ่อนไหวต้องมี purpose + บันทึก audit
- **Pagination**: `?limit=&cursor=` (cursor-based, default limit 50, max 200)
- **Errors**: รูปแบบเดียว `{ "error": {code,message,details,request_id} }`
- **Rate limit**: ต่อ IP และต่อ person (SOS endpoint มี burst allowance พิเศษ)
- **Time**: ISO-8601 UTC; client แนบ `captured_at` + tz offset

## 5.2 Auth
| Method | Path | คำอธิบาย |
|--------|------|----------|
| GET | `/v1/auth/login` | redirect ไป IdP (OIDC) |
| GET | `/v1/auth/callback` | รับ code → ออก JWT (access+refresh) |
| POST | `/v1/auth/refresh` | ต่ออายุ token |
| POST | `/v1/auth/logout` | เพิกถอน session |
| GET | `/v1/me` | โปรไฟล์ผู้ใช้ + role + scope ปัจจุบัน |

## 5.3 Device & Profile
| Method | Path | คำอธิบาย |
|--------|------|----------|
| POST | `/v1/devices` | ลงทะเบียนอุปกรณ์ + push token + capabilities |
| PUT | `/v1/devices/:id` | อัปเดต push token / capabilities / last_seen |
| GET | `/v1/me/emergency-contacts` | รายชื่อผู้ติดต่อฉุกเฉินของตน |
| PUT | `/v1/me/emergency-contacts` | แก้ไข (ต้องมี consent) |
| GET | `/v1/me/health` | ข้อมูลสุขภาพของตน (ถ้ายินยอม) |
| PUT | `/v1/me/health` | แก้ไขข้อมูลสุขภาพ + consent |

## 5.4 Consent (PDPA)
| Method | Path | คำอธิบาย |
|--------|------|----------|
| GET | `/v1/me/consents` | สถานะ consent ทุก purpose |
| POST | `/v1/me/consents` | ให้ความยินยอม (purpose, scope, version) |
| DELETE | `/v1/me/consents/:id` | เพิกถอนความยินยอม |

## 5.5 Incident (core)

### สร้าง SOS
```http
POST /v1/incidents
Authorization: Bearer <JWT>
Idempotency-Key: 0190f2a4-...   (= incident_uuid)
Content-Type: application/json

{
  "incident_uuid": "0190f2a4-1c33-7abc-9def-0123456789ab",
  "type_code": "medical",
  "severity": "critical",
  "location": {
    "lat": 16.8211, "lng": 100.2659, "accuracy_m": 8,
    "source": "gps",
    "indoor": { "building_code": "A", "floor": 4, "room": "412",
                "beacon_uuid": "f7826da6-...", "major": 1, "minor": 12 }
  },
  "battery_pct": 37,
  "network_status": "wifi",
  "channel_first": "online",
  "is_test": false,
  "note": "หายใจติดขัด",
  "captured_at": "2026-06-28T08:14:05Z",
  "tz_offset": "+07:00"
}
```
**201 Created**
```json
{
  "incident_id": "0190f2a4-...-server",
  "incident_uuid": "0190f2a4-1c33-7abc-9def-0123456789ab",
  "status": "new",
  "channels_notified": ["push","sms","dashboard"],
  "created_at": "2026-06-28T08:14:06Z"
}
```
- หาก `incident_uuid` เคยรับแล้ว → **200 OK** คืนเคสเดิม (idempotent, dedupe)

### Sync จาก offline (batch / store & forward)
```http
POST /v1/incidents/sync
{ "items": [ { ...payload เหมือนข้างบน, "queued_at": "..." }, ... ] }
```
→ คืนผลรายตัว `[{incident_uuid, result: created|merged|duplicate, incident_id}]`

### อ่าน/อัปเดต
| Method | Path | สิทธิ์ | คำอธิบาย |
|--------|------|--------|----------|
| GET | `/v1/incidents` | control/responder/supervisor | list + filter `?status=&severity=&type=&org_unit=&since=&bbox=` |
| GET | `/v1/incidents/:id` | ตาม scope | รายละเอียด + timeline + locations (audit logged) |
| GET | `/v1/incidents/:id/events` | ตาม scope | timeline (append-only) |
| POST | `/v1/incidents/:id/locations` | reporter/responder | เพิ่มจุดตำแหน่ง (live update) |
| POST | `/v1/incidents/:id/notes` | ตาม scope | เพิ่มหมายเหตุ |
| POST | `/v1/incidents/:id/attachments` | ตาม scope | upload (presigned URL flow) |
| POST | `/v1/incidents/:id/cancel` | reporter | ยกเลิกใน cancel window |
| PATCH | `/v1/incidents/:id/status` | responder/control | เปลี่ยนสถานะ (state machine) |
| GET | `/v1/me/incidents` | self | ประวัติของตนเอง |

**State machine** (`PATCH .../status`):
```
new → acknowledged → dispatched → enroute → onsite → resolved → closed
  └────────────────────────────────────────────────────────────▶ canceled
ตรวจ transition ที่อนุญาตตาม role; ทุกการเปลี่ยน → incident_event (status_change)
```

## 5.6 Dispatch & Assignment
| Method | Path | คำอธิบาย |
|--------|------|----------|
| POST | `/v1/incidents/:id/assignments` | มอบหมายผู้รับผิดชอบ |
| POST | `/v1/incidents/:id/assignments/:aid/accept` | responder รับเคส |
| POST | `/v1/incidents/:id/assignments/:aid/arrive` | ถึงที่เกิดเหตุ |
| POST | `/v1/incidents/:id/assignments/:aid/release` | ปล่อย/ส่งต่อ |

## 5.7 Broadcast
| Method | Path | คำอธิบาย |
|--------|------|----------|
| POST | `/v1/broadcasts` | ส่งประกาศ (audience: org_unit / geofence bbox/polygon) |
| GET | `/v1/broadcasts/active` | ประกาศที่ยัง active (สำหรับแอป) |

## 5.8 Reports & Stats
| Method | Path | คำอธิบาย |
|--------|------|----------|
| GET | `/v1/stats/overview` | Dashboard KPI (active, by severity/type, response time) |
| GET | `/v1/incidents/:id/report` | after-action report (PDF/JSON) |
| GET | `/v1/reports?from=&to=&type=` | สถิติช่วงเวลา (anonymized สำหรับรายงานทั่วไป) |
| GET | `/v1/audit?resource=&actor=&from=` | audit log (DPO/admin only) |

## 5.9 Realtime (WebSocket)
```
WSS /v1/realtime?token=<JWT>
→ subscribe topics ตาม role/scope:
   - control:incidents        (ทุกเคส)
   - responder:assignments    (เคสที่ได้รับมอบหมาย)
   - supervisor:{org_unit}    (เคสในสังกัด)
   - incident:{id}            (ติดตามเคสเฉพาะ)
Server push events: incident.created | incident.updated | location.added |
                    assignment.changed | broadcast.sent
```
Payload ตัวอย่าง:
```json
{ "type": "incident.created", "data": { "incident_id":"...", "type":"fire",
  "severity":"critical", "location":{"lat":..,"lng":..,"building":"B"},
  "reporter":{"name":"...","org_unit":"..."} }, "ts":"..." }
```

## 5.10 Ingest (inbound offline channels)
| Method | Path | คำอธิบาย |
|--------|------|----------|
| POST | `/internal/ingest/sms` | webhook จาก SMS gateway (inbound SMS → parse → incident) |
| POST | `/internal/ingest/lora` | payload จาก LoRa gateway |
| POST | `/internal/ingest/relay` | payload ที่ relay มาจาก BLE/Wi-Fi Direct |
> endpoints `/internal/*` เข้าถึงได้เฉพาะภายใน (mTLS/network policy) + signed payload

## 5.11 ตัวอย่าง Error
```json
{ "error": { "code": "consent_required",
  "message": "Health data access requires active consent",
  "details": { "purpose": "emergency_health_disclosure" },
  "request_id": "req_01J..." } }
```
รหัสที่ใช้บ่อย: `unauthorized, forbidden, not_found, conflict (duplicate),
validation_error, consent_required, rate_limited, channel_unavailable`

## 5.12 OpenAPI
จัดทำสเปก OpenAPI 3.1 (`openapi.yaml`) เป็น single source of truth →
generate client (Dart/TS) + contract test ใน CI (เพิ่มในเฟส Implementation)
