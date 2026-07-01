# PSRU DocIntel — Backend API (Cloudflare Workers + D1)

Backend จริงสำหรับระบบ DocIntel รอบที่ 1: **เอกสาร + ค้นหา**
สถาปัตยกรรม: Cloudflare Worker (REST API) + D1 (ฐานข้อมูล SQLite) + FTS5 trigram (ค้นหาภาษาไทย)

## สถานะที่จัดเตรียมไว้แล้ว
- ✅ สร้างฐานข้อมูล D1 จริงแล้ว: `psru-docintel` (region APAC)
  `database_id = 8f703ec8-f778-444a-ba4a-abb625ae3002`
- ✅ สร้าง schema + ใส่ข้อมูลตัวอย่าง 8 เอกสาร + ความสัมพันธ์ + ข้อ/section แล้ว
- ✅ ทดสอบค้นหาภาษาไทยผ่าน FTS5 trigram สำเร็จ
- ⏳ เหลือขั้นตอนเดียว: **deploy ตัว Worker** (รันจากเครื่องคุณ — ดูด้านล่าง)

> หมายเหตุ: การ deploy Worker ต้องทำจากเครื่องที่ล็อกอิน `wrangler` ของบัญชี Cloudflare เดียวกัน
> (ผม provision ฐานข้อมูลให้แล้วผ่าน API แต่ deploy โค้ด Worker จากในเซสชันไม่ได้)

## วิธี Deploy (ครั้งแรก)

```bash
cd backend
npm install
npx wrangler login          # ล็อกอินบัญชี Cloudflare (เปิดเบราว์เซอร์ครั้งเดียว)

# (ข้ามได้ถ้าใช้ฐานข้อมูลที่ผมตั้งให้แล้ว) ถ้าต้องการ re-init เอง:
# npm run db:init           # = db:schema + db:seed (--remote)

npm run deploy              # = wrangler deploy
```

หลัง deploy จะได้ URL เช่น
`https://psru-docintel-api.<your-subdomain>.workers.dev`

## เชื่อม Frontend เข้ากับ API จริง
1. เปิดไฟล์ `doc-intelligence.html` (หรือ `index.html` บน GitHub Pages)
2. แก้บรรทัด `const API_BASE = '';` ให้เป็น URL ของ Worker:
   ```js
   const API_BASE = 'https://psru-docintel-api.<your-subdomain>.workers.dev';
   ```
3. บันทึก/อัปโหลดทับ — หน้าเว็บจะดึงเอกสารจากฐานข้อมูล D1 จริงทันที
   (ถ้า API ล่ม จะ fallback กลับไปใช้ข้อมูลตัวอย่างอัตโนมัติ)

## API Endpoints
| Method | Path | คำอธิบาย |
|--------|------|----------|
| GET | `/api/health` | ตรวจสถานะระบบ |
| GET | `/api/stats` | สถิติสำหรับ Dashboard (รวม/ตามสถานะ/ประเภท/ปี/ความเสี่ยง) |
| GET | `/api/documents` | รายการเอกสาร + ตัวกรอง `?type=&status=&year=&org=&q=&limit=&offset=` |
| GET | `/api/documents/:id` | รายละเอียดเอกสาร + ความสัมพันธ์ + ข้อ/section (นับวิว +1) |
| POST | `/api/documents` | เพิ่มเอกสาร (body JSON: ต้องมี `id`,`title`,`document_type`) |
| PUT | `/api/documents/:id` | แก้ไขเอกสาร (ส่งเฉพาะฟิลด์ที่ต้องการแก้) |
| DELETE | `/api/documents/:id` | ลบเอกสาร |
| GET | `/api/search?q=` | ค้นหาเต็มข้อความ (FTS5 trigram, รองรับไทย) + snippet + rank |

ทุก endpoint เปิด CORS (`*`) เพื่อให้หน้าเว็บ static เรียกใช้ได้

## API แบบสำรวจผู้บริหาร (Executive Pulse — โหมดออนไลน์)
ใช้คู่กับ `executive-dashboard.html` เพื่อให้ผู้บริหาร “กดส่งคำตอบแล้วเข้าระบบทันที” (ไม่ต้องส่งรหัสกลับ)

