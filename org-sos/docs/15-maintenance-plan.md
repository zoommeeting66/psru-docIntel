# 15 — Maintenance Plan

แผนบำรุงรักษาและดำเนินงานหลัง go-live เน้นความพร้อมใช้งานสูง (life-safety system)

## 15.1 ระดับการบำรุงรักษา
| ประเภท | กิจกรรม | ความถี่ |
|--------|---------|---------|
| Corrective | แก้ bug/incident จากการใช้งานจริง | ตามที่เกิด (ตาม SLA) |
| Preventive | patch OS/dependency, cert rotation, backup test | รายเดือน/รายไตรมาส |
| Adaptive | ปรับตาม IdP/HR/provider เปลี่ยน, OS ใหม่ (Android/iOS) | ตามการเปลี่ยนแปลง |
| Perfective | ปรับปรุง UX/performance, ฟีเจอร์ย่อย | ตาม roadmap/feedback |

## 15.2 SLA / SLO เป้าหมาย
| ตัวชี้วัด | เป้าหมาย |
|-----------|----------|
| Availability (core SOS path) | ≥ 99.9%/เดือน |
| ความสำเร็จส่งสัญญาณ (≥1 ช่องทาง) | ≥ 99.9% |
| P95 latency กด→ศูนย์เห็น (online) | ≤ 5 วิ |
| RPO (data loss สูงสุด) | ≤ 5 นาที (PITR) |
| RTO (กู้คืนระบบ) | ≤ 1 ชม. (core), ≤ 4 ชม. (full) |

## 15.3 Severity & เวลาตอบสนอง (Production Incident)
| Sev | นิยาม | Response | Resolve เป้าหมาย |
|-----|-------|----------|-------------------|
| Sev1 | SOS ส่ง/รับไม่ได้ (ระบบหลักล่ม) | ทันที (24/7 on-call) | ≤ 1 ชม. workaround |
| Sev2 | ฟีเจอร์หลักเสีย (dispatch/notify) | ≤ 30 นาที | ≤ 4 ชม. |
| Sev3 | ฟีเจอร์รองเสีย/degrade | ≤ 4 ชม. (เวลาทำการ) | ≤ 2 วัน |
| Sev4 | ปัญหาเล็ก/cosmetic | ตามคิว | sprint ถัดไป |
> ระบบนี้เกี่ยวกับชีวิต → Sev1 ต้องมี **on-call 24/7** + escalation chain ชัดเจน

## 15.4 On-call & Escalation
- Rotation on-call (primary/secondary) + PagerDuty/Opsgenie
- Escalation: on-call → tech lead → engineering manager → vendor (ถ้าจำเป็น)
- Runbooks ต่อสถานการณ์: ระบบล่ม, DB failover, provider ล่ม, data breach, dedupe ผิดพลาด

## 15.5 Monitoring & Alerting
- **Golden signals**: latency, traffic, errors, saturation ต่อ service
- **Business alerts**: เคสค้างไม่ acknowledge เกิน SLA, success rate ตก, SMS provider error สูง
- **Security alerts**: audit anomaly (เข้าถึงข้อมูลสุขภาพผิดปกติ, export มาก, login fail ซ้ำ)
- Synthetic monitoring: ส่ง test SOS (is_test=true) เป็นระยะ → วัด E2E health
- Dashboards: Grafana (system) + business KPI dashboard

## 15.6 Backup & Disaster Recovery
- PostgreSQL: PITR + daily snapshot, สำเนา cross-region (encrypted)
- Redis: ใช้ replica + AOF (ข้อมูลส่วนใหญ่ ephemeral; แหล่งจริงคือ Postgres)
- Object storage: versioning + cross-region replication
- Audit log: WORM/immutable copy
- **DR drill**: ทดสอบ restore + failover **อย่างน้อยทุก 6 เดือน**; วัด RTO/RPO จริง
- ทดสอบ backup restore ทุกเดือน (อย่าเชื่อ backup ที่ไม่เคย restore)

## 15.7 Release & Change Management
- CI/CD: staging → prod (manual approval สำหรับ prod)
- Blue-green / canary deploy สำหรับ backend; feature flags
- Mobile: phased rollout (store staged release) + forced-update policy สำหรับ security fix
- Backward-compatible API (versioned); deprecate อย่างมีแผน
- Change advisory สำหรับการเปลี่ยนที่กระทบ life-safety path
- Schema migration: backward-compatible, มี rollback plan

## 15.8 Mobile-specific Maintenance
- ตาม OS ใหม่ (Android/iOS รายปี) — ทดสอบ background/permission/BLE ทุกเวอร์ชัน
- ตรวจ deprecation ของ FCM/APNs/permission API
- App store compliance (privacy nutrition label, permission justification)
- Crash monitoring (Sentry/Crashlytics) + ANR tracking

## 15.9 Data & Compliance Maintenance
- รัน retention/anonymize job อัตโนมัติ + ตรวจผล
- ทบทวน consent version เมื่อนโยบายเปลี่ยน → re-consent flow
- DSAR backlog review; audit log review รายเดือนโดย DPO/Security
- ทบทวน DPIA/ROPA เมื่อมีฟีเจอร์/integration ใหม่
- Access review (RBAC) รายไตรมาส — ถอนสิทธิ์ที่ไม่จำเป็น

## 15.10 Documentation & Knowledge
- ปรับเอกสารชุดนี้ให้ตรงกับระบบจริงทุก release สำคัญ (docs-as-code ใน repo)
- Runbooks + architecture decision records (ADR) + on-call playbook
- Postmortem (blameless) ทุก Sev1/Sev2 → action items ติดตามจนปิด

## 15.11 Continuous Improvement
- ทบทวน KPI/SLO รายเดือน; ปรับ capacity ตามการใช้งานจริง
- เก็บ feedback จากศูนย์ควบคุม/responder/บุคลากร → backlog
- ประเมินการเพิ่มช่องทาง offline (BLE/LoRa/satellite) ตามพื้นที่อับสัญญาณที่พบจริง
- Pen-test + security review รายปี; อัปเดต threat model
