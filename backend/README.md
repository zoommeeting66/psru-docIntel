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
| POST | `/api/ai/analyze` | **Emergency SOS** — วิเคราะห์เหตุการณ์ด้วย Claude (proxy เก็บ API key ฝั่ง server) |

### `/api/ai/analyze` — Emergency SOS AI
Endpoint นี้เป็น proxy ไปยัง Claude API โดยเก็บ API key ไว้ฝั่ง Worker (เป็น secret)
เพื่อไม่ให้ key หลุดไปอยู่ในหน้าเว็บ static

**ตั้งค่า API key (ทำครั้งเดียว):**
```bash
cd backend
wrangler secret put ANTHROPIC_API_KEY   # วาง API key เมื่อถูกถาม
npm run deploy
```

**Request body (JSON):**
```json
{ "name": "สมชาย วงศ์ดี", "event": "น้ำท่วม", "status": "critical",
  "injury": "severe", "battery": 23, "channel": "Bluetooth Mesh",
  "hops": 3, "gpsAcc": 5 }
```
**Response:** `{ "analysis": "🔴 ระดับความเร่งด่วน: ..." }`
ใช้โมเดล `claude-opus-4-8` (แก้ได้ใน `src/index.js`; ใช้ `claude-sonnet-4-6` ได้หากต้องการลดต้นทุน)
ถ้ายังไม่ได้ตั้ง secret จะตอบ `503`

**เชื่อมหน้าเว็บ:** ตั้ง `const API_BASE` ใน `emergency-sos.html` ให้ชี้ไปยัง URL ของ Worker
(ปล่อยว่าง = หน้าเว็บทำงานในโหมด Offline โดยใช้การประเมินจากเซ็นเซอร์แทน AI จริง)

ทุก endpoint เปิด CORS (`*`) เพื่อให้หน้าเว็บ static เรียกใช้ได้

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

## รอบถัดไป (Round 2)
- ✅ รวม **Claude API** สำหรับ Emergency SOS (`/api/ai/analyze`) — เก็บ key เป็น secret ฝั่ง Worker
- รวม Claude API สำหรับ DocIntel AI Analyzer / Chat / สรุปอัตโนมัติ (ตาม AI Guardrails)
- **R2** เก็บไฟล์ PDF/เอกสารต้นฉบับ + **OCR pipeline**
- **Vectorize** สำหรับ semantic search เชิงความหมาย
- Authentication (RBAC) + Audit log
