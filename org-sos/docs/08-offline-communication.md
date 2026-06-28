# 08 — Offline Communication Design

หัวใจของระบบ: **ส่งสัญญาณ SOS ให้ถึงเสมอ** แม้ไม่มีอินเทอร์เน็ต
ออกแบบเป็น multi-channel fallback แบบมีลำดับ + dedupe ที่ backend

## 8.1 ลำดับ Fallback (Channel Cascade)
```
[1] Online (HTTPS/WSS)              ← เร็วสุด, ครบสุด
        │ ล้มเหลว/ไม่มีเน็ต
        ▼
[2] SMS → เบอร์ศูนย์ควบคุม          ← ต้องมีสัญญาณมือถือ
        │
        ▼
[3] BLE Mesh (gossip relay)         ← ส่งต่อผ่านเครื่องบุคลากรใกล้เคียง
        │
        ▼
[4] Wi-Fi Direct (peer relay)       ← อุปกรณ์ใกล้ที่มีเน็ต relay ให้
        │
        ▼
[5] LoRa Gateway (ถ้าองค์กรติดตั้ง) ← ระยะไกล, ใช้พลังงานต่ำ
        │
        ▼
[6] Satellite Messaging (ถ้ารองรับ) ← พื้นที่ไร้ทุกสัญญาณ
        │
        ▼
[*] Store & Forward (เสมอ)          ← เก็บใน Outbox, ส่งทันทีเมื่อกลับมีสัญญาณ
```
- ลองหลายช่องทาง **ขนานกัน** ได้ในบางกรณี (เช่น SMS + BLE พร้อมกัน) เพื่อความเร็ว
- ทุกช่องทางแนบ **`incident_uuid` เดียวกัน** → backend dedupe เป็นเคสเดียว

## 8.2 รูปแบบข้อความขนาดเล็ก (Compact Payload)
ช่องทาง bandwidth ต่ำ (SMS 160 ตัวอักษร, LoRa, satellite) ต้องบีบอัด
```
SOS|v1|<uuid-short>|<emp_code>|<type>|<lat>,<lng>|<acc>|<batt>|<ts>|<sig>
ตัวอย่าง: SOS|v1|0190f2a4|E12345|medical|16.8211,100.2659|8|37|1719562445|a1b2c3
```
- `uuid-short`: 8–12 ตัวแรกของ UUIDv7 (พอ unique ภายในหน้าต่างเวลา)
- `sig`: HMAC สั้น (truncated) เพื่อยืนยันที่มา + กันปลอม
- หลาย segment ได้ถ้าจำเป็น (multipart SMS) แต่ออกแบบให้ 1 ข้อความพอ

## 8.3 SMS Channel
- แอปส่ง SMS ไปเบอร์ศูนย์ (จาก config) ด้วย compact payload
- ฝั่ง backend: SMS Gateway รับ inbound → `/internal/ingest/sms` → parse → สร้าง/merge incident
- ข้อจำกัด iOS: ส่ง SMS อัตโนมัติแบบเงียบไม่ได้ → ใช้ pre-filled compose (ผู้ใช้กด send)
  หรือใช้ผู้ให้บริการ SMS ฝั่ง server สำหรับ 2-way; Android ส่งอัตโนมัติได้ (permission SEND_SMS)

## 8.4 BLE Mesh (Bluetooth Low Energy)
- ใช้ advertise + GATT relay: เครื่องที่กด SOS กระจาย payload เป็น BLE advertisement/characteristic
- เครื่องบุคลากรใกล้เคียงที่รันแอป = **relay node**: รับ payload → ถ้าตนมีเน็ต = ส่งเข้า backend (`/internal/ingest/relay`); ถ้าไม่มี = ส่งต่อ (gossip, TTL/hop-limit เพื่อกัน loop)
- ใช้ store-carry-forward: relay node เก็บไว้จนเจอเน็ต
- พิจารณา BLE mesh stack หรือ custom advertisement scheme; ต้องคำนึง iOS background limit
- ความปลอดภัย: payload เซ็น HMAC; relay node ไม่สามารถอ่านข้อมูลอ่อนไหว (มีแค่ minimal fields)

