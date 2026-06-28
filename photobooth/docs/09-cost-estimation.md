# 9. Cost Estimation (ประมาณการต้นทุน)

> ตัวเลขเป็น **ประมาณการเชิงวางแผน** (order-of-magnitude) สกุล THB ต่อเดือน
> ขึ้นกับปริมาณการใช้, รุ่น GPU, และรูปแบบ deploy (on-prem vs cloud) — ใช้เพื่อจัดทำงบเบื้องต้น

## 9.1 สมมติฐาน (Assumptions)

- ปริมาณปกติ: ~3,000–8,000 ภาพ/เดือน
- ช่วงอีเวนต์ใหญ่ (รับปริญญา): สูงสุด ~5,000–10,000 ภาพ/วัน เป็นช่วงสั้น (burst)
- เวลาเรนเดอร์เฉลี่ย: ~10 วินาที/ภาพ (1 GPU รองรับ ~300–360 ภาพ/ชม.)
- เก็บภาพ final 30 วัน, ภาพต้นฉบับ 24 ชม.

## 9.2 ตัวเลือก A — Cloud GPU (OPEX, burst-friendly)

| รายการ | สเปก/หมายเหตุ | ประมาณการ/เดือน (THB) |
|--------|----------------|------------------------:|
| GPU compute (baseline) | 1× L4/A10 on-demand บางส่วน + spot | 25,000 – 60,000 |
| GPU burst (อีเวนต์) | spot A100/L40S เฉพาะวันงาน | 15,000 – 50,000 (เฉพาะเดือนมีงาน) |
| CPU services (K8s) | core-api/bff/admin/branding | 8,000 – 18,000 |
| PostgreSQL (HA) | managed, + backup | 4,000 – 10,000 |
| Object Storage + CDN | ภาพ + asset + egress | 3,000 – 9,000 |
| Redis (managed) | queue/cache | 2,000 – 5,000 |
| Monitoring/Logging | Prometheus/Grafana/Loki (managed/self) | 2,000 – 6,000 |
| **รวมโดยประมาณ** | (เดือนปกติ ไม่รวม burst) | **~44,000 – 108,000** |

## 9.3 ตัวเลือก B — On-Prem GPU (CAPEX + OPEX, PDPA สูงสุด)

| รายการ | หมายเหตุ | ประมาณการ |
|--------|----------|----------:|
| GPU Server (CAPEX) | 1 เครื่อง 2–4× GPU (เช่น L40S/A6000) | 800,000 – 2,500,000 (ครั้งเดียว) |
| Storage/Network (CAPEX) | NAS/SSD + switch | 150,000 – 500,000 (ครั้งเดียว) |
| ค่าไฟ + cooling (OPEX) | ต่อเดือน | 5,000 – 20,000 |
| Software/Maintenance (OPEX) | license, support | 5,000 – 15,000 |
| บุคลากรดูแล (OPEX) | partial FTE | ตามโครงสร้างมหาวิทยาลัย |

> on-prem คุ้มเมื่อใช้ต่อเนื่องระยะยาว + ต้องการให้ข้อมูลอยู่ในองค์กร (PDPA)
> cloud คุ้มกว่าสำหรับการเริ่มต้น/ใช้เป็นช่วงอีเวนต์

## 9.4 ตัวเลือก C — Hybrid (แนะนำสำหรับ Phase 2–3)

- แอป/DB/CDN บน cloud (ยืดหยุ่น, ดูแลง่าย)
- GPU on-prem เป็นฐาน + spot cloud GPU เสริมช่วง burst
- สมดุลระหว่างต้นทุน, ความยืดหยุ่น และการคุ้มครองข้อมูล

## 9.5 ต้นทุนแฝงที่ควรกันงบ

| รายการ | หมายเหตุ |
|--------|----------|
| Hardware Kiosk | จอสัมผัส + กล้อง DSLR/Mirrorless + ไฟ + ตัวเครื่อง: ~80,000–250,000/บูธ |
| การผลิตฉาก VR | จ้าง/ผลิตฉาก 3D คุณภาพสูงต่อฉาก (one-time) |
| License โมเดล/asset | ตรวจ license เชิงพาณิชย์ของโมเดล/HDRI/font |
| การอบรมเจ้าหน้าที่ | operator + admin |

## 9.6 แนวทางคุมต้นทุน (Cost Optimization)

- ใช้ **spot/preemptible GPU** + **scale-to-zero** นอกช่วงงาน
- โมเดล `fp16`/TensorRT + **dynamic batching** (Triton) เพิ่ม throughput ต่อ GPU
- Cache ฉาก/HDRI/asset, precompute thumbnail
- ตั้ง **retention TTL** ลดค่าเก็บข้อมูล
- CDN cache ภาพ final ลด egress
