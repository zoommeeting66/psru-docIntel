# 07 — Web Dashboard Screen Flow

แพลตฟอร์ม: React + TypeScript + MapLibre GL · สำหรับศูนย์ควบคุม/แอดมิน/หัวหน้า/รปภ.
Realtime ผ่าน WebSocket (WSS)

## 7.1 แผนผังหน้าจอ
```
Login (SSO) ─▶ Role gate ─▶ ┌──────────────── DASHBOARD ────────────────┐
                            │  KPI cards · เคส active · เสียงเตือนเคสใหม่  │
                            └──┬─────────┬─────────┬─────────┬──────────┘
                               ▼         ▼         ▼         ▼
                          Incident   Incident   Dispatch   Report
                            Map       List       Panel      Center
                               │         │
                               ▼         ▼
                          Incident Detail (timeline · map · people · chat · actions)
        Admin only ─▶ User Management · Organization Structure · Settings · Audit
```

## 7.2 รายการหน้าจอ
| หน้าจอ | องค์ประกอบหลัก | บทบาทที่เห็น |
|--------|----------------|---------------|
| **Dashboard รวม** | KPI (active/critical/avg response), feed เคสล่าสุด, เสียง+toast เคสใหม่ | control, admin, supervisor |
| **Incident Map** | แผนที่หมุดเคส (สีตาม severity), cluster, layer อาคาร/ชั้น, live | control, responder, supervisor |
| **Incident List** | ตารางกรอง/เรียง (status, severity, type, org, เวลา), bulk action | control, supervisor |
| **Incident Detail** | สรุปเคส, **Timeline** เหตุการณ์, แผนที่+เส้นทาง, บุคคลที่เกี่ยวข้อง, chat, ปุ่มเปลี่ยนสถานะ/มอบหมาย/แนบไฟล์ | ตาม scope |
| **Dispatch Panel** | รายชื่อ responder ว่าง/ใกล้ที่สุด, drag-assign, ติดตามสถานะภาคสนาม | control |
| **Report Center** | after-action reports, สถิติ, export PDF/CSV (anonymized) | control, admin |
| **User Management** | จัดการผู้ใช้/บทบาท/สิทธิ์ (RBAC) | admin |
| **Organization Structure** | ผังหน่วยงาน + สายบังคับบัญชา (จาก HR sync) | admin |
| **Broadcast** | สร้าง/ส่งประกาศตาม org_unit หรือ geofence | control, admin |
| **Audit Log** | ค้นหา/กรอง การเข้าถึงข้อมูล (read/export ข้อมูลอ่อนไหว) | admin, DPO |
| **Settings** | ช่องทางแจ้งเตือน, เบอร์ศูนย์, template, SLA, integration | admin |

## 7.3 Flow ศูนย์ควบคุมรับเคส (หลัก)
```
เคสใหม่เด้ง (toast+เสียง+หมุดกระพริบ)
      ▼
เปิด Incident Detail ─▶ ตรวจ severity/ประเภท/ตำแหน่ง/ข้อมูลผู้แจ้ง
      ▼
Acknowledge (จับเวลา response) ─▶ Dispatch Panel: เลือก responder
      ▼
ติดตามสถานะ: dispatched → enroute → onsite
      ▼
(ถ้าเหตุใหญ่) ส่ง Broadcast เตือนพื้นที่
      ▼
Resolved ─▶ Close ─▶ ระบบ generate after-action report
```

## 7.4 Dashboard — องค์ประกอบเชิงข้อมูล
- **KPI cards**: เคส active, critical ตอนนี้, avg acknowledge time, avg resolve time, % offline-origin
- **Live feed**: เคสล่าสุดเรียงเวลา + badge ช่องทาง (online/SMS/BLE…)
- **Map mini**: หมุดเคส active บนแผนที่ย่อ
- **Alert lane**: เคส critical ที่ยังไม่ acknowledge ค้างบนสุด + นับถอยหลัง SLA

## 7.5 Incident Map — ฟีเจอร์
- หมุดสีตาม severity; cluster เมื่อ zoom ออก
- Layer: outdoor (street/satellite) + indoor floorplan (สลับชั้น), beacon/checkpoint
- คลิกหมุด → mini-card → เปิด detail
- Live location track ของผู้แจ้ง/responder (เส้นทาง)
- Geofence overlay สำหรับ broadcast

## 7.6 Incident Detail — เลย์เอาต์
```
┌───────────────┬───────────────────────────────┐
│  สรุปเคส       │  แผนที่ + ตำแหน่ง (live)        │
│  ผู้แจ้ง/หน่วย  │                               │
│  ประเภท/ระดับ  ├───────────────────────────────┤
│  สถานะ+ปุ่ม    │  Timeline เหตุการณ์ (append)   │
│  ข้อมูลจำเป็น   │  (created/loc/status/note/...) │
│  (ตาม consent) │                               │
├───────────────┴───────────────────────────────┤
│  Actions: Acknowledge · Assign · Status · Note · Attach · Broadcast · Close │
│  People: reporter · supervisor · responders · emergency contacts (masked)   │
│  Chat: ศูนย์ ↔ responder ↔ supervisor                                       │
└────────────────────────────────────────────────┘
```
> ข้อมูลสุขภาพ/ผู้ติดต่อแสดงแบบ **need-to-know**: ปกติ masked, กดดู = ระบุ purpose → บันทึก audit

## 7.7 Realtime & UX ศูนย์
- WSS subscribe `control:incidents`; เคสใหม่ = toast + เสียง + หมุด
- Optimistic UI สำหรับ action; reconcile กับ server event
- Multi-screen friendly (วอลล์จอศูนย์ควบคุม): โหมด Map-wall, โหมด List-wall
- Offline ของ dashboard เอง: แสดง banner + queue action เมื่อเน็ตศูนย์หลุด
