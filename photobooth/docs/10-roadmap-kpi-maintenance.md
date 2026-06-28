# 10. Implementation Roadmap · KPI · Maintenance & Scaling

## 10.1 Implementation Roadmap (Phase 1–3)

```mermaid
gantt
    title PSRU AI Virtual Photo Booth — Roadmap
    dateFormat  YYYY-MM
    section Phase 1 — MVP (เดือน 1–3)
    Core API + DB + Auth(SSO)            :2026-07, 1M
    Capture + Segmentation + 1 ฉาก       :2026-08, 1M
    Branding + Output(JPG/PNG) + QR      :2026-08, 1M
    Kiosk + Web prototype + UAT          :2026-09, 1M
    section Phase 2 — AI เต็มรูปแบบ (เดือน 4–7)
    Scene/Lighting/Perspective(SDXL+CN)  :2026-10, 2M
    Outfit + FX + Beauty + Pose recommend:2026-11, 2M
    Dashboard(Exec/Admin) + Stats        :2026-12, 1M
    PDPA/Audit/RBAC hardening            :2027-01, 1M
    section Phase 3 — VR/AR + Scale (เดือน 8–12)
    VR/360 + WebXR + Scene Library       :2027-02, 2M
    Mobile PWA + Social/Email/Cloud      :2027-03, 1M
    Autoscale GPU + Multi-event + DR     :2027-04, 2M
```

### Phase 1 — MVP / Proof of Value (เดือน 1–3)
- **เป้าหมาย:** ใช้งานจริงในงานเล็กได้ — ถ่าย → แยกพื้นหลัง → ฉากพื้นฐาน → branding → QR ดาวน์โหลด
- **ส่ง:** Core API, PostgreSQL, SSO, Segmentation (SAM2/MediaPipe), 3–5 ฉาก, Kiosk + Web, Consent/PDPA พื้นฐาน

### Phase 2 — AI เต็มรูปแบบ (เดือน 4–7)
- **เป้าหมาย:** คุณภาพระดับสตูดิโอ — Generative scene + relighting + perspective + outfit + beauty + FX
- **ส่ง:** SDXL+ControlNet pipeline, Triton serving, แนะนำท่าทาง/ฉาก, Executive & Admin Dashboard, RBAC/Audit เต็ม

### Phase 3 — VR/AR + Scale (เดือน 8–12)
- **เป้าหมาย:** VR/360, Mobile PWA, ช่องทาง output ครบ, รองรับอีเวนต์ใหญ่ + DR
- **ส่ง:** WebXR/OpenXR, VR Scene Library, autoscale GPU (KEDA + spot), multi-event, DR/backup test

## 10.2 KPI & ตัวชี้วัดความสำเร็จ

| มิติ | KPI | เป้าหมาย |
|------|-----|----------|
| ประสบการณ์ | เวลาเรนเดอร์เฉลี่ย (ภาพเดี่ยว) | ≤ 12 วินาที |
| ประสบการณ์ | เวลารวมต่อรอบใช้งาน (capture→ดาวน์โหลด) | ≤ 60 วินาที |
| คุณภาพ | คะแนนความพึงพอใจเฉลี่ย | ≥ 4.3 / 5 |
| คุณภาพ | อัตรา re-render/เรนเดอร์ใหม่ | ≤ 8% |
| การใช้งาน | จำนวนภาพ/อีเวนต์ | ตามเป้าแต่ละงาน |
| การใช้งาน | อัตราดาวน์โหลด/แชร์ต่อภาพ | ≥ 70% |
| ความเสถียร | Uptime ระบบ (ช่วงงาน) | ≥ 99.5% |
| ความเสถียร | Job failure rate | ≤ 2% |
| ความปลอดภัย | Consent completion ก่อนเก็บข้อมูล | 100% |
| ความปลอดภัย | เหตุละเมิดข้อมูล | 0 |
| คุณค่าองค์กร | การเข้าถึงสื่อประชาสัมพันธ์ PSRU | เพิ่มขึ้น YoY |

> Dashboard แสดง: จำนวนผู้ใช้, จำนวนภาพ, ฉากยอดนิยม, เวลาใช้งาน, ดาวน์โหลด, ความพึงพอใจ,
> Heatmap การใช้งาน, รายงานผู้บริหาร (ดูต้นแบบใน `index.html`)

## 10.3 แผนบำรุงรักษา (Maintenance)

| รอบ | งาน |
|-----|-----|
| รายวัน (ช่วงงาน) | เฝ้าระวัง queue/GPU, ตรวจ failed jobs, สำรอง DB |
| รายสัปดาห์ | อัปเดต patch/CVE, ตรวจ log/alert, รีวิว audit |
| รายเดือน | ทบทวน KPI/cost, ปรับ prompt/ฉากตาม feedback, ทดสอบ restore |
| รายไตรมาส | DR drill, อัปเกรดโมเดล/ไลบรารี, pen-test, ทบทวน PDPA/นโยบาย |
| ก่อนอีเวนต์ใหญ่ | load test, เตรียม burst GPU, ซ้อม operator, freeze deploy |

- **Model lifecycle:** เวอร์ชันโมเดลใน `ai_prompts.model_ref`; ทดสอบ A/B ก่อน rollout; เก็บโมเดลเดิมไว้ rollback
- **Content/ฉาก:** เพิ่มฉาก/แบรนด์ผ่าน Admin Console โดยไม่ต้อง deploy ใหม่
- **Support:** runbook + on-call ช่วงอีเวนต์

## 10.4 แผนขยายระบบในอนาคต (Future Scaling)

```mermaid
flowchart LR
    NOW["ฐานปัจจุบัน<br/>Photo Booth + VR"] --> A["Multi-campus / Multi-event<br/>หลายบูธพร้อมกัน"]
    NOW --> B["AI Video / Boomerang<br/>คลิปสั้นเสมือน"]
    NOW --> C["AR Filter (มือถือ)<br/>ใช้ฉาก PSRU แบบ realtime"]
    NOW --> D["Avatar / Metaverse<br/>PSRU Virtual Campus"]
    NOW --> E["Personalization<br/>แนะนำฉาก/ชุดด้วย embedding"]
    NOW --> F["Open API / Partner<br/>เชื่อมระบบงานทะเบียน/ศิษย์เก่า"]
```

- **แนวนอน:** เพิ่ม GPU node pool + KEDA รองรับหลายบูธ/หลายวิทยาเขตพร้อมกัน
- **ฟีเจอร์:** วิดีโอ AI สั้น, AR filter มือถือ, avatar/metaverse PSRU, แนะนำเฉพาะบุคคล
- **บูรณาการ:** เชื่อมระบบทะเบียน/ศิษย์เก่า/ประชาสัมพันธ์ ผ่าน Open API
- **Sustainability:** ใช้ GPU แบบ scale-to-zero + spot ลดต้นทุน/พลังงาน, รายงาน carbon ของการเรนเดอร์
