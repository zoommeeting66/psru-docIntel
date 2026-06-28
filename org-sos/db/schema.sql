-- =====================================================================
-- Organization SOS — PostgreSQL 16 + PostGIS 3.4 schema (baseline v1.0)
-- ภาพรวมและคำอธิบาย: ../docs/04-database-schema.md
-- หมายเหตุ: ฟิลด์ที่ลงท้าย _enc เก็บ ciphertext (app-level envelope encryption)
-- =====================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid / digest
CREATE EXTENSION IF NOT EXISTS ltree;        -- org hierarchy path

-- UUIDv7 helper (time-ordered). หากใช้ pg_uuidv7 extension ให้แทนที่ฟังก์ชันนี้ได้
CREATE OR REPLACE FUNCTION uuid_generate_v7() RETURNS uuid AS $$
DECLARE
  ts_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  rand bytea := gen_random_bytes(10);
  out bytea;
BEGIN
  out := set_byte(set_byte(set_byte(set_byte(set_byte(set_byte(
           ('\x00000000000000000000000000000000'::bytea),
           0,(ts_ms >> 40)::int & 255),1,(ts_ms >> 32)::int & 255),
           2,(ts_ms >> 24)::int & 255),3,(ts_ms >> 16)::int & 255),
           4,(ts_ms >> 8)::int & 255),5,(ts_ms)::int & 255);
  out := set_byte(out,6, (112 | (get_byte(rand,0) & 15)));      -- version 7
  out := set_byte(out,7, get_byte(rand,1));
  out := set_byte(out,8, (128 | (get_byte(rand,2) & 63)));      -- variant
  FOR i IN 9..15 LOOP out := set_byte(out, i, get_byte(rand, i-6)); END LOOP;
  RETURN encode(out,'hex')::uuid;
END $$ LANGUAGE plpgsql VOLATILE;

