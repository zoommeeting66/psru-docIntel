# 11 — Implementation Roadmap

แผนพัฒนาแบบเป็นเฟส เน้นส่งคุณค่าเร็ว (MVP ก่อน) แล้วต่อยอดช่องทาง offline และฟีเจอร์ขั้นสูง
สมมติทีม ~6–8 คน (PM, 2 backend, 2 mobile, 1 web, 1 DevOps/Sec, QA แชร์)

## 11.1 ภาพรวมเฟส
| เฟส | ชื่อ | ระยะ (โดยประมาณ) | ผลลัพธ์หลัก |
|-----|------|------------------|--------------|
| 0 | Discovery & Foundation | 3–4 สัปดาห์ | สถาปัตยกรรม, env, IdP/HR integration POC, DPIA เริ่มต้น |
| 1 | **MVP** (Core SOS Online) | 8–10 สัปดาห์ | กด SOS online + dashboard + dispatch + แจ้งเตือน + audit |
| 2 | Offline & Hardening | 6–8 สัปดาห์ | SMS + Store&Forward + BLE/Wi-Fi relay + indoor positioning |
| 3 | Scale & Advanced | 6–8 สัปดาห์ | LoRa/Satellite, broadcast, report center, analytics |
| 4 | Pilot → Rollout | 4–6 สัปดาห์ | นำร่อง 1 หน่วยงาน → ปรับ → ขยายทั้งองค์กร |

## 11.2 Phase 0 — Discovery & Foundation
- ยืนยัน requirement, สถาปัตยกรรม, tech stack, security/PDPA baseline
- ตั้ง repo, CI/CD, IaC, env (dev/staging), observability skeleton
- POC: เชื่อม IdP (Entra/Google/LDAP) + HR data connector (sync ทดลอง)
- DPIA ฉบับร่าง + กำหนด consent flow + retention policy
- Deliverables: ADRs, OpenAPI ร่าง, schema v1, threat model เริ่มต้น

## 11.3 Phase 1 — MVP (รายละเอียดใน [12-mvp-plan](12-mvp-plan.md))
- Mobile: Login SSO, Consent, ปุ่ม SOS (online), ประเภทเหตุ, สถานะ, ประวัติ
- Backend: Auth, Incident service (create/dedupe/state machine), Notification (Push+SMS),
  GIS (GPS→address), Audit, Realtime hub
- Web: Dashboard, Incident list/map/detail, Dispatch, basic admin
- Store & Forward เวอร์ชันพื้นฐาน (online retry) + Push/SMS แจ้งเตือน
- Exit criteria: ส่ง SOS online สำเร็จ end-to-end + ศูนย์ dispatch + audit ครบ + ผ่าน security review เบื้องต้น

## 11.4 Phase 2 — Offline & Hardening
- SMS fallback เต็มรูปแบบ (inbound ingest + parse + merge)
- BLE Mesh relay + Wi-Fi Direct relay (Android ก่อน, iOS degrade)
- Indoor positioning: beacon + QR checkpoint + Wi-Fi positioning
- แผนที่ offline (tiles), live location, dedupe/merge หลายช่องทางสมบูรณ์
- Pen-test #1, performance/load test, chaos test เส้นทาง offline

## 11.5 Phase 3 — Scale & Advanced
- LoRa gateway integration + Satellite messaging (ตาม hardware ที่ลงทุน)
- Broadcast (org_unit/geofence), Report Center + after-action auto report
- Analytics dashboard, SLA tracking, LINE OA integration
- Multi-AZ HA, DR drill, autoscale tuning

## 11.6 Phase 4 — Pilot → Rollout
- นำร่อง 1 หน่วยงาน/อาคาร → เก็บ feedback, วัด KPI (response time, success rate)
- ปรับ UX, training บุคลากร/ศูนย์ควบคุม, จัดทำคู่มือ
- ขยายทีละหน่วยงาน (phased rollout) + on-call + monitoring เต็มรูปแบบ
- Go-live sign-off: PDPA (DPO), Security (pen-test pass), SLA readiness

## 11.7 Milestones & Gates
```
M0 Foundation ready ─▶ M1 MVP demo (online E2E) ─▶ M2 Offline proven ─▶
M3 Full features ─▶ M4 Pilot success ─▶ GA Rollout
แต่ละ gate: security review + PDPA check + KPI/acceptance ผ่าน
```

## 11.8 Workstream ขนาน
- **Security & PDPA**: ต่อเนื่องทุกเฟส (review, threat model update, audit)
- **HR/IdP integration**: เริ่ม P0, ทำให้เสถียร P1
- **Hardware (beacon/LoRa)**: จัดซื้อ/ติดตั้งคู่ขนาน P2–P3
- **Change management/training**: เริ่ม P3, เข้มข้น P4

## 11.9 Dependencies & Assumptions
- เข้าถึง IdP + HR system (API/connector) ได้ตั้งแต่ P0
- งบ hardware (beacon/LoRa) อนุมัติก่อน P2/P3
- ผู้ให้บริการ SMS gateway + LINE OA พร้อมก่อน P1/P3
- ทีมความปลอดภัย/DPO ร่วม review ตาม gate
