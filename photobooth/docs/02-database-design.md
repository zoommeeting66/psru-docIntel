# 2. Database Design & ER Diagram

ฐานข้อมูลหลัก: **PostgreSQL 16** (+ `pgvector` สำหรับ face/scene embedding, semantic search ฉาก)
Cache/realtime: **Redis** · ไฟล์รูป/asset: **Object Storage** (เก็บเฉพาะ key/URL ใน DB)

## 2.1 ER Diagram

```mermaid
erDiagram
    USERS ||--o{ SESSIONS : starts
    USERS }o--|| ROLES : has
    EVENTS ||--o{ SESSIONS : hosts
    SESSIONS ||--o{ CAPTURES : contains
    SESSIONS ||--|| CONSENTS : requires
    CAPTURES ||--o{ RENDER_JOBS : triggers
    SCENES ||--o{ RENDER_JOBS : used_in
    OUTFITS ||--o{ RENDER_JOBS : applied_in
    RENDER_JOBS ||--o| OUTPUTS : produces
    BRANDING_TEMPLATES ||--o{ OUTPUTS : styled_by
    OUTPUTS ||--o{ DOWNLOADS : downloaded_as
    OUTPUTS ||--o{ FEEDBACK : rated_by
    SCENES }o--|| SCENE_CATEGORIES : in
    AI_PROMPTS ||--o{ SCENES : configures
    USERS ||--o{ AUDIT_LOGS : generates

    USERS {
        uuid id PK
        string email
        string display_name
        uuid role_id FK
        string sso_subject
        bool mfa_enabled
        timestamptz created_at
    }
    ROLES {
        uuid id PK
        string name
        jsonb permissions
    }
    EVENTS {
        uuid id PK
        string name
        string slug
        date start_date
        date end_date
        uuid default_branding_id FK
        bool is_active
    }
    SESSIONS {
        uuid id PK
        uuid user_id FK
        uuid event_id FK
        string channel
        string device_id
        string status
        timestamptz started_at
        timestamptz ended_at
    }
    CONSENTS {
        uuid id PK
        uuid session_id FK
        bool biometric_ok
        bool age_gender_ok
        bool marketing_ok
        string policy_version
        inet ip_address
        timestamptz consented_at
    }
    CAPTURES {
        uuid id PK
        uuid session_id FK
        string source_type
        string storage_key
        int width
        int height
        int people_count
        jsonb exif
        timestamptz created_at
    }
    SCENE_CATEGORIES {
        uuid id PK
        string name
        int sort_order
    }
    SCENES {
        uuid id PK
        uuid category_id FK
        string name
        string thumbnail_key
        string hdri_key
        string asset_3d_key
        uuid ai_prompt_id FK
        bool is_360
        bool is_symbolic_restricted
        bool is_active
    }
    AI_PROMPTS {
        uuid id PK
        string name
        text positive_prompt
        text negative_prompt
        jsonb params
        string model_ref
        int version
    }
    OUTFITS {
        uuid id PK
        string name
        string category
        string preview_key
        string control_asset_key
        bool is_active
    }
    RENDER_JOBS {
        uuid id PK
        uuid capture_id FK
        uuid scene_id FK
        uuid outfit_id FK
        jsonb fx
        jsonb pipeline_steps
        string status
        int progress
        string gpu_node
        int duration_ms
        text error
        timestamptz created_at
    }
    BRANDING_TEMPLATES {
        uuid id PK
        string name
        string logo_key
        string frame_key
        jsonb watermark
        bool show_qr
        jsonb layout
    }
    OUTPUTS {
        uuid id PK
        uuid render_job_id FK
        uuid branding_id FK
        string image_no
        string final_key
        string thumb_key
        jsonb formats
        string share_token
        timestamptz expires_at
    }
    DOWNLOADS {
        uuid id PK
        uuid output_id FK
        string format
        string channel
        inet ip_address
        timestamptz created_at
    }
    FEEDBACK {
        uuid id PK
        uuid output_id FK
        int rating
        text comment
        timestamptz created_at
    }
    AUDIT_LOGS {
        uuid id PK
        uuid actor_id FK
        string action
        string entity
        string entity_id
        jsonb metadata
        inet ip_address
        timestamptz created_at
    }
```

## 2.2 ตารางสำคัญ & เหตุผลการออกแบบ

| ตาราง | บทบาท | หมายเหตุการออกแบบ |
|-------|-------|--------------------|
| `sessions` | หนึ่งครั้งที่ผู้ใช้มาใช้บูธ | `channel` = web/mobile/kiosk/vr; auto-expire |
| `consents` | บันทึกความยินยอม PDPA แยกราย scope | แยก biometric / age-gender / marketing เพื่อ granular consent |
| `captures` | ภาพต้นฉบับ | เก็บแค่ `storage_key`; ตั้ง TTL ลบอัตโนมัติ |
| `render_jobs` | งาน AI แต่ละชิ้น | `pipeline_steps` jsonb เก็บผลแต่ละ stage เพื่อ debug/retry |
| `scenes` | ฉากเสมือน | `is_symbolic_restricted` กัน guardrail ฉากเชิงสัญลักษณ์ |
| `outputs` | ภาพ final + branding | `share_token` + `expires_at` สำหรับ QR/ลิงก์ดาวน์โหลดมีอายุ |
| `audit_logs` | ตรวจสอบย้อนกลับ | append-only, ใช้ทำ Audit Trail (PDPA/RBAC) |

## 2.3 ดัชนีและประสิทธิภาพ (Indexing)

- `render_jobs(status, created_at)` — สำหรับ worker poll + dashboard queue depth
- `outputs(share_token)` UNIQUE — lookup ดาวน์โหลดเร็ว
- `sessions(event_id, started_at)` — รายงานตาม event
- `scenes USING ivfflat (embedding vector_cosine_ops)` — ค้นหา/แนะนำฉากเชิงความหมาย
- Partitioning `audit_logs` และ `downloads` แบบ monthly (range on `created_at`)

## 2.4 นโยบายเก็บรักษาข้อมูล (Retention / PDPA)

| ข้อมูล | ค่าเริ่มต้น | กลไก |
|--------|-------------|------|
| `captures` (ภาพต้นฉบับ) | ลบใน 24 ชม. หลัง render | cron + object lifecycle rule |
| `outputs` (ภาพ final) | 30 วัน (หรือจนสิ้นสุด event) | `expires_at` + lifecycle |
| ข้อมูลชีวมิติ (embedding) | ไม่เก็บถาวร เว้นแต่ยินยอม | ผูกกับ `consents.biometric_ok` |
| `audit_logs` | 1–2 ปี | partition + archive |

> สคีมาเต็มอยู่ใน [`../schema.sql`](../schema.sql) (รวม trigger, index, lifecycle helper)