-- ---------------------------------------------------------------------
-- Organization & People
-- ---------------------------------------------------------------------
CREATE TABLE org_unit (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  code        text UNIQUE NOT NULL,
  name        text NOT NULL,
  parent_id   uuid REFERENCES org_unit(id),
  path        ltree,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_org_unit_path ON org_unit USING gist(path);

CREATE TABLE person (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  employee_code    text UNIQUE NOT NULL,
  full_name        text NOT NULL,
  position         text,
  org_unit_id      uuid REFERENCES org_unit(id),
  phone            text,
  email            text,
  reports_to_id    uuid REFERENCES person(id),
  work_location_id uuid,                       -- FK -> location_ref (deferred)
  source_system    text,                       -- hris|ldap|ad|entra|google
  external_id      text,
  status           text NOT NULL DEFAULT 'active', -- active|inactive|left
  synced_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);
CREATE INDEX idx_person_org   ON person(org_unit_id);
CREATE INDEX idx_person_mgr   ON person(reports_to_id);
CREATE UNIQUE INDEX idx_person_src ON person(source_system, external_id);

-- Consent (PDPA) — ต้องมีก่อนเก็บข้อมูลอ่อนไหว
CREATE TABLE consent (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  person_id   uuid NOT NULL REFERENCES person(id),
  purpose     text NOT NULL,        -- emergency_health_disclosure | emergency_contact | location_tracking
  scope       jsonb NOT NULL DEFAULT '{}'::jsonb,
  legal_basis text NOT NULL DEFAULT 'consent', -- consent | vital_interest | legitimate_interest
  granted     boolean NOT NULL,
  version     text NOT NULL,
  granted_at  timestamptz,
  revoked_at  timestamptz,
  source_ip   inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_consent_person ON consent(person_id, purpose);
CREATE INDEX idx_consent_scope  ON consent USING gin(scope);

CREATE TABLE person_health (
  person_id          uuid PRIMARY KEY REFERENCES person(id),
  blood_type         text,
  chronic_conditions_enc bytea,
  allergies_enc      bytea,
  medications_enc    bytea,
  notes_enc          bytea,
  consent_id         uuid REFERENCES consent(id),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE emergency_contact (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  person_id     uuid NOT NULL REFERENCES person(id),
  name          text NOT NULL,
  relationship  text,
  phone_enc     bytea,
  email_enc     bytea,
  priority      int NOT NULL DEFAULT 1,
  consent_id    uuid REFERENCES consent(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX idx_ec_person ON emergency_contact(person_id);

CREATE TABLE device (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  person_id    uuid NOT NULL REFERENCES person(id),
  platform     text NOT NULL,            -- android | ios
  push_token   text,
  app_version  text,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {ble,wifi_direct,lora,satellite}
  trusted      boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_device_person ON device(person_id);
CREATE INDEX idx_device_caps   ON device USING gin(capabilities);

-- ---------------------------------------------------------------------
-- Location references (buildings / floors / rooms / beacons / QR)
-- ---------------------------------------------------------------------
CREATE TABLE location_ref (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  kind        text NOT NULL,        -- building|floor|room|beacon|qr
  code        text,
  name        text,
  parent_id   uuid REFERENCES location_ref(id),
  floor_no    int,
  beacon_uuid text,
  major       int,
  minor       int,
  geom        geometry,             -- point/polygon depending on kind
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_locref_geom ON location_ref USING gist(geom);
CREATE INDEX idx_locref_beacon ON location_ref(beacon_uuid, major, minor);
ALTER TABLE person
  ADD CONSTRAINT fk_person_workloc
  FOREIGN KEY (work_location_id) REFERENCES location_ref(id);

-- ---------------------------------------------------------------------
-- Incident core
-- ---------------------------------------------------------------------
CREATE TABLE incident_type (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  code             text UNIQUE NOT NULL,
  name_th          text NOT NULL,
  name_en          text NOT NULL,
  default_severity text NOT NULL DEFAULT 'high',
  icon             text,
  sort_order       int  NOT NULL DEFAULT 0,
  active           boolean NOT NULL DEFAULT true
);

CREATE TABLE incident (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  incident_uuid      uuid UNIQUE NOT NULL,     -- client-generated, dedupe key
  reported_by_id     uuid NOT NULL REFERENCES person(id),
  type_id            uuid REFERENCES incident_type(id),
  severity           text NOT NULL DEFAULT 'high', -- critical|high|medium|low
  status             text NOT NULL DEFAULT 'new',  -- new|acknowledged|dispatched|enroute|onsite|resolved|closed|canceled
  channel_first      text,                    -- online|sms|ble|wifi_direct|lora|satellite|store_forward
  channels           jsonb NOT NULL DEFAULT '[]'::jsonb,
  battery_pct        int,
  network_status     text,
  is_test            boolean NOT NULL DEFAULT false,
  primary_location_id uuid,                    -- FK -> incident_location (deferred)
  created_at         timestamptz NOT NULL DEFAULT now(),
  acknowledged_at    timestamptz,
  resolved_at        timestamptz,
  closed_at          timestamptz,
  deleted_at         timestamptz,
  CONSTRAINT chk_status CHECK (status IN
    ('new','acknowledged','dispatched','enroute','onsite','resolved','closed','canceled')),
  CONSTRAINT chk_sev CHECK (severity IN ('critical','high','medium','low'))
);
CREATE INDEX idx_incident_status ON incident(status, created_at DESC);
CREATE INDEX idx_incident_reporter ON incident(reported_by_id, created_at DESC);

CREATE TABLE incident_location (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  incident_id  uuid NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
  geom         geography(Point,4326),
  accuracy_m   numeric,
  source       text NOT NULL,        -- gps|beacon|wifi|qr|manual|last_known
  building_id  uuid REFERENCES location_ref(id),
  floor        int,
  room         text,
  is_last_known boolean NOT NULL DEFAULT false,
  captured_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_incloc_geom ON incident_location USING gist(geom);
CREATE INDEX idx_incloc_inc  ON incident_location(incident_id, captured_at);
ALTER TABLE incident
  ADD CONSTRAINT fk_incident_primaryloc
  FOREIGN KEY (primary_location_id) REFERENCES incident_location(id);

CREATE TABLE incident_event (   -- append-only timeline
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  incident_id uuid NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES person(id),
  event_type  text NOT NULL,    -- created|location_update|status_change|note|assignment|notification|broadcast|sync_merged
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  channel     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_incevent_inc ON incident_event(incident_id, created_at);

CREATE TABLE incident_assignment (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  incident_id  uuid NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
  responder_id uuid NOT NULL REFERENCES person(id),
  role         text NOT NULL DEFAULT 'responder', -- responder|supervisor|coordinator
  assigned_by  uuid REFERENCES person(id),
  assigned_at  timestamptz NOT NULL DEFAULT now(),
  accepted_at  timestamptz,
  arrived_at   timestamptz,
  released_at  timestamptz,
  outcome      text
);
CREATE INDEX idx_assign_inc ON incident_assignment(incident_id);
CREATE INDEX idx_assign_resp ON incident_assignment(responder_id, assigned_at DESC);

CREATE TABLE attachment (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  incident_id uuid NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES person(id),
  object_key  text NOT NULL,
  mime        text,
  size        bigint,
  kind        text,            -- photo|audio|report|other
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_log (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  incident_id      uuid REFERENCES incident(id) ON DELETE SET NULL,
  channel          text NOT NULL,   -- push|sms|line|email|dashboard
  target_person_id uuid REFERENCES person(id),
  target_addr_masked text,
  status           text NOT NULL DEFAULT 'queued', -- queued|sent|delivered|failed
  provider_ref     text,
  error            text,
  sent_at          timestamptz
);
CREATE INDEX idx_notiflog_inc ON notification_log(incident_id);

CREATE TABLE broadcast (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  created_by  uuid REFERENCES person(id),
  title       text NOT NULL,
  body        text,
  audience    jsonb NOT NULL DEFAULT '{}'::jsonb,
  geofence    geometry,
  severity    text NOT NULL DEFAULT 'medium',
  sent_at     timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_broadcast_geo ON broadcast USING gist(geofence);

-- Dedupe receipts across offline channels
CREATE TABLE sync_outbox_receipt (
  incident_uuid       uuid PRIMARY KEY,
  first_seen_channel  text,
  first_seen_at       timestamptz NOT NULL DEFAULT now(),
  merged_incident_id  uuid REFERENCES incident(id)
);

-- ---------------------------------------------------------------------
-- Audit log (append-only; REVOKE update/delete in production roles)
-- ---------------------------------------------------------------------
CREATE TABLE audit_log (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  actor_id       uuid REFERENCES person(id),
  action         text NOT NULL,       -- read|create|update|delete|export|login
  resource_type  text NOT NULL,
  resource_id    text,
  purpose        text,
  fields_accessed jsonb,
  ip             inet,
  user_agent     text,
  request_id     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_actor ON audit_log(actor_id, created_at DESC);
CREATE INDEX idx_audit_res   ON audit_log(resource_type, resource_id);

-- ---------------------------------------------------------------------
-- Seed: incident types
-- ---------------------------------------------------------------------
INSERT INTO incident_type (code,name_th,name_en,default_severity,sort_order) VALUES
 ('medical','เจ็บป่วยฉุกเฉิน','Medical emergency','critical',1),
 ('accident','อุบัติเหตุ','Accident','high',2),
 ('security_threat','ถูกคุกคาม/ความปลอดภัย','Security threat','critical',3),
 ('fire','ไฟไหม้','Fire','critical',4),
 ('flood','น้ำท่วม','Flood','high',5),
 ('trapped','ติดอยู่ในอาคาร','Trapped','high',6),
 ('general','ขอความช่วยเหลือทั่วไป','General assistance','medium',7),
 ('other','อื่น ๆ','Other','medium',8)
ON CONFLICT (code) DO NOTHING;

COMMIT;
