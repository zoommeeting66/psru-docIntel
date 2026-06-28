-- =====================================================================
-- PSRU AI Virtual Photo Booth & VR Studio
-- PostgreSQL 16 schema (+ pgvector)
-- =====================================================================
-- หลักการ: เก็บเฉพาะ key/URL ของไฟล์ใน Object Storage, ไม่เก็บ binary ใน DB
--          แยก consent แบบ granular, audit append-only, รองรับ retention/PDPA
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;        -- pgvector

-- ---------- Identity & Access ----------------------------------------
CREATE TABLE roles (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL UNIQUE,          -- admin, operator, executive, user
    permissions jsonb NOT NULL DEFAULT '[]',   -- RBAC permission keys
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email        text UNIQUE,
    display_name text,
    role_id      uuid REFERENCES roles(id),
    sso_subject  text UNIQUE,                  -- OIDC subject (Keycloak)
    mfa_enabled  boolean NOT NULL DEFAULT false,
    is_active    boolean NOT NULL DEFAULT true,
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------- Events & Branding ----------------------------------------
CREATE TABLE branding_templates (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL,
    logo_key   text,
    frame_key  text,
    watermark  jsonb NOT NULL DEFAULT '{}',    -- {text, opacity, position}
    show_qr    boolean NOT NULL DEFAULT true,
    layout     jsonb NOT NULL DEFAULT '{}',    -- title/date/image_no placement
    is_active  boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE events (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                text NOT NULL,
    slug                text UNIQUE NOT NULL,
    start_date          date,
    end_date            date,
    default_branding_id uuid REFERENCES branding_templates(id),
    is_active           boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- ---------- Scenes / Outfits / AI prompts ----------------------------
CREATE TABLE scene_categories (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL,
    sort_order int  NOT NULL DEFAULT 0
);

CREATE TABLE ai_prompts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    positive_prompt text NOT NULL,
    negative_prompt text NOT NULL DEFAULT '',
    params          jsonb NOT NULL DEFAULT '{}',  -- {steps, cfg, controlnet, seed}
    model_ref       text NOT NULL,                -- e.g. sdxl-1.0 + controlnet-depth
    version         int  NOT NULL DEFAULT 1,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE scenes (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id            uuid REFERENCES scene_categories(id),
    name                   text NOT NULL,
    thumbnail_key          text,
    hdri_key               text,                  -- HDRI สำหรับ relighting
    asset_3d_key           text,                  -- glTF/USDZ สำหรับ VR
    ai_prompt_id           uuid REFERENCES ai_prompts(id),
    embedding              vector(768),           -- semantic search/recommend
    is_360                 boolean NOT NULL DEFAULT false,
    is_symbolic_restricted boolean NOT NULL DEFAULT false, -- guardrail
    is_active              boolean NOT NULL DEFAULT true,
    created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE outfits (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name              text NOT NULL,
    category          text,                       -- gown, suit, thai, student...
    preview_key       text,
    control_asset_key text,                       -- ControlNet/IP-Adapter reference
    is_active         boolean NOT NULL DEFAULT true,
    created_at        timestamptz NOT NULL DEFAULT now()
);

-- ---------- Sessions / Consent / Captures ----------------------------
CREATE TABLE sessions (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid REFERENCES users(id),         -- NULL = guest/kiosk
    event_id   uuid REFERENCES events(id),
    channel    text NOT NULL CHECK (channel IN ('web','mobile','kiosk','vr')),
    device_id  text,
    status     text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','completed','expired','abandoned')),
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at   timestamptz
);

CREATE TABLE consents (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id     uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    biometric_ok   boolean NOT NULL DEFAULT false, -- face/pose analysis
    age_gender_ok  boolean NOT NULL DEFAULT false, -- optional demographics
    marketing_ok   boolean NOT NULL DEFAULT false, -- use in PR materials
    policy_version text NOT NULL,
    ip_address     inet,
    consented_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE captures (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    source_type  text NOT NULL,                   -- webcam/dslr/mirrorless/mobile/kiosk
    storage_key  text NOT NULL,                   -- encrypted original
    width        int,
    height       int,
    people_count int DEFAULT 1,
    exif         jsonb NOT NULL DEFAULT '{}',
    purge_after  timestamptz,                     -- retention TTL
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------- Render jobs / Outputs ------------------------------------
CREATE TABLE render_jobs (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    capture_id     uuid NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
    scene_id       uuid REFERENCES scenes(id),
    outfit_id      uuid REFERENCES outfits(id),
    fx             jsonb NOT NULL DEFAULT '{}',   -- {snow,rain,confetti,sunset,...}
    pipeline_steps jsonb NOT NULL DEFAULT '{}',   -- per-stage status/metrics
    status         text NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','running','succeeded','failed','canceled')),
    progress       int  NOT NULL DEFAULT 0,
    gpu_node       text,
    duration_ms    int,
    error          text,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE outputs (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    render_job_id uuid NOT NULL REFERENCES render_jobs(id) ON DELETE CASCADE,
    branding_id   uuid REFERENCES branding_templates(id),
    image_no      text,                            -- running image number per event
    final_key     text NOT NULL,
    thumb_key     text,
    formats       jsonb NOT NULL DEFAULT '{}',     -- {jpg,png,tiff,pdf keys}
    share_token   text UNIQUE,
    expires_at    timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE downloads (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    output_id  uuid NOT NULL REFERENCES outputs(id) ON DELETE CASCADE,
    format     text NOT NULL,
    channel    text,                               -- qr/email/social/direct
    ip_address inet,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE feedback (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    output_id  uuid NOT NULL REFERENCES outputs(id) ON DELETE CASCADE,
    rating     int CHECK (rating BETWEEN 1 AND 5),
    comment    text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Audit (append-only) --------------------------------------
CREATE TABLE audit_logs (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id   uuid REFERENCES users(id),
    action     text NOT NULL,                      -- login, scene.update, output.delete...
    entity     text,
    entity_id  text,
    metadata   jsonb NOT NULL DEFAULT '{}',
    ip_address inet,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Indexes --------------------------------------------------
CREATE INDEX idx_jobs_status_created ON render_jobs(status, created_at);
CREATE INDEX idx_sessions_event_time ON sessions(event_id, started_at);
CREATE INDEX idx_captures_session    ON captures(session_id);
CREATE INDEX idx_outputs_job         ON outputs(render_job_id);
CREATE INDEX idx_downloads_output    ON downloads(output_id);
CREATE INDEX idx_audit_actor_time    ON audit_logs(actor_id, created_at);
CREATE INDEX idx_scenes_active       ON scenes(is_active) WHERE is_active;
-- semantic recommend (build after data load):
-- CREATE INDEX idx_scenes_embedding ON scenes USING ivfflat (embedding vector_cosine_ops);

-- ---------- updated_at trigger ---------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON render_jobs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- Seed: roles & scene categories ---------------------------
INSERT INTO roles (name, permissions) VALUES
 ('admin',     '["*"]'),
 ('operator',  '["session.*","capture.*","output.read","scene.read"]'),
 ('executive', '["dashboard.read","report.read"]'),
 ('user',      '["session.self","output.self"]')
ON CONFLICT (name) DO NOTHING;

INSERT INTO scene_categories (name, sort_order) VALUES
 ('PSRU Campus', 1), ('พิธีการ/Ceremony', 2), ('Academic', 3),
 ('Studio/News', 4), ('Future/Sci-Fi', 5), ('Nature', 6),
 ('Heritage/วัฒนธรรม', 7), ('VIP', 8)
ON CONFLICT DO NOTHING;
