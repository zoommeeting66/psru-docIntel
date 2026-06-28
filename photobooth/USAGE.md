# คู่มือการใช้งานหน้าจอ (Usage Guide)

PSRU AI Virtual Photo Booth & VR Studio — วิธีเปิดและใช้งานแต่ละหน้าจอ

---

## A. มี 2 วิธีเปิดดูหน้าจอ

### วิธีที่ 1 — เร็วสุด (โหมดสาธิต / Mock) ไม่ต้องติดตั้งอะไร
เหมาะกับการดู UI/นำเสนอ ใช้ได้ทันที (รวมถึงบน GitHub Pages)

```bash
# เปิดไฟล์เดียวในเบราว์เซอร์
open photobooth/index.html        # macOS
xdg-open photobooth/index.html    # Linux
```
- มีเมนูบนสุด: **Kiosk · VR · Executive · Admin** กดสลับหน้าจอได้เลย
- ถ้าไม่ได้รัน backend จะขึ้น badge **"โหมดสาธิต (Mock)"** และทุกอย่างจำลองให้ครบ

### วิธีที่ 2 — ระบบจริง (Backend + Frontend)
เห็นภาพที่ AI สร้างจริง, ดาวน์โหลด/QR จริง, dashboard ข้อมูลจริง, login จริง

```bash
# 1) Backend (FastAPI)  → http://localhost:8000  (เอกสาร API: /docs)
cd photobooth/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload

# 2) Frontend (Next.js) → http://localhost:3000
cd photobooth/frontend
npm install
cp .env.local.example .env.local
npm run dev
```
เปิดเบราว์เซอร์ที่ **http://localhost:3000**
> เปิดผ่าน `localhost` เพื่อให้กล้อง (getUserMedia) ทำงาน; ถ้ากล้องไม่ได้ ระบบจะใช้ภาพจำลองให้อัตโนมัติ

---

## B. หน้าจอและวิธีใช้

### 1) หน้าแรก (Landing) — `/`
การ์ด 2 ใบ: **เริ่มถ่ายภาพ (Kiosk)** และ **Executive Dashboard** · มุมขวาบนมี badge สถานะ API และปุ่มเข้าสู่ระบบ

### 2) Kiosk — ถ่ายภาพ (`/kiosk`) — *ไม่ต้องล็อกอิน*
ทำตามแถบลำดับ 5 ขั้นด้านบน:
1. **ยินยอม (PDPA)** — ติ๊ก "วิเคราะห์ภาพ/ใบหน้า-ท่าทาง (จำเป็น)" → กด **ยอมรับและเริ่มต้น**
   (อีก 2 ข้อ: วิเคราะห์อายุ/เพศ และ ใช้ภาพประชาสัมพันธ์ = ไม่บังคับ)
2. **ถ่ายภาพ** — ยืนหน้ากล้อง เลือกโหมด เดี่ยว/หมู่ → กดปุ่ม **ถ่ายภาพ**
3. **เลือกฉาก/ชุด/เอฟเฟกต์** — เลือกฉากเสมือน (หอประชุม, พิธีรับปริญญา, ฯลฯ) + เครื่องแต่งกาย (ชุดครุย/สูท/ไทย…) + เอฟเฟกต์ (หิมะ/พลุ/confetti…) → กด **สร้างภาพด้วย AI**
4. **AI สร้างภาพ** — เห็นความคืบหน้ารายขั้นแบบเรียลไทม์ (ผ่าน WebSocket): Segmentation → Scene → Relighting → … → Branding
5. **ผลลัพธ์** — ได้ภาพพร้อมโลโก้/กรอบ/ลายน้ำ/หมายเลขภาพ + **QR สแกนดาวน์โหลด** · ปุ่ม PNG/PDF/แชร์ · ให้ดาว · กด **เริ่มใหม่** เพื่อรอบถัดไป

### 3) VR / 360° (`index.html` → เมนู VR)
แกลเลอรีฉากที่รองรับ VR — แต่ละการ์ดมีปุ่ม **WebXR** (เบราว์เซอร์) และ **Headset** (OpenXR)

### 4) Executive Dashboard (`/dashboard`) — *ต้องล็อกอิน*
- ถ้ายังไม่ล็อกอินจะเห็นการ์ด **เข้าสู่ระบบ** → เลือกบทบาท **Executive** (หรือ Admin)
- จากนั้นเห็น KPI จริง: จำนวน session, ภาพที่สร้าง, ดาวน์โหลด, ความพึงพอใจ, ฉากยอดนิยม, เวลาเรนเดอร์

### 5) Administrator Console (`index.html` → เมนู Admin)
แท็บจัดการ: **ฉาก · โลโก้/กรอบ/แบรนด์ · AI Prompt · Events · สิทธิ์ผู้ใช้ (RBAC) · Audit Log**
(ในระบบจริงผูกกับ API `/admin/*` ที่ต้องเป็น role admin)

---

## C. การเข้าสู่ระบบและบทบาท (Auth & RBAC)

โหมดสาธิต (dev): หน้า Dashboard มีการ์ดให้เลือกบทบาทเพื่อเข้าสู่ระบบ (ออก dev-token ให้อัตโนมัติ)

| บทบาท | เข้าถึงได้ |
|-------|-----------|
| **Kiosk/Guest** | ถ่ายภาพได้เลย ไม่ต้องล็อกอิน |
| **Executive** | Executive Dashboard / รายงาน |
| **Operator** | งานบูธ (session/capture/output) |
| **Admin** | ทุกอย่าง + จัดการฉาก/แบรนด์/prompt/ผู้ใช้ + Audit |

**ใช้ Keycloak จริง (production):**
```bash
cd photobooth/backend && docker compose up keycloak   # admin console: http://localhost:8080
# ผู้ใช้เดโมในรีลม psru (รหัสผ่าน = ชื่อผู้ใช้): admin / operator / executive
```
แล้วตั้ง `OIDC_ISSUER=http://localhost:8080/realms/psru` ในฝั่ง backend เพื่อเปิดโหมด OIDC

---

## D. ทดสอบเร็ว / ตรวจสุขภาพระบบ

```bash
# Backend health + เอกสาร API
curl http://localhost:8000/api/v1/health
open http://localhost:8000/docs            # Swagger UI ลองยิงทุก endpoint

# รันชุดทดสอบ
cd photobooth/backend && pytest -q          # 11 passed
cd photobooth/e2e && npm install && npm test # E2E เปิดเบราว์เซอร์ทดสอบ Kiosk flow ทั้งวงจร
```

## E. ปัญหาที่พบบ่อย
| อาการ | สาเหตุ/วิธีแก้ |
|-------|----------------|
| badge ขึ้น "โหมดสาธิต/ออฟไลน์" | ยังไม่ได้รัน backend หรือ `NEXT_PUBLIC_API_BASE` ไม่ตรง (ค่าเริ่มต้น `http://localhost:8000`) |
| กล้องไม่ขึ้น | ต้องเปิดผ่าน `http://localhost` หรือ HTTPS และอนุญาตสิทธิ์กล้อง — ถ้าไม่ได้ ระบบใช้ภาพจำลองแทน |
| Dashboard เข้าไม่ได้ | ต้องล็อกอินเป็น executive/admin ก่อน (RBAC) |
| ภาพผลลัพธ์ข้อความไทยเป็นกล่อง □ | Phase 1 ใช้ฟอนต์ที่ไม่มี glyph ไทยในภาพที่เรนเดอร์ — Phase 2 จะ bundle ฟอนต์ไทย (Sarabun) |
