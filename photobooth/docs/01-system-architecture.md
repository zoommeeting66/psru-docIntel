# 1. System Architecture — PSRU AI Virtual Photo Booth & VR Studio

## 1.1 หลักการออกแบบ (Design Principles)

- **Edge-first capture, cloud-heavy generation** — งานเบา (segmentation preview, face/pose) ทำได้บนอุปกรณ์/edge; งานหนัก (diffusion, relighting) ทำบน GPU cluster
- **Event-driven & async** — การประมวลผล AI เป็น job แบบ queue เพื่อรองรับช่วง peak (วันรับปริญญา)
- **Stateless services + shared object storage** — ขยายแนวนอนได้, รูปทุกชิ้นอยู่บน Object Storage
- **Privacy by design (PDPA)** — consent gate ก่อนเก็บข้อมูลชีวมิติ, TTL, สิทธิ์ลบ
- **Multi-channel** — Web, Mobile (PWA), Kiosk, VR/360 ใช้ API/Design System ชุดเดียวกัน

## 1.2 แผนภาพสถาปัตยกรรมระดับสูง (C4 — Container View)

```mermaid
flowchart TB
    subgraph Clients["ช่องทางผู้ใช้งาน (Clients)"]
        WEB["Web App<br/>Next.js / React"]
        MOB["Mobile PWA<br/>iOS / Android"]
        KIOSK["Kiosk App<br/>Touch / DSLR tether"]
        VR["VR / 360<br/>WebXR / OpenXR"]
    end

    subgraph Edge["Edge / CDN"]
        CDN["CDN + WAF<br/>(static, images)"]
        APIGW["API Gateway<br/>Auth · Rate limit · Routing"]
    end

    subgraph App["Application Layer"]
        BFF["BFF / Realtime<br/>Node.js (WebSocket)"]
        CORE["Core API<br/>FastAPI (Python)"]
        ORCH["AI Orchestrator<br/>Pipeline / DAG"]
        BRAND["Branding Engine"]
        ADMIN["Admin / Config Service"]
    end

    subgraph Async["Async Processing"]
        Q["Job Queue<br/>Redis / Celery"]
        subgraph GPU["GPU Worker Pool (K8s + NVIDIA)"]
            SEG["Segmentation<br/>SAM 2 / MediaPipe"]
            FACE["Face & Pose<br/>Face Mesh / YOLO"]
            GEN["Generative<br/>SDXL + ControlNet"]
            LIGHT["Relighting<br/>IC-Light"]
            OUT["Outfit / Style Transfer"]
        end
        TRITON["NVIDIA Triton<br/>Inference Server"]
    end

    subgraph Data["Data Layer"]
        PG[("PostgreSQL<br/>+ pgvector")]
        REDIS[("Redis<br/>cache / session")]
        OBJ[("Object Storage<br/>S3 / MinIO (R2)")]
        VRLIB[("VR Scene Library<br/>glTF / USDZ / HDRI")]
    end

    subgraph Obs["Cross-cutting"]
        IAM["IAM / SSO<br/>Keycloak (OIDC)"]
        MON["Observability<br/>Prometheus · Grafana · Loki"]
        AUDIT["Audit / PDPA<br/>Consent + Trail"]
    end

    WEB & MOB & KIOSK & VR --> CDN --> APIGW
    APIGW --> BFF & CORE & ADMIN
    BFF <--> CORE
    CORE --> ORCH --> Q --> GPU
    GPU --> TRITON
    CORE --> BRAND
    CORE --> PG & REDIS & OBJ
    GPU --> OBJ
    VR --> VRLIB
    APIGW --> IAM
    CORE -.-> AUDIT
    GPU -.-> MON
    CORE -.-> MON
```

## 1.3 ส่วนประกอบหลัก (Component Responsibilities)

| ส่วนประกอบ | หน้าที่ | เทคโนโลยี |
|------------|---------|-----------|
| **API Gateway** | Auth, rate limiting, routing, TLS termination | Kong / Traefik |
| **Core API** | Sessions, captures, scenes, jobs, output, stats | FastAPI |
| **BFF / Realtime** | Live preview, job progress (WebSocket/SSE), kiosk pairing | Node.js |
| **AI Orchestrator** | จัด pipeline เป็น DAG, retry, fallback model | Python (Celery + custom DAG) |
| **GPU Worker Pool** | Inference จริง (segment, face, generate, relight, outfit) | PyTorch + Triton |
| **Branding Engine** | ใส่โลโก้/กรอบ/QR/ลายน้ำ/หมายเลขภาพ | Python (Pillow/Skia) + template |
| **Admin/Config** | จัดการฉาก, template, prompt, RBAC, event | FastAPI + React Admin |
| **IAM/SSO** | OIDC, MFA, RBAC | Keycloak |
| **Object Storage** | ภาพต้นฉบับ/ผลลัพธ์, HDRI, asset 3D | S3 / MinIO / Cloudflare R2 |

## 1.4 ลำดับการทำงานหลัก (Capture → Output Sequence)

```mermaid
sequenceDiagram
    participant U as ผู้ใช้ (Kiosk/Mobile)
    participant FE as Frontend
    participant API as Core API
    participant Q as Job Queue
    participant W as GPU Workers
    participant S as Object Storage
    participant B as Branding Engine

    U->>FE: เริ่ม session + ยอมรับ Consent (PDPA)
    FE->>API: POST /sessions (consent=true)
    API-->>FE: session_id
    U->>FE: ถ่ายภาพ (capture) + เลือกฉาก/ชุด/เอฟเฟกต์
    FE->>API: POST /captures (image) + POST /jobs (scene_id, outfit, fx)
    API->>S: เก็บภาพต้นฉบับ (encrypted)
    API->>Q: enqueue render job
    Q->>W: dispatch
    W->>W: 1) Segmentation → 2) Face/Pose → 3) Generate scene<br/>4) Lighting/Perspective match → 5) Beauty → 6) Outfit
    W->>S: เก็บภาพผลลัพธ์ (draft)
    W->>B: ขอใส่ Branding (logo/frame/QR/watermark)
    B->>S: เก็บภาพ final + thumbnail
    W-->>API: job done (via callback)
    API-->>FE: push progress/result (WebSocket)
    FE-->>U: แสดงผล + QR download / share
```

## 1.5 รูปแบบการ Deploy (Topologies)

1. **On-Prem GPU (มหาวิทยาลัย)** — ใช้ GPU server ของมหาวิทยาลัย, ข้อมูลไม่ออกนอกองค์กร (เหมาะกับ PDPA สูงสุด)
2. **Hybrid** — แอป/ฐานข้อมูลบน cloud, inference หนักบน GPU on-prem หรือ GPU cloud ตามโหลด
3. **Event Burst (Cloud GPU)** — เช่าสปอต GPU เฉพาะช่วงงานใหญ่ (วันรับปริญญา) แล้ว scale-to-zero

ดู [`07-deployment-architecture.md`](07-deployment-architecture.md) สำหรับรายละเอียด Kubernetes/Helm

## 1.6 มาตรฐานช่องทาง (Channel Notes)

- **Web/Mobile (PWA):** offline shell, camera API, ติดตั้งบนหน้าจอหลักได้, push notification เมื่อภาพเสร็จ
- **Kiosk:** โหมดเต็มจอ, ล็อกระบบ (kiosk lockdown), รองรับ DSLR/Mirrorless tether (gPhoto2/SDK), auto-reset session, ปุ่มใหญ่เหมาะ touch
- **VR/360:** WebXR สำหรับ walkthrough ฉาก, OpenXR สำหรับ headset; asset จาก VR Scene Library
