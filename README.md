# PSRU-International

เว็บไซต์กองวิเทศสัมพันธ์ มหาวิทยาลัยราชภัฏพิบูลสงคราม และต้นแบบระบบ Document Intelligence (DocIntel)

## โครงสร้างโปรเจกต์
| ไฟล์/โฟลเดอร์ | คำอธิบาย |
|---------------|----------|
| `index.html` | เว็บไซต์ Internationalization & Kenya Sandbox |
| `campus-map.html` | แผนที่วิทยาเขต |
| `doc-intelligence.html` | ต้นแบบ **DocIntel** — ระบบจัดเก็บ/ค้นหา/วิเคราะห์เอกสารอัจฉริยะ (frontend) |
| `backend/` | **Backend จริง** — Cloudflare Worker API + D1 (เอกสาร + ค้นหา) |

## DocIntel — Document Intelligence Platform
ต้นแบบ frontend ใช้งานได้ทันที (เปิด `doc-intelligence.html`) ครอบคลุม: Dashboard, คลังเอกสาร,
ค้นหาขั้นสูง, Document Viewer, เปรียบเทียบเอกสาร, AI Analyzer, AI Chat, Knowledge Graph, Report Center

### เชื่อม Backend จริง
ดูวิธี deploy และเชื่อมต่อ API ที่ [`backend/README.md`](backend/README.md)
- ฐานข้อมูล D1 `psru-docintel` (สร้าง + ใส่ข้อมูลตัวอย่างแล้ว)
- REST API: เอกสาร CRUD + ค้นหาเต็มข้อความภาษาไทย (FTS5 trigram)
- ตั้งค่า `API_BASE` ใน `doc-intelligence.html` ให้ชี้ไปยัง Worker เพื่อใช้ข้อมูลจริง
