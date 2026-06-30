-- ============================================================
-- PSRU — Survey schema (แบบสำรวจการเข้าร่วมกิจกรรมของผู้บริหาร)
-- ใช้ CREATE TABLE IF NOT EXISTS เพื่อไม่กระทบตารางเอกสารเดิม
-- รันด้วย: npm run db:survey
-- ============================================================

CREATE TABLE IF NOT EXISTS surveys (
  sid        TEXT PRIMARY KEY,
  label      TEXT,
  deadline   INTEGER,          -- epoch ms (null = ไม่มีกำหนดปิด)
  activities TEXT,             -- JSON: [{title,when,where}]
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS survey_responses (
  sid          TEXT NOT NULL,
  no           INTEGER NOT NULL,   -- ลำดับผู้บริหาร (1..10)
  name         TEXT,
  answers      TEXT,               -- JSON: ["attend"|"absent"|"pending", ...] ตามลำดับกิจกรรม
  submitted_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (sid, no)            -- ตอบซ้ำ = อัปเดตคำตอบเดิม
);

CREATE INDEX IF NOT EXISTS idx_resp_sid ON survey_responses(sid);
