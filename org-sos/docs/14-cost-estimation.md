# 14 — Cost Estimation

ประมาณการเชิงโครงสร้าง (order-of-magnitude) แยก **CAPEX** (พัฒนา/ลงทุนครั้งเดียว)
และ **OPEX** (ดำเนินงานรายเดือน/ปี) — ตัวเลขเป็นช่วงโดยประมาณ ปรับตามขนาดองค์กร/ผู้ขายจริง

> สมมติฐานฐาน: องค์กร ~2,000–5,000 บุคลากร, ระบบ cloud ในประเทศ, ทีมพัฒนา ~6–8 คน,
> ระยะพัฒนา MVP→เต็มประมาณ 6–9 เดือน

## 14.1 CAPEX — ต้นทุนพัฒนา (ครั้งเดียว)
| รายการ | สมมติฐาน | ช่วงประมาณ |
|--------|----------|------------|
| ทีมพัฒนา (6–8 คน × ~6–9 เดือน) | PM, 2 BE, 2 Mobile, 1 Web, 1 DevOps/Sec, QA | ส่วนใหญ่ของต้นทุน (แรงงาน) |
| UX/UI design | flows, design system, usability test | กลาง |
| Security pen-test + PDPA/DPIA review | ก่อน go-live + รายปีแรก | กลาง |
| Hardware เริ่มต้น (optional) | beacon ในอาคารหลัก, LoRa gateway นำร่อง | แปรผันตามพื้นที่ |
| Integration setup | IdP, HR connector, SMS GW, LINE OA | กลาง |
| Training & change management | คู่มือ, อบรมศูนย์/บุคลากร | ต่ำ–กลาง |

> ต้นทุนหลัก = **แรงงานพัฒนา**; hardware เป็น optional และเลื่อนได้ถึงเฟส 2–3

## 14.2 OPEX — ต้นทุนดำเนินงาน (ต่อเดือน, ประมาณ)
| รายการ | ตัวขับเคลื่อนต้นทุน | ช่วงประมาณ/เดือน |
|--------|---------------------|------------------|
| Cloud compute (K8s nodes) | จำนวน service + HA multi-AZ | กลาง |
| Managed PostgreSQL + PostGIS (HA, backup/PITR) | ขนาด + IOPS + replica | กลาง |
| Redis (HA) | memory + replica | ต่ำ–กลาง |
| Object storage + egress | ไฟล์แนบ/รายงาน/map tiles | ต่ำ |
| **SMS** | **ต่อข้อความ** × ปริมาณเหตุ + fallback | แปรผัน (ตัวแปรสำคัญ) |
| Push (FCM/APNs) | ฟรี/เกือบฟรี | ต่ำมาก |
| LINE OA | แพ็กเกจ + ต่อข้อความ | ต่ำ–กลาง |
| Map tiles/geocoding | self-host (MapLibre+OSM) หรือ provider | ต่ำ (self-host) |
| Observability (Prometheus/Grafana/Loki) | self-host หรือ SaaS | ต่ำ–กลาง |
| WAF/CDN/DDoS | edge protection | ต่ำ–กลาง |
| LoRa/Satellite (ถ้าใช้) | gateway maintenance + sat plan | แปรผัน |

## 14.3 ต้นทุนทีมดำเนินงานหลัง go-live (รายปี)
| บทบาท | สัดส่วน |
|-------|---------|
| Maintenance/DevOps engineer | 0.5–1 FTE |
| Backend/Mobile support | 0.5–1 FTE (bug fix, ฟีเจอร์ย่อย) |
| Security/DPO oversight | แชร์เวลา (audit, review) |
| Support/ศูนย์ควบคุม | บุคลากรองค์กรเดิม (ไม่ใช่ต้นทุนใหม่เต็ม) |

## 14.4 ตัวแปรที่กระทบต้นทุนมากที่สุด (Cost drivers)
1. **ปริมาณ SMS** — fallback/notification ต่อข้อความ × จำนวนเหตุ/บุคลากร → ควบคุมด้วย "เปิดแอป" แทนใส่เนื้อหา + ใช้ push เป็นหลัก
2. **HA/availability target** — multi-AZ + replica เพิ่มต้นทุน cloud
3. **Hardware offline (beacon/LoRa/satellite)** — ลงทุนตามพื้นที่จริง, เลื่อนได้
4. **ขนาดทีมพัฒนา/ระยะเวลา** — ตัวหลักของ CAPEX

## 14.5 แนวทางประหยัด (Cost optimization)
- เริ่ม **modular monolith** ลด overhead microservices ช่วงแรก
- Self-host map (MapLibre + OSM/own tiles), observability (Grafana stack) แทน SaaS แพง
- Push-first, SMS เป็น fallback เท่านั้น → ลดค่า SMS
- Autoscale + spot/preemptible nodes สำหรับ workload ไม่วิกฤต
- เลื่อน hardware offline ไปเฟสหลัง (MVP ครอบคลุม ~95% ด้วย online+SMS+store&forward)
- Crypto-shredding + retention อัตโนมัติ → ลดต้นทุนเก็บข้อมูลระยะยาว

## 14.6 วิธีใช้เอกสารนี้
ใส่ตัวเลขจริงจากผู้ขาย/cloud calculator ลงในช่อง "ช่วงประมาณ" เพื่อทำ TCO 3 ปี
(CAPEX ปีแรก + OPEX×36 เดือน) แล้วเปรียบเทียบ build vs buy ก่อนตัดสินใจลงทุน