| Method | Path | คำอธิบาย |
|--------|------|----------|
| PUT/POST | `/api/surveys/:sid` | เผยแพร่/อัปเดตแบบสำรวจ (body: `label`,`deadline`,`activities[]`) |
| GET | `/api/surveys/:sid` | ดึงแบบสำรวจ + คำตอบทั้งหมด |
| POST | `/api/surveys/:sid/responses` | บันทึกคำตอบผู้ตอบ (body: `no`,`name`,`answers[]`) — ปฏิเสธ 403 ถ้าเลย `deadline` |
| GET | `/api/surveys/:sid/responses` | รายการคำตอบ (ผู้ดูแลใช้ปุ่ม “ดึงคำตอบจากระบบ”) |

**ติดตั้งตารางแบบสำรวจ (ครั้งเดียว ไม่กระทบตารางเอกสารเดิม):**
```bash
cd backend
npm run db:survey        # สร้างตาราง surveys + survey_responses (CREATE TABLE IF NOT EXISTS)
npm run deploy           # deploy Worker เวอร์ชันที่มี API แบบสำรวจ
```

**เปิดโหมดออนไลน์ในแดชบอร์ด:**
1. เปิด `executive-dashboard.html` → เมนู **สร้างแบบสำรวจ** (Backend URL ฝังไว้ในไฟล์แล้วเป็นค่าเริ่มต้น — ไม่ต้องตั้งเอง)
2. กด **ลิงก์ให้ตอบ** ของแบบสำรวจ → ระบบจะเผยแพร่ขึ้น Worker อัตโนมัติ แล้วให้**ลิงก์สั้น** (ฝังแค่รหัสแบบสำรวจ ไม่ใช่ข้อมูลทั้งหมด) สำหรับส่งให้ผู้บริหาร
3. ผู้บริหารเปิดลิงก์ เลือกชื่อ ติ๊ก แล้วกด **ส่งคำตอบ** → บันทึกเข้าระบบทันที
4. ดูผลได้ 2 ทาง:
   - กด **“ดูผลสด”** (ในหน้าต่างลิงก์ให้ตอบ) — เปิดหน้าสรุปผลแบบเรียลไทม์ทันที ไม่ต้องนำเข้าอะไร
   - หรือกลับมาที่แดชบอร์ด → **นำเข้าคำตอบ → ดึงคำตอบจากระบบ** เพื่อรวมผลเข้ากราฟ/เมทริกซ์/KPI ของแดชบอร์ดหลัก

> ถ้าล้างค่า Backend URL (ปิดโหมดออนไลน์เอง) ระบบจะกลับไปทำงานแบบออฟไลน์ (ผู้ตอบได้รหัสคำตอบส่งกลับให้ผู้ดูแลนำเข้า) อัตโนมัติ ลิงก์ในกรณีนี้จะยาวกว่าปกติเพราะต้องฝังข้อมูลแบบสำรวจทั้งหมดไว้ในตัวลิงก์

## ทดสอบเร็ว (หลัง deploy)
```bash
curl https://psru-docintel-api.<subdomain>.workers.dev/api/health
curl "https://psru-docintel-api.<subdomain>.workers.dev/api/search?q=จัดซื้อ"
curl "https://psru-docintel-api.<subdomain>.workers.dev/api/documents?status=active"
```

## โครงสร้างไฟล์
```
backend/
├── src/index.js     # Cloudflare Worker (REST API)
├── schema.sql       # โครงสร้างตาราง + FTS5 + triggers
├── seed.sql         # ข้อมูลตัวอย่าง
├── wrangler.toml    # ตั้งค่า Worker + binding D1
├── package.json     # สคริปต์ dev/deploy/db
└── README.md
```

## รอบถัดไป (Round 2 — ยังไม่ทำในรอบนี้)
- รวม **Claude API** สำหรับ AI Analyzer / Chat / สรุปอัตโนมัติ (ตาม AI Guardrails)
- **R2** เก็บไฟล์ PDF/เอกสารต้นฉบับ + **OCR pipeline**
- **Vectorize** สำหรับ semantic search เชิงความหมาย
- Authentication (RBAC) + Audit log
