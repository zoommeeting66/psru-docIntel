# 06 — Mobile App Screen Flow

แพลตฟอร์ม: Flutter (Android & iOS) · Offline-first · Background service

## 6.1 แผนผังหน้าจอ (Navigation Map)
```
Splash ─▶ (มี session?) ─no─▶ Login (SSO) ─▶ Consent & Permissions ─┐
   │                                                                │
  yes                                                               ▼
   └────────────────────────────▶ ┌──────────  HOME / SOS  ──────────┐
                                   │  [ ปุ่ม SOS ใหญ่กลางจอ ]          │
                                   │  สถานะเน็ต/แบต/ช่องทางที่พร้อม    │
                                   └───┬───────┬────────┬────────┬────┘
            กดค้าง 3 วิ ──────────────┘       │        │        │
                ▼                              ▼        ▼        ▼
         เลือกประเภทเหตุ              ข้อมูลฉุกเฉิน  ผู้ติดต่อ  ประวัติ
         (หรือข้าม=general)          ของฉัน        ฉุกเฉิน    การแจ้งเหตุ
                ▼                                                  │
         สถานะการส่งสัญญาณ  ◀── live status / channels ──┐         ▼
         (Sending → Sent → Live)                        │   รายละเอียดเคส
                ▼                                        │   + timeline
         Live Incident (ติดตาม + chat + แชร์ตำแหน่ง) ────┘
         + แผนที่ Offline · Settings · Test mode
```

## 6.2 รายการหน้าจอ
| หน้าจอ | องค์ประกอบหลัก |
|--------|----------------|
| **Splash** | ตรวจ session, โหลด config, ตรวจ outbox ค้าง |
| **Login (SSO)** | ปุ่ม "เข้าสู่ระบบด้วยบัญชีองค์กร" → OIDC web flow |
| **Consent & Permissions** | ยินยอมข้อมูลสุขภาพ/ผู้ติดต่อ (เลือกได้), ขอสิทธิ์ location/notification/bluetooth |
| **Home / SOS** | ปุ่ม SOS ใหญ่ (กดค้าง 3 วิ), indicator: เน็ต/แบต/ช่องทางพร้อม, ปุ่มลัด |
| **เลือกประเภทเหตุ** | grid 8 ประเภท + ปุ่ม "ข้าม (ส่งทันที)" ; auto-select ได้ |
| **สถานะการส่งสัญญาณ** | progress ต่อช่องทาง (online/SMS/BLE/Wi-Fi), ปุ่มยกเลิก 15 วิ |
| **Live Incident** | สถานะเคส, timeline, chat, ปุ่มแชร์ตำแหน่งต่อเนื่อง, "ฉันปลอดภัยแล้ว" |
| **ข้อมูลฉุกเฉินของฉัน** | กรุ๊ปเลือด/โรค/แพ้ยา (ตาม consent), แก้ไขได้ |
| **ผู้ติดต่อฉุกเฉิน** | รายชื่อ + ลำดับความสำคัญ, เพิ่ม/ลบ |
| **ประวัติการแจ้งเหตุ** | รายการเคสของตน + สถานะ |
| **แผนที่ Offline** | แผนที่อาคาร/พื้นที่ดาวน์โหลดไว้, จุด checkpoint/beacon |
| **Settings / Test mode** | ภาษา, ทดสอบ SOS (ไม่ส่งจริง), จัดการอุปกรณ์, sign out |

## 6.3 ปุ่ม SOS — State Machine
```
        IDLE
         │ press & hold
         ▼
     ARMING (0→3s, แสดง ring countdown, สั่นเป็นจังหวะ)
         │ ปล่อยก่อน 3s → ยกเลิก (กลับ IDLE)
         │ ครบ 3s
         ▼
     TRIGGERED  ── สั่น+เสียงยืนยัน, สร้าง incident_uuid, snapshot ตำแหน่ง/แบต/เน็ต
         ▼
   ┌─ ตรวจ connectivity ─┐
   │ online              │ offline
   ▼                     ▼
 SENDING_ONLINE     SENDING_OFFLINE (วน fallback ตามลำดับ)
   │  201/200             │  ลอง SMS→BLE→Wi-Fi→Store&Forward
   ▼                      ▼
 SENT ──────────────▶ SENT_PARTIAL / QUEUED
   │  (cancel window 15s)
   ▼
 LIVE (ติดตามสถานะ real-time จนปิดเหตุ)
```
- **กันกดผิด**: ต้องกดค้างครบ 3 วิ + cancel window 15 วิ หลังส่ง
- **ความโปร่งใส**: หน้าจอแสดงเสมอว่ากำลังส่งช่องทางไหน สำเร็จ/ล้มเหลว

## 6.4 พฤติกรรม Offline & Background
- **Outbox**: เก็บ SOS ที่ยังส่งไม่สำเร็จใน SQLite (เข้ารหัส sqlcipher); retry อัตโนมัติ
- **ConnectivityWatcher**: เมื่อกลับมา online → flush outbox ผ่าน `/v1/incidents/sync`
- **Background**:
  - Android: foreground service (แจ้งเตือนถาวรขณะมีเคส active) + WorkManager retry
  - iOS: BGProcessingTask + significant-location-change; แจ้งผู้ใช้ข้อจำกัด background BLE
- **Battery-aware**: ลดความถี่ location update เมื่อแบตต่ำ แต่ SOS ยังส่งได้เสมอ

## 6.5 Accessibility & UX วิกฤต
- ปุ่ม SOS ขนาดใหญ่ contrast สูง, รองรับ TalkBack/VoiceOver
- ทำงานได้ด้วยมือเดียว, แตะง่ายแม้สั่น
- รองรับ Volume-button shortcut (กดปุ่ม power/volume เร็ว ๆ → arm SOS) เป็น optional
- ภาษาไทย/อังกฤษ, ข้อความสั้น เข้าใจทันที

## 6.6 สิ่งที่แอปแนบอัตโนมัติเมื่อกด SOS
ผู้แจ้ง · หน่วยงาน · เบอร์โทร · ตำแหน่ง GPS ล่าสุด · เวลา · ประเภทเหตุ ·
ระดับแบตเตอรี่ · สถานะอินเทอร์เน็ต · ช่องทางที่ใช้ส่ง — ผู้ใช้ไม่ต้องกรอกเอง
