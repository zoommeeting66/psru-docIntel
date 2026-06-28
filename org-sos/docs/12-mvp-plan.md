# 12 — MVP Plan

เป้าหมาย MVP: พิสูจน์ **คุณค่าหลัก** — "กดปุ่มเดียว ศูนย์ควบคุมรู้ทันที ใคร/ที่ไหน/เหตุอะไร
และ dispatch ช่วยเหลือได้" บนเส้นทาง **online + store&forward + SMS** ภายใน ~8–10 สัปดาห์

## 12.1 หลักการตัดขอบเขต
- เลือกช่องทางที่ครอบคลุมเคสจริง ~95%: **Online + Store&Forward + SMS fallback**
- เลื่อน BLE Mesh/Wi-Fi Direct/LoRa/Satellite ไปเฟส 2–3 (ซับซ้อน, ต้องทดสอบภาคสนาม/hardware)
- ทำ PDPA/Security แกนหลักให้ครบตั้งแต่ MVP (consent, encryption, audit, RBAC) — ไม่เลื่อน

## 12.2 In Scope (MVP)
**Mobile**
- Login SSO (บัญชีองค์กร)
- Consent & permissions (health/contacts/location)
- ปุ่ม SOS (กดค้าง 3 วิ, สั่น/เสียง, cancel window 15 วิ)
- เลือกประเภทเหตุ (8 ประเภท) + ส่งทันที
- แนบอัตโนมัติ: ตัวตน, หน่วยงาน, GPS, แบต, เน็ต, เวลา, ช่องทาง
- สถานะการส่ง + ติดตามเคส real-time
- Store & Forward (retry online) + SMS fallback (Android อัตโนมัติ / iOS compose)
- ข้อมูลฉุกเฉินของฉัน + ผู้ติดต่อ + ประวัติการแจ้งเหตุ

**Backend**
- Auth (OIDC broker), JWT, RBAC
- HR connector (sync บุคลากร + สายบังคับบัญชา)
- Incident service: create, **dedupe (incident_uuid)**, state machine, timeline
- GIS: GPS → address/geocode
- Notification: Push (FCM/APNs) + SMS + Dashboard alert
- Audit log (append-only) ทุกการเข้าถึงข้อมูลอ่อนไหว
- Realtime hub (WSS) ไป dashboard

**Web Dashboard**
- Login + RBAC
- Dashboard รวม (KPI + live feed + เสียงเตือนเคสใหม่)
- Incident map (หมุดเคส) + list + filter
- Incident detail (timeline + ข้อมูลผู้แจ้ง + map + actions)
- Dispatch (assign responder) + เปลี่ยนสถานะ
- Audit view (admin/DPO) เบื้องต้น

## 12.3 Out of Scope (เลื่อนไปเฟสถัดไป)
- BLE Mesh / Wi-Fi Direct / LoRa / Satellite
- Indoor positioning (beacon/QR) — MVP ใช้ GPS + manual building เลือก
- Broadcast geofence, Report Center อัตโนมัติ, Analytics เชิงลึก
- LINE OA, Email notification (มี Push+SMS พอใน MVP)
- Offline map tiles, live location track ต่อเนื่อง (มี location ณ เวลาแจ้ง)

## 12.4 User Stories หลัก (ตัวอย่าง)
- ในฐานะบุคลากร ฉันกดค้างปุ่ม SOS 3 วิ เพื่อส่งขอความช่วยเหลือพร้อมตำแหน่ง โดยไม่ต้องกรอกข้อมูล
- ในฐานะบุคลากร เมื่อไม่มีเน็ต ฉันต้องการให้ระบบส่ง SMS / เก็บไว้ส่งทีหลังอัตโนมัติ
- ในฐานะศูนย์ควบคุม ฉันเห็นเคสใหม่เด้งพร้อมเสียง + ตำแหน่งบนแผนที่ภายในไม่กี่วินาที
- ในฐานะศูนย์ควบคุม ฉัน acknowledge และ assign responder แล้วติดตามสถานะจนปิดเหตุ
- ในฐานะ responder ฉันรับเคสและอัปเดตสถานะภาคสนาม
- ในฐานะ DPO ฉันตรวจสอบได้ว่าใครเข้าถึงข้อมูลสุขภาพของผู้แจ้งเมื่อใด เพื่อวัตถุประสงค์ใด

## 12.5 Acceptance Criteria (Definition of Done — MVP)
| ด้าน | เกณฑ์ |
|------|-------|
| Functional | ส่ง SOS online E2E สำเร็จ; SMS fallback ทำงานเมื่อ offline; dedupe เป็นเคสเดียว |
| Performance | กด → ศูนย์เห็นเคส P95 ≤ 5 วิ (online) |
| Reliability | store&forward ส่งสำเร็จเมื่อกลับมา online P95 ≤ 30 วิ |
| Security | RBAC + field encryption + audit ครบ; ผ่าน security review เบื้องต้น |
| PDPA | consent flow + masking + audit + notification ไม่มีข้อมูลอ่อนไหว |
| Quality | unit/integration test ครอบคลุม core paths; contract test API |
| Ops | observability (trace/metric/log) + alert เคสค้าง |

## 12.6 Demo Scenario (MVP acceptance demo)
1. พนักงาน login → ให้ consent → กดค้าง SOS เลือก "เจ็บป่วยฉุกเฉิน"
2. ศูนย์ควบคุมเห็นเคสเด้ง + เสียง + หมุดบนแผนที่ + ข้อมูลผู้แจ้ง (สุขภาพ masked)
3. ศูนย์ acknowledge → assign responder → responder รับเคส → onsite → resolved → closed
4. ปิด Wi-Fi/เน็ตที่เครื่องพนักงาน → กด SOS → ส่ง SMS + เก็บ outbox → เปิดเน็ต → sync เข้าเคสเดิม (ไม่ซ้ำ)
5. DPO เปิด audit เห็น log การเข้าถึงข้อมูลสุขภาพพร้อม purpose

## 12.7 ความเสี่ยงเฉพาะ MVP
- iOS SMS อัตโนมัติทำไม่ได้ → ใช้ pre-filled compose + เน้น store&forward
- HR data ไม่สมบูรณ์ → มี fallback กรอก/แก้ในแอป (ภายใต้ consent)
- ความแม่นยำ GPS ในอาคารต่ำ → MVP ให้เลือกอาคาร/ชั้น manual ได้
