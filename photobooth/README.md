# PSRU AI Virtual Photo Booth & VR Studio

ระบบถ่ายภาพเสมือนอัจฉริยะด้วย AI และฉากเสมือน (Virtual Reality) สำหรับมหาวิทยาลัยราชภัฏพิบูลสงคราม

> **แนวคิด:** "เพียงยืนหน้ากล้อง AI จะสร้างภาพระดับสตูดิโอในโลกเสมือนภายในไม่กี่วินาที — โดยไม่ต้องใช้ Green Screen"

---

## ภาพรวม (Overview)

แพลตฟอร์มนี้รวม **Computer Vision + Generative AI + XR** เข้าด้วยกัน เพื่อให้ผู้ใช้
(นักศึกษา บุคลากร แขกผู้มาเยือน) สามารถถ่ายภาพระดับสตูดิโอในฉากเสมือนของ PSRU
ได้ภายในไม่กี่วินาที ผ่าน Web Browser, Mobile และ Kiosk รวมถึงโหมด VR/360°

แพ็กเกจนี้เป็น **Solution Blueprint + Working Prototype** ครอบคลุมผลลัพธ์ที่ร้องขอทั้ง 18 รายการ

## โครงสร้างเอกสาร (Deliverables Map)

| # | ผลลัพธ์ที่ต้องสร้าง | ไฟล์ |
|---|--------------------|------|
| 1 | System Architecture | [`docs/01-system-architecture.md`](docs/01-system-architecture.md) |
| 2 | ER Diagram | [`docs/02-database-design.md`](docs/02-database-design.md) · [`schema.sql`](schema.sql) |
| 3 | Database Design | [`docs/02-database-design.md`](docs/02-database-design.md) · [`schema.sql`](schema.sql) |
| 4 | REST API Specification | [`docs/03-api-specification.md`](docs/03-api-specification.md) · [`openapi.yaml`](openapi.yaml) |
| 5 | UI/UX Prototype | [`index.html`](index.html) (เปิดในเบราว์เซอร์) |
| 6 | AI Workflow Diagram | [`docs/04-ai-workflow.md`](docs/04-ai-workflow.md) |
| 7 | VR Scene Library | [`docs/05-vr-scene-library.md`](docs/05-vr-scene-library.md) |
| 8 | Administrator Dashboard | [`index.html`](index.html) (มุมมอง Admin) + [`docs/01`](docs/01-system-architecture.md) |
| 9 | Executive Dashboard | [`index.html`](index.html) (มุมมอง Executive) |
| 10 | Mobile Application | [`index.html`](index.html) (Responsive/PWA) + [`docs/01`](docs/01-system-architecture.md) |
| 11 | Kiosk Interface | [`index.html`](index.html) (Kiosk Mode) |
| 12 | Branding Guideline | [`docs/08-branding-guideline.md`](docs/08-branding-guideline.md) |
| 13 | Deployment Architecture | [`docs/07-deployment-architecture.md`](docs/07-deployment-architecture.md) |
| 14 | Security Architecture | [`docs/06-security-architecture.md`](docs/06-security-architecture.md) |
| 15 | Cost Estimation | [`docs/09-cost-estimation.md`](docs/09-cost-estimation.md) |
| 16 | Implementation Roadmap (Phase 1–3) | [`docs/10-roadmap-kpi-maintenance.md`](docs/10-roadmap-kpi-maintenance.md) |
| 17 | KPI และตัวชี้วัดความสำเร็จ | [`docs/10-roadmap-kpi-maintenance.md`](docs/10-roadmap-kpi-maintenance.md) |
| 18 | แผนบำรุงรักษา/ขยายระบบ | [`docs/10-roadmap-kpi-maintenance.md`](docs/10-roadmap-kpi-maintenance.md) |

## เริ่มต้นใช้งานต้นแบบ (Prototype)

```bash
# เปิดต้นแบบ UI/UX (ไม่ต้องติดตั้งอะไร)
open photobooth/index.html      # macOS
xdg-open photobooth/index.html  # Linux
```

ต้นแบบเป็น HTML ไฟล์เดียว (Tailwind CDN) สาธิต flow ครบ: Kiosk capture → เลือกฉาก →
AI processing → ผลลัพธ์/Branding → Executive Dashboard → Administrator Console
รองรับ Touch Screen / Kiosk / Mobile

## Technology Stack (สรุป)

| ชั้น | เทคโนโลยี |
|------|-----------|
| Frontend | Next.js (React, TypeScript), Tailwind, Three.js / WebXR |
| Backend (API/Orchestration) | FastAPI (Python), Node.js (BFF/realtime) |
| AI / CV | MediaPipe, YOLOv8, SAM 2 (Segment Anything), Face Mesh, SDXL/Diffusion + ControlNet, IC-Light (Relighting) |
| 3D / VR | Unreal Engine / Unity (scene authoring), glTF/USDZ, OpenXR/WebXR |
| Data | PostgreSQL, Redis, Object Storage (S3/MinIO), pgvector |
| Infra | Docker, Kubernetes (+ GPU nodes), CDN, NVIDIA Triton |

## หลักจริยธรรม & การปฏิบัติตามกฎหมาย

- **PDPA:** เก็บภาพ/ข้อมูลชีวมิติเฉพาะเมื่อได้รับ **ความยินยอมชัดแจ้ง (explicit consent)**
  พร้อมสิทธิ์ลบ และนโยบายเก็บรักษาแบบมีกำหนดอายุ (TTL)
- **การวิเคราะห์เพศ/อายุ** ทำต่อเมื่อผู้ใช้ยินยอมเท่านั้น และไม่ใช้เพื่อการตัดสินใจที่กระทบสิทธิ์
- **ฉากเชิงสัญลักษณ์** (เช่น พระราชวัง) ใช้เพื่อการประชาสัมพันธ์เชิงเกียรติยศเท่านั้น
  มี Guardrail กันการสร้างภาพที่อาจก่อให้เกิดความเข้าใจผิด
- **Watermark + Audit Trail** ติดทุกภาพที่ส่งออก เพื่อความโปร่งใสและตรวจสอบย้อนกลับได้

ดูรายละเอียดที่ [`docs/06-security-architecture.md`](docs/06-security-architecture.md)