## 8.5 Wi-Fi Direct
- จับคู่ peer-to-peer กับอุปกรณ์ใกล้ที่มีเน็ต → ส่ง payload (เต็มกว่าหน่อยได้)
- เหมาะเมื่อมีเพื่อนร่วมงานใกล้ ๆ ที่ออนไลน์; Android รองรับดีกว่า iOS (iOS ใช้ MultipeerConnectivity เป็นทางเลือก)

## 8.6 LoRa Gateway (optional hardware)
- องค์กรติดตั้ง LoRa gateway ในพื้นที่อับสัญญาณ (โรงงาน/พื้นที่ห่างไกล)
- อุปกรณ์เสริม (LoRa module/แท็ก) หรือมือถือที่ต่อ dongle ส่ง compact payload → gateway → `/internal/ingest/lora`
- ระยะไกล (กม.), พลังงานต่ำ; bandwidth ต่ำมาก → ใช้ payload §8.2

## 8.7 Satellite Messaging (optional)
- เฉพาะอุปกรณ์/มือถือที่รองรับ (เช่น emergency satellite) — ส่งข้อความสั้นในพื้นที่ไร้สัญญาณ
- ใช้ compact payload; latency สูง — เป็น last resort

## 8.8 Store & Forward (always-on safety net)
```
กด SOS → เขียนลง Outbox (SQLite + sqlcipher) ทันที (durable)
       → พยายามทุกช่องทางที่ทำได้
       → รายการที่ยังไม่ "acknowledged by backend" ค้างใน Outbox
ConnectivityWatcher: online กลับมา → POST /v1/incidents/sync (batch)
Backend: ตอบ receipt ต่อ incident_uuid → แอปลบออกจาก Outbox
```
- Outbox มี retry/backoff; ไม่ลบจนกว่าจะได้ ack
- รองรับหลาย SOS ค้าง (เช่น mass incident พื้นที่อับสัญญาณนาน)

## 8.9 Deduplication & Merge (Backend)
```
รับ payload (จากช่องทางใดก็ตาม)
  → ดู dedupe:{incident_uuid} ใน Redis (+ sync_outbox_receipt ใน DB)
     - ยังไม่เคย: สร้าง incident, บันทึก receipt(channel,first_seen)
     - เคยแล้ว: merge (เพิ่ม channel, เพิ่ม location ถ้าใหม่กว่า, event sync_merged)
  → ผล: 1 เหตุการณ์จริง = 1 incident เสมอ ไม่ว่ามากี่ช่องทาง
```
- เลือก "ตำแหน่งที่ดีที่สุด": accuracy สูงสุด/ใหม่สุด เป็น primary_location
- บันทึกว่ามาช่องทางไหนก่อน (channel_first) เพื่อวิเคราะห์ความครอบคลุมสัญญาณ

## 8.10 ตารางสรุปคุณสมบัติช่องทาง
| ช่องทาง | ต้องมีเน็ต | ระยะ | Bandwidth | iOS auto | หมายเหตุ |
|---------|-----------|------|-----------|----------|----------|
| Online | ใช่ | - | สูง | ✓ | ครบสุด เร็วสุด |
| SMS | สัญญาณมือถือ | เครือข่าย | 160 ตัว | ✗ (compose) | พึ่งพาผู้ให้บริการ |
| BLE Mesh | ไม่ (relay) | ~10–100 ม. ต่อ hop | ต่ำ | จำกัด | ต้องมี relay node |
| Wi-Fi Direct | ไม่ (relay) | ~50–200 ม. | กลาง | จำกัด | ต้องมี peer ออนไลน์ |
| LoRa | ไม่ (gateway) | กม. | ต่ำมาก | n/a | ต้องลงทุน hardware |
| Satellite | ไม่ | ทั่วโลก | ต่ำมาก | เฉพาะรุ่น | last resort |
| Store&Forward | ไม่ | - | - | ✓ | safety net เสมอ |

## 8.11 ลำดับความสำคัญในการ implement (MVP → เต็ม)
1. **MVP**: Online + Store&Forward + SMS (ครอบคลุม 95% เคสจริง)
2. **เฟส 2**: BLE Mesh relay + Wi-Fi Direct
3. **เฟส 3**: LoRa / Satellite (ตามที่องค์กรลงทุน hardware)
