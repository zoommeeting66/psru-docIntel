# PSRU Photo Booth — Frontend (Next.js + TypeScript)

Frontend จริงตาม stack ใน roadmap: **Next.js (App Router) + React + TypeScript + Tailwind**
เชื่อมกับ **Core API** (`photobooth/backend`) ด้วย typed client เต็มรูปแบบ

ธีม **PSRU Green / White / Gold** + Glassmorphism (ตาม [`../docs/08-branding-guideline.md`](../docs/08-branding-guideline.md))

## รัน

```bash
cd photobooth/frontend
npm install
cp .env.local.example .env.local          # NEXT_PUBLIC_API_BASE=http://localhost:8000
npm run dev                               # http://localhost:3000
```

ต้องรัน backend คู่กัน (ดู [`../backend/README.md`](../backend/README.md)):
```bash
cd ../backend && source .venv/bin/activate && uvicorn app.main:app --reload
```

## หน้าจอ (Routes)

| Route | คำอธิบาย |
|-------|----------|
| `/` | Landing |
| `/kiosk` | **Kiosk flow** เต็ม: Consent (PDPA) → ถ่ายภาพ (webcam) → เลือกฉาก/ชุด/FX → AI render (WebSocket progress) → ผลลัพธ์ + QR/ดาวน์โหลด/แชร์/ให้คะแนน |
| `/dashboard` | Executive Dashboard อ่านสถิติจริงจาก `/stats/overview` + `/stats/scenes` |

## โครงสร้าง

```
src/
├── app/
│   ├── layout.tsx          # fonts (Sarabun/Inter) + Header + Font Awesome
│   ├── page.tsx            # landing
│   ├── kiosk/page.tsx      # → <KioskFlow/>
│   ├── dashboard/page.tsx  # executive dashboard (client, fetch stats)
│   └── globals.css         # Tailwind + glass/gradient utilities
├── components/
│   ├── Header.tsx · ApiBadge.tsx · Stepper.tsx
│   └── kiosk/              # KioskFlow (orchestrator) + 5 step components
└── lib/
    ├── api.ts              # typed Core API client (NEXT_PUBLIC_API_BASE)
    ├── types.ts            # interfaces mirroring backend schemas
    ├── pipeline.ts         # stage labels (ตรงกับ backend STAGES) + FX
    └── sceneIcons.ts       # map ชื่อฉาก → ไอคอน
```

## สถาปัตยกรรม

- **Server Components** เป็นค่าเริ่มต้น; ใช้ `"use client"` เฉพาะส่วนที่มี state/กล้อง/fetch
- **KioskFlow** เป็น state machine (step 1–5) จัดการ session/capture/job และติดตาม progress ผ่าน
  **WebSocket** (`WS /api/v1/ws/jobs/{id}`) อัปเดตสถานะรายขั้นแบบเรียลไทม์
  หาก WS ใช้ไม่ได้จะ **fallback เป็น polling `GET /jobs/{id}`** อัตโนมัติ
- **Auth/RBAC:** `AuthProvider` (lib/auth.tsx) เก็บ token + แนบ bearer ให้ทุก request;
  หน้า `/dashboard` มี `LoginCard` (เลือก role → dev-token) — kiosk ไม่ต้องล็อกอิน;
  production เปลี่ยนเป็น Keycloak OIDC redirect
- **กล้อง:** `getUserMedia` (ต้องการ localhost/HTTPS) — ถ้าเปิดไม่ได้จะ fallback เป็นภาพจำลองอัตโนมัติ
- ภาพ output/QR เสิร์ฟจาก API โดยตรง (Phase 2: เปลี่ยนเป็น signed CDN URL)

## ตรวจสอบ

```bash
npm run build      # ✓ compiled + typechecked (6 routes)
npm run typecheck  # tsc --noEmit
```

## ความสัมพันธ์กับต้นแบบเดิม
`../index.html` เป็นต้นแบบไฟล์เดียว (Tailwind CDN) สำหรับสาธิตเร็ว ส่วนโฟลเดอร์นี้คือ
**โครงโปรดักชันจริง** ที่ component แยกไฟล์ + typed + build ได้ ใช้ต่อยอดสู่ production
