# 04 — Database Schema

ฐานข้อมูลหลัก: **PostgreSQL 16 + PostGIS 3.4**, cache/stream: **Redis 7**
สคริปต์สร้างจริง: [`../db/schema.sql`](../db/schema.sql)

## 4.1 หลักการออกแบบ
- **Data minimization**: ข้อมูลสุขภาพ/ผู้ติดต่อฉุกเฉินแยกตารางและเข้ารหัสระดับ field
- **Soft delete + retention**: ใช้ `deleted_at`; ลบจริงตาม retention policy (ดู PDPA)
- **Append-only events**: `incident_events`, `audit_log` ไม่ UPDATE/DELETE
- **UUIDv7** เป็น PK (เรียงตามเวลา, dedupe ข้ามช่องทาง)
- **PostGIS geography(Point,4326)** สำหรับตำแหน่ง; geometry สำหรับ polygon อาคาร/geofence

## 4.2 แผนภาพความสัมพันธ์ (ER — ย่อ)
```
org_unit ──< person >── reports_to(person)
   │           │  1───1 person_health (encrypted)
   │           │  1───* emergency_contact
   │           │  1───* consent
   │           │  1───* device
   │
incident >── reported_by(person)
   │  *───1 incident_type
   │  1───* incident_event   (append-only timeline)
   │  1───* incident_assignment >── responder(person)
   │  1───* incident_location  (GPS / indoor / last-known)
   │  1───* attachment
   │  1───* notification_log
location_ref: building / floor / room / beacon / qr_checkpoint
audit_log (append-only)   ·   broadcast   ·   sync_outbox_receipt
```

## 4.3 ตารางหลัก (สรุปฟิลด์สำคัญ)

### `org_unit` — โครงสร้างหน่วยงาน
`id, code, name, parent_id, path (ltree), created_at`

### `person` — บุคลากร (sync จาก HR, read-mostly)
`id, employee_code, full_name, position, org_unit_id, phone, email,
 reports_to_id, work_location_id, source_system, external_id,
 status, synced_at, created_at, updated_at, deleted_at`
> ข้อมูลอ่อนไหวไม่อยู่ที่นี่ — แยกไป `person_health`

### `person_health` — ข้อมูลสุขภาพ (Sensitive, encrypted)
`person_id PK/FK, blood_type, chronic_conditions(enc), allergies(enc),
 medications(enc), notes(enc), consent_id, updated_at`
> เก็บเฉพาะที่ **ยินยอม**; เข้ารหัสด้วย app-level envelope encryption (KMS)

### `emergency_contact` — ผู้ติดต่อฉุกเฉิน
`id, person_id, name, relationship, phone(enc), email(enc),
 priority, consent_id, created_at, deleted_at`

### `consent` — ความยินยอม (PDPA)
`id, person_id, purpose, scope (jsonb), legal_basis, granted, version,
 granted_at, revoked_at, source_ip, created_at`

### `device` — อุปกรณ์ของผู้ใช้
`id, person_id, platform, push_token, app_version, last_seen_at,
 capabilities (jsonb: ble/wifi_direct/lora/satellite), trusted, created_at`

### `incident_type` — ประเภทเหตุ
`id, code, name_th, name_en, default_severity, icon, sort_order, active`
> seed: medical, accident, security_threat, fire, flood, trapped, general, other

### `incident` — เหตุการณ์ (core)
`id (UUIDv7), incident_uuid (client-generated, unique), reported_by_id,
 type_id, severity, status, channel_first, channels (jsonb),
 battery_pct, network_status, is_test, primary_location_id,
 created_at, acknowledged_at, resolved_at, closed_at, deleted_at`
- `status`: `new → acknowledged → dispatched → enroute → onsite → resolved → closed` (+ `canceled`)
- `severity`: `critical | high | medium | low`

### `incident_location` — ตำแหน่งที่บันทึก (หลายจุด/ต่อเนื่อง)
`id, incident_id, geom geography(Point,4326), accuracy_m, source
 (gps|beacon|wifi|qr|manual|last_known), building_id, floor, room,
 captured_at, is_last_known`

### `incident_event` — ไทม์ไลน์ (append-only)
`id, incident_id, actor_id, event_type, detail (jsonb), channel, created_at`
> event_type: created, location_update, status_change, note, assignment, notification, broadcast, sync_merged

### `incident_assignment` — การมอบหมาย/รับเคส
`id, incident_id, responder_id, role, assigned_by, assigned_at,
 accepted_at, arrived_at, released_at, outcome`

### `attachment` — ไฟล์แนบ
`id, incident_id, uploaded_by, object_key, mime, size, kind, created_at`

### `notification_log` — บันทึกการแจ้งเตือน
`id, incident_id, channel (push|sms|line|email|dashboard), target_person_id,
 target_addr_masked, status, provider_ref, error, sent_at`

### `broadcast` — ประกาศ/แจ้งเตือนกลุ่ม
`id, created_by, title, body, audience (jsonb: org_unit/geofence), geofence geometry,
 severity, sent_at, expires_at`

### `location_ref` — จุดอ้างอิงในอาคาร
`id, kind (building|floor|room|beacon|qr), code, name, parent_id,
 geom geometry, beacon_uuid, major, minor, floor_no`

### `audit_log` — บันทึกการเข้าถึง (append-only, WORM)
`id, actor_id, action, resource_type, resource_id, purpose,
 fields_accessed (jsonb), ip, user_agent, request_id, created_at`
> บันทึก **ทุกครั้ง** ที่มีการเข้าถึงข้อมูลสุขภาพ/ผู้ติดต่อ/บุคลากร

### `sync_outbox_receipt` — กันส่งซ้ำจาก offline
`incident_uuid PK, first_seen_channel, first_seen_at, merged_incident_id`

## 4.4 ดัชนีสำคัญ (Indexes)
- `incident (status, created_at desc)` — Dashboard list
- `incident (reported_by_id, created_at desc)` — ประวัติของผู้ใช้
- GiST: `incident_location USING gist(geom)`, `location_ref USING gist(geom)`, `broadcast USING gist(geofence)`
- `incident_event (incident_id, created_at)` — timeline
- unique: `incident (incident_uuid)`, `sync_outbox_receipt(incident_uuid)`
- GIN: `consent (scope)`, `device (capabilities)`

## 4.5 Redis (โครงสร้างใช้งาน)
| Key/Stream | ใช้ทำอะไร |
|------------|-----------|
| `stream:incidents` | event bus (incident.created/updated) — consumer groups |
| `pubsub:rt:{scope}` | realtime fan-out ไป dashboard/แอป |
| `sess:{token}` | session cache |
| `ratelimit:{ip}` / `ratelimit:sos:{person}` | กัน abuse / กัน spam SOS |
| `dedupe:{incident_uuid}` | TTL dedupe window ข้ามช่องทาง |
| `presence:{person}` | online/last-seen |

## 4.6 Retention & Encryption (สรุป — ดู PDPA)
- ข้อมูลสุขภาพ/ผู้ติดต่อ: field-level encryption (AES-256-GCM, key ใน KMS/Vault, envelope)
- Incident operational data: เก็บตาม retention (เช่น 2 ปี) แล้ว anonymize
- Audit log: เก็บ ≥ ตามกฎหมาย/นโยบาย (เช่น 1–2 ปี) บน WORM
- ทุกข้อมูล at-rest เข้ารหัสที่ระดับ storage (TDE/volume encryption) + sensitive fields เข้ารหัสซ้ำที่ app
