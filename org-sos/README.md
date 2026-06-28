# Organization SOS — ระบบแอปแจ้งขอความช่วยเหลือฉุกเฉินภายในองค์กร

เอกสารออกแบบระบบ (System Design Document) ฉบับสมบูรณ์สำหรับแอปพลิเคชันมือถือ
**“Organization SOS”** ที่ให้บุคลากรภายในองค์กรส่งสัญญาณขอความช่วยเหลือฉุกเฉินได้
ทั้งในสภาวะ **มีอินเทอร์เน็ต** และ **ไม่มีอินเทอร์เน็ต** (SMS / Bluetooth Mesh /
Wi-Fi Direct / Store & Forward / LoRa / Satellite)

> สถานะเอกสาร: **Design Baseline v1.0** — พร้อมใช้เป็น Blueprint สำหรับการพัฒนา MVP
> ขอบเขต: บุคลากรภายในองค์กร (พนักงาน, หัวหน้างาน, จนท.รปภ., ศูนย์ควบคุม/แอดมิน)

---

## สารบัญเอกสาร (Deliverables)

| # | เอกสาร | คำอธิบาย |
|---|--------|----------|
| 01 | [System Concept](docs/01-system-concept.md) | แนวคิด เป้าหมาย ขอบเขต หลักการออกแบบ และ KPI |
| 02 | [User Journey](docs/02-user-journey.md) | เส้นทางผู้ใช้ 4 บทบาท + สถานการณ์จำลอง (Online/Offline) |
| 03 | [System Architecture](docs/03-system-architecture.md) | สถาปัตยกรรมระบบ, microservices, data flow, deployment |
| 04 | [Database Schema](docs/04-database-schema.md) | โครงสร้างฐานข้อมูล PostgreSQL + PostGIS + Redis |
| 05 | [API Design](docs/05-api-design.md) | REST/WebSocket API, สัญญา (contract), ตัวอย่าง payload |
| 06 | [Mobile App Screen Flow](docs/06-mobile-screen-flow.md) | ผังหน้าจอแอปมือถือ + state machine การส่ง SOS |
| 07 | [Web Dashboard Screen Flow](docs/07-web-dashboard-flow.md) | ผังหน้าจอ Dashboard ศูนย์ควบคุม + Dispatch |
| 08 | [Offline Communication Design](docs/08-offline-communication.md) | การออกแบบสื่อสารแบบไร้อินเทอร์เน็ต 6 ช่องทาง |
| 09 | [Security Design](docs/09-security-design.md) | สถาปัตยกรรมความปลอดภัย, การเข้ารหัส, RBAC, Audit |
| 10 | [PDPA Compliance](docs/10-pdpa-compliance.md) | การปฏิบัติตาม PDPA, ROPA, Consent, สิทธิเจ้าของข้อมูล |
| 11 | [Implementation Roadmap](docs/11-implementation-roadmap.md) | แผนพัฒนาเป็นเฟส (Phase 0–4) + timeline |
| 12 | [MVP Plan](docs/12-mvp-plan.md) | ขอบเขต MVP, In/Out scope, acceptance criteria |
| 13 | [Risk Analysis](docs/13-risk-analysis.md) | การวิเคราะห์ความเสี่ยง + มาตรการลดความเสี่ยง |
| 14 | [Cost Estimation](docs/14-cost-estimation.md) | ประมาณการต้นทุนพัฒนาและดำเนินงาน (CAPEX/OPEX) |
| 15 | [Maintenance Plan](docs/15-maintenance-plan.md) | แผนบำรุงรักษา, SLA, On-call, DR/Backup |

ไฟล์ประกอบ:
- [`db/schema.sql`](db/schema.sql) — สคริปต์สร้างตารางจริง (PostgreSQL 16 + PostGIS 3.4)

---

## ภาพรวมระบบ (1 หน้า)

```
┌──────────────┐     Online (HTTPS/WSS)      ┌─────────────────────────────┐
│  Mobile App  │ ──────────────────────────▶ │        Backend (K8s)        │
│ (Flutter)    │                             │ API GW · Auth · Incident ·  │
│  ┌─────────┐ │ ◀────── Push / WSS ──────── │ Notification · GIS · Audit  │
│  │ SOS BTN │ │                             └───────┬──────────┬──────────┘
│  └─────────┘ │                                     │          │
│  Offline ▼   │      SMS / BLE Mesh / Wi-Fi         │          │
│  ┌─────────┐ │      Direct / LoRa / Satellite      ▼          ▼
│  │ Outbox  │ │ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄▶  PostgreSQL   Redis (Stream/
│  └─────────┘ │   (Store & Forward เมื่อกลับมา       + PostGIS    Cache/PubSub)
└──────────────┘    มีสัญญาณ → sync เข้า Backend)
        ▲                                              │
        │ ผ่าน Relay/Gateway                           ▼
   เครื่องบุคลากรใกล้เคียง                    ┌─────────────────────┐
   (BLE Mesh / Wi-Fi Direct relay)          │  Web Dashboard      │
                                            │ (React) ศูนย์ควบคุม │
                                            │ Map · Dispatch ·    │
   HRIS / LDAP / AD / Entra ID / ───────────│ Report · Admin      │
   Google Workspace (ดึงข้อมูลบุคลากร)       └─────────────────────┘
```

**หลักการสำคัญ:** การแจ้ง SOS ต้อง **ส่งสำเร็จเสมอ** แม้ในสภาวะแย่ที่สุด
ระบบจึงออกแบบเป็น *multi-channel, offline-first, store-and-forward* และ
ระบุตัวตน/ตำแหน่งให้อัตโนมัติเพื่อลดภาระผู้แจ้งในวินาทีวิกฤต

## หลักการออกแบบหลัก (Design Tenets)
1. **Reliability over richness** — ส่งสัญญาณให้ถึงสำคัญกว่าฟีเจอร์สวยงาม
2. **Offline-first** — ทุก flow ต้องมีเส้นทางสำรองเมื่อไม่มีเน็ต
3. **Zero-friction trigger** — กดปุ่มเดียว (กดค้าง 3 วิ) ที่เหลือระบบจัดการเอง
4. **Privacy by design / by default** — PDPA ฝังตั้งแต่ schema และ default config
5. **Auditability** — ทุกการเข้าถึงข้อมูลส่วนบุคคล/สุขภาพถูกบันทึก
6. **Idempotency** — ข้อความ SOS ซ้ำจากหลายช่องทางต้อง dedupe เป็นเหตุเดียว

---

## เทคโนโลยีโดยสรุป
| ชั้น | เทคโนโลยี |
|------|-----------|
| Mobile | Flutter (Dart) — Android & iOS, background isolate, foreground service |
| Web | React + TypeScript + MapLibre GL |
| Backend | Node.js (NestJS) หรือ Go — microservices บน Kubernetes |
| Realtime | WebSocket (Socket.IO/native) + Redis Streams |
| DB | PostgreSQL 16 + PostGIS 3.4, Redis 7 |
| Auth | OIDC/SAML federation → Keycloak (broker ไป Entra ID / Google / LDAP) |
| Push | FCM (Android) / APNs (iOS) |
| SMS | SMS Gateway (SMPP/HTTP) ของผู้ให้บริการในประเทศ |
| IaC/Deploy | Docker, Helm, Terraform, GitHub Actions |
| Observability | Prometheus + Grafana + Loki + OpenTelemetry |

> รายละเอียดเชิงลึกอยู่ในเอกสารแต่ละฉบับในโฟลเดอร์ [`docs/`](docs/)
