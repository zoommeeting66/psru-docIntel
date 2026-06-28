# 8. Branding Guideline

ระบบยึดอัตลักษณ์ PSRU ภายใต้แนวคิด **"PSRU Next & New For All"**
สไตล์: Modern Enterprise · Glassmorphism · Premium · Minimal Luxury · Future Technology

## 8.1 Color Theme

| บทบาท | สี | Hex | การใช้งาน |
|-------|-----|-----|-----------|
| Primary | **PSRU Green** | `#0E7A4B` | ปุ่มหลัก, header, แบรนด์ |
| Primary Dark | Deep Green | `#0A5D39` | gradient, hover, พื้นเข้ม |
| Primary Light | Mint | `#E7F5EE` | พื้นหลังอ่อน, chip |
| Secondary | White | `#FFFFFF` | พื้นหลัก, การ์ด |
| Accent | **Gold** | `#C9A227` | เน้นพรีเมียม, เส้นกรอบ, ไอคอนสำคัญ |
| Ink | Slate | `#1E293B` | ตัวอักษรหลัก |
| Muted | Slate Light | `#64748B` | ตัวอักษรรอง |

> โทนหลักของ Photo Booth ใช้ **เขียว+ทอง** (ต่างจาก DocIntel ที่ใช้ navy+gold) เพื่อความสดของงานอีเวนต์
> โดยยังคง gold accent ร่วมตระกูลแบรนด์ PSRU

## 8.2 Typography

- **Thai:** Sarabun (300–800)
- **Latin/UI:** Inter (300–800)
- หัวเรื่องใช้ weight 700–800, body 400–500
- ตัวเลข dashboard ใช้ tabular figures

## 8.3 โลโก้ & พื้นที่ปลอดภัย (Clear Space)

- โลโก้ PSRU วางมุมบนซ้ายของกรอบภาพ, clear space ≥ ความสูงตัวอักษร "P"
- บนพื้นเข้มใช้โลโก้ขาว/ทอง, บนพื้นอ่อนใช้โลโก้สีเขียว
- ห้ามบิด/เปลี่ยนสัดส่วน/ใส่เงาเกินจำเป็น

## 8.4 องค์ประกอบกรอบภาพ (Photo Frame / Branding Engine)

```
┌───────────────────────────────────────────────┐
│ [โลโก้ PSRU]            ชื่องาน · วันที่         │  ← แถบบน (โปร่งแสง/glass)
│                                                 │
│                ( ภาพผู้ใช้ + ฉาก )               │
│                                                 │
│ PSRU Next & New For All     [QR]  No. 0042  ©   │  ← แถบล่าง
└───────────────────────────────────────────────┘
   ลายน้ำจาง (logo/AI-generated) ทแยงทั้งภาพ
```

องค์ประกอบอัตโนมัติจาก `branding_templates`:
- โลโก้ PSRU · สโลแกน "PSRU Next & New For All"
- ชื่องาน + วันที่ (จาก `events`)
- QR Code (ลิงก์ดาวน์โหลด/แชร์มีอายุ)
- ลายน้ำ (มองเห็น + invisible) · หมายเลขภาพ (running) · เครื่องหมายลิขสิทธิ์

## 8.5 UI/UX Style Tokens

| Token | ค่า |
|-------|-----|
| Radius | `rounded-2xl` (16px) การ์ด, `rounded-xl` ปุ่ม |
| Glass | `backdrop-blur` + พื้น `white/10`–`white/70` + เส้น `white/20` |
| Shadow | นุ่ม, ระยะกลาง (`shadow-lg/xl`), ไม่แข็ง |
| Motion | fade/slide 0.25–0.4s, easing นุ่ม |
| Touch target | ≥ 48px (kiosk/mobile) |
| Spacing | 4-pt grid |

## 8.6 หลักการออกแบบช่องทาง

- **Kiosk:** ปุ่มใหญ่, ตัวอักษรใหญ่, flow น้อยขั้นตอน, auto-reset, รองรับสัมผัส
- **Mobile (PWA):** Mobile-first, ติดตั้งบนหน้าจอหลัก, ใช้กล้องในตัว
- **Executive Dashboard:** สง่างาม, ตัวเลขเด่น, gold accent, กราฟสะอาด
- **Accessibility:** contrast ≥ WCAG AA, มี label/aria, รองรับ dark mode
