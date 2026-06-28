# 09 — Security Design

หลักการ: **Defense in depth · Least privilege · Zero trust between services · Secure by default**

## 9.1 Identity & Authentication
- **SSO/Federation**: Login ด้วยบัญชีองค์กรผ่าน OIDC/SAML → Keycloak broker ไป
  Entra ID / Google Workspace / LDAP / AD (ไม่เก็บรหัสผ่านเอง)
- **Token**: JWT access (อายุสั้น 15 นาที) + refresh (rotating); claims มี role/scope/org_unit
- **MFA**: บังคับสำหรับ control/admin (ผ่านนโยบาย IdP)
- **Device binding**: ผูก device + push token; ตรวจ anomaly (อุปกรณ์ใหม่ = แจ้งเตือน)
- **Service-to-service**: mTLS + short-lived service tokens (SPIFFE/Vault)

## 9.2 Authorization (RBAC)
| Role | ขอบเขตข้อมูล | สิทธิ์หลัก |
|------|---------------|-----------|
| `employee` | ตนเอง | สร้าง SOS, ดู/แก้ profile+consent ของตน, ดูประวัติตน |
| `supervisor` | ผู้ใต้บังคับบัญชา (ตาม org tree) | ดู/ติดตามเคสในสังกัด |
| `responder` | เคสที่ได้รับมอบหมาย + need-to-know | รับเคส, อัปเดตสถานะภาคสนาม |
| `control` | ทุกเคส | dispatch, broadcast, จัดการเคส |
| `admin` | ระบบ + ผู้ใช้ | จัดการผู้ใช้/บทบาท/ตั้งค่า |
| `dpo` | audit + คำขอสิทธิ | ดู audit, จัดการ DSAR (ไม่เห็นเนื้อหาปฏิบัติการ) |
- **Attribute-based เพิ่มเติม**: scope ตาม org_unit/geofence; ข้อมูลสุขภาพต้องผ่าน purpose check
- บังคับใช้ที่ **API Gateway + Service layer + Row-Level Security (PostgreSQL RLS)** สามชั้น

## 9.3 Data Protection
| ระดับ | มาตรการ |
|-------|---------|
| In transit | TLS 1.3 ทุก hop (client↔GW, service↔service mTLS), HSTS, cert pinning ฝั่งแอป |
| At rest (storage) | volume/TDE encryption, object storage SSE |
| At rest (sensitive fields) | **app-level envelope encryption** (AES-256-GCM, DEK ต่อ record, KEK ใน KMS/Vault) สำหรับ health, emergency_contact, masked PII |
| In use | least-privilege query, RLS, field masking ตาม role/purpose |
| Local (mobile) | Outbox + cache เข้ารหัส (sqlcipher), keystore/secure-enclave สำหรับ key, no PII ใน log |
| Offline relay | payload เซ็น HMAC; relay node เห็นแค่ minimal fields (ไม่มี health/PII) |

## 9.4 Key Management
- KMS/HSM (cloud KMS หรือ HashiCorp Vault Transit) เก็บ KEK
- Envelope: data → DEK(AES-GCM) → DEK ห่อด้วย KEK; rotation KEK ตามรอบ + re-wrap
- แยก key ต่อ environment; ไม่มี key/secret ใน source repo (ใช้ Sealed Secrets/Vault)

## 9.5 Application Security
- Input validation + output encoding (กัน XSS/SQLi); ORM พร้อม parameterized queries
- Rate limiting + bot/abuse protection (กัน SOS spam: limit ต่อ person + cancel window)
- CSRF protection (web), secure cookies (HttpOnly, SameSite, Secure)
- Content Security Policy บน dashboard
- File upload: scan, content-type allowlist, presigned URL, แยก bucket
- Dependency scanning (SCA), SAST, DAST, container image scan ใน CI
- Secrets scanning (กัน leak), pre-commit hooks

## 9.6 Network & Infrastructure
- WAF หน้าระบบ; private subnet สำหรับ DB/Redis; network policy (deny-by-default) ใน K8s
- `/internal/*` ingest endpoints เข้าถึงเฉพาะภายใน (mTLS + IP allowlist + signed payload)
- Bastion/Just-in-time access สำหรับ ops; ไม่มี SSH ตรงสู่ prod
- DDoS protection ที่ edge

## 9.7 Audit & Monitoring
- **Audit log (append-only, WORM)**: บันทึกทุกการเข้าถึงข้อมูลบุคลากร/สุขภาพ/ผู้ติดต่อ
  (actor, action, resource, **purpose**, fields_accessed, ip, request_id, time)
- SIEM integration; alert on: เข้าถึงข้อมูลสุขภาพผิดปกติ, export จำนวนมาก, login ผิดพลาดซ้ำ, privilege change
- Tamper-evidence: hash chain หรือ WORM bucket สำหรับ audit
- ทุก request มี `request_id` (trace) เชื่อม audit ↔ observability

## 9.8 Secure SDLC & Operations
- Threat modeling (STRIDE) ต่อ service หลัก; review ก่อน release ฟีเจอร์ใหม่
- Least-privilege CI/CD; signed artifacts; SBOM
- Penetration test ก่อน go-live + รายปี
- Incident response runbook + breach notification process (เชื่อมกับ PDPA §10)
- Backup เข้ารหัส + ทดสอบ restore (ดู maintenance §15)

## 9.9 Threat Model (สรุป STRIDE)
| ภัย | ตัวอย่าง | มาตรการ |
|-----|----------|----------|
| Spoofing | ปลอมเป็นผู้แจ้ง/relay | JWT, HMAC payload, device binding |
| Tampering | แก้ payload offline | signed payload, audit hash chain |
| Repudiation | ปฏิเสธการกระทำ | audit log append-only + request_id |
| Information disclosure | รั่วข้อมูลสุขภาพ | field encryption, need-to-know, RLS, audit |
| Denial of service | spam SOS / flood API | rate limit, WAF, autoscale, queue |
| Elevation of privilege | ยกระดับสิทธิ์ | RBAC 3 ชั้น, RLS, MFA, JIT access |

## 9.10 ความสมดุล: ความปลอดภัย vs ความเร่งด่วน (vital interest)
ในภาวะวิกฤต ระบบต้อง **ไม่ขวางการช่วยชีวิต**:
- ข้อมูลสุขภาพที่ "จำเป็นต่อการช่วยเหลือ" เปิดให้ responder ที่รับเคสได้ตาม
  **vital interest / consent** — แต่ทุกครั้งบันทึก audit + แสดงเหตุผล (purpose)
- ปุ่ม SOS ทำงานได้แม้ session หมดอายุชั่วคราว (cached identity) เพื่อไม่ให้พลาดเหตุ
