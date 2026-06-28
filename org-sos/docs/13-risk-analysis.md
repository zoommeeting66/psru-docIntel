# 13 — Risk Analysis

ประเมินความเสี่ยงตาม Likelihood × Impact (L/M/H) พร้อมมาตรการลด (mitigation) และเจ้าของ
เน้นความเสี่ยงที่กระทบ **ชีวิต/ความปลอดภัย** และ **การส่งสัญญาณไม่ถึง** เป็นอันดับแรก

## 13.1 ความเสี่ยงด้านเทคนิค / ความน่าเชื่อถือ
| # | ความเสี่ยง | L | I | คะแนน | มาตรการลด | เจ้าของ |
|---|-----------|---|---|-------|-----------|---------|
| T1 | SOS ส่งไม่ถึง (ไม่มีเน็ต/สัญญาณ) | M | H | สูง | multi-channel fallback + store&forward + dedupe; ทดสอบภาคสนาม | Eng |
| T2 | ตำแหน่งไม่แม่นในอาคาร | H | M | สูง | beacon/QR/Wi-Fi positioning + last-known + เลือก manual | Eng |
| T3 | False trigger (กดผิด) | M | M | กลาง | กดค้าง 3 วิ + cancel window 15 วิ + test mode | Eng/UX |
| T4 | ระบบล่ม ช่วงเหตุพีค (mass incident) | M | H | สูง | autoscale, queue, load test, HA multi-AZ, graceful degrade | DevOps |
| T5 | iOS background limit (BLE/SMS/loc) | H | M | สูง | degrade gracefully, foreground prompt, server-side SMS, แจ้งผู้ใช้ | Mobile |
| T6 | Dedupe ผิด → เคสซ้ำ/หาย | M | H | สูง | incident_uuid + receipt + idempotency + test เฉพาะ | Backend |
| T7 | Push/SMS provider ล่ม | M | M | กลาง | multi-provider, retry/backoff, dashboard alert เป็น fallback | DevOps |
| T8 | Battery/permission ถูกปิด → แอปไม่ทำงาน | M | H | สูง | onboarding ขอ permission, health-check แจ้งเตือนผู้ใช้ | Mobile |

## 13.2 ความเสี่ยงด้านความปลอดภัย / ข้อมูล
| # | ความเสี่ยง | L | I | คะแนน | มาตรการลด | เจ้าของ |
|---|-----------|---|---|-------|-----------|---------|
| S1 | รั่วข้อมูลสุขภาพ/PII | L | H | สูง | field encryption, need-to-know, RLS, audit, masking | Sec |
| S2 | ปลอม SOS / relay ปลอม | M | M | กลาง | JWT, HMAC payload, device binding, rate limit | Sec |
| S3 | สิทธิ์เกิน (over-privilege) | M | H | สูง | RBAC 3 ชั้น, RLS, least privilege, review | Sec |
| S4 | ช่องโหว่ dependency/supply chain | M | M | กลาง | SCA/SAST/DAST, SBOM, signed artifacts, pin versions | DevOps |
| S5 | Relay node เห็นข้อมูลอ่อนไหว | L | M | กลาง | payload offline มีแค่ minimal fields, เซ็น ไม่เข้ารหัสได้แต่ไม่มี PII | Sec |
| S6 | DDoS / SOS spam | M | M | กลาง | WAF, rate limit ต่อ person/IP, autoscale | DevOps |

## 13.3 ความเสี่ยงด้านกฎหมาย / PDPA
| # | ความเสี่ยง | L | I | คะแนน | มาตรการลด | เจ้าของ |
|---|-----------|---|---|-------|-----------|---------|
| P1 | ประมวลผลข้อมูลสุขภาพไม่มีฐาน/consent | L | H | สูง | consent ชัดแจ้ง + vital interest + DPIA + DPO review | DPO |
| P2 | ไม่รองรับ DSAR ทันเวลา | M | M | กลาง | self-service ในแอป + workflow DPO + SLA | DPO |
| P3 | ข้อมูลรั่วทาง notification | M | M | กลาง | ข้อความไม่ใส่ข้อมูลอ่อนไหว ("เปิดแอป") | Eng |
| P4 | ส่งข้อมูลข้ามแดนไม่เหมาะสม | L | M | กลาง | data residency, ส่ง minimal ไป provider, DPA | DPO |
| P5 | Retention เกินจำเป็น | M | M | กลาง | retention policy + auto anonymize + crypto-shred | DPO |

## 13.4 ความเสี่ยงด้านปฏิบัติการ / องค์กร
| # | ความเสี่ยง | L | I | คะแนน | มาตรการลด | เจ้าของ |
|---|-----------|---|---|-------|-----------|---------|
| O1 | ศูนย์ควบคุมตอบสนองช้า (คน/กระบวนการ) | M | H | สูง | SLA + เสียงเตือน + escalation อัตโนมัติเมื่อค้าง | Ops |
| O2 | บุคลากรไม่ติดตั้ง/ไม่เข้าใจแอป | H | M | สูง | change management, training, onboarding ง่าย, test mode | PM |
| O3 | HR data ไม่ทันสมัย/ผิด | M | M | กลาง | sync สม่ำเสมอ + แก้ในแอป (consent) + reconcile | Eng |
| O4 | งบ hardware (beacon/LoRa) ไม่อนุมัติ | M | M | กลาง | MVP ไม่พึ่ง hardware; เฟสหลังค่อยลงทุน | PM |
| O5 | ความคาดหวังเกินจริง (รับประกันชีวิต) | M | H | สูง | สื่อสารชัด: เป็นเครื่องมือช่วย ไม่ใช่ทดแทน 1669/รปภ.; SLA โปร่งใส | PM |

## 13.5 Top Risks & การติดตาม
**5 อันดับที่ต้องเฝ้าใกล้ชิด**: T1 (ส่งไม่ถึง), T4 (ล่มช่วงพีค), S1 (รั่วข้อมูลสุขภาพ),
O1 (ศูนย์ตอบช้า), O5 (ความคาดหวัง)
- ทบทวน risk register ทุก sprint; เพิ่ม metric เฝ้าระวัง (success rate, response time, audit anomaly)
- ความเสี่ยง "สูง" ต้องมี mitigation ที่ทดสอบได้ก่อน gate ของเฟส

## 13.6 Contingency (แผนสำรองเมื่อเกิดจริง)
- ระบบหลักล่ม → fallback ช่องทาง SMS ตรงเข้าเบอร์ศูนย์ + ขั้นตอน manual (โทร/วิทยุ)
- Data breach → activate IR runbook + แจ้งภายใน 72 ชม. ตาม PDPA
- Provider ล่ม → สลับ provider สำรอง (notification/SMS multi-provider)
