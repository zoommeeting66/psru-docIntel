-- ============================================================
-- PSRU DocIntel — D1 Schema (Round 1: Documents + Search)
-- SQLite / Cloudflare D1
-- ใช้ trigram tokenizer เพื่อรองรับการค้นหาภาษาไทย (ไม่มีช่องว่างระหว่างคำ)
-- ============================================================

DROP TABLE IF EXISTS document_relations;
DROP TABLE IF EXISTS document_sections;
DROP TABLE IF EXISTS documents_fts;
DROP TABLE IF EXISTS documents;

-- ---------- เอกสารหลัก ----------
CREATE TABLE documents (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  document_type   TEXT NOT NULL,
  document_number TEXT,
  issue_date      TEXT,
  effective_date  TEXT,
  expired_date    TEXT,
  organization    TEXT,
  signer          TEXT,
  status          TEXT NOT NULL DEFAULT 'active',  -- active|draft|cancelled|amended|archived
  version         TEXT DEFAULT '1.0',
  category        TEXT,
  risk            TEXT DEFAULT 'low',              -- low|medium|high
  views           INTEGER DEFAULT 0,
  tags            TEXT,                            -- JSON array เช่น ["จัดซื้อจัดจ้าง","พัสดุ"]
  abstract        TEXT,
  full_text       TEXT,
  file_url        TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_docs_type   ON documents(document_type);
CREATE INDEX idx_docs_status ON documents(status);
CREATE INDEX idx_docs_org    ON documents(organization);
CREATE INDEX idx_docs_issue  ON documents(issue_date);

-- ---------- ความสัมพันธ์ระหว่างเอกสาร ----------
CREATE TABLE document_relations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id     TEXT NOT NULL,
  target_id     TEXT NOT NULL,
  relation_type TEXT NOT NULL,   -- references|replaces|amends|cancels|related_to|parent_of|child_of
  description   TEXT
);
CREATE INDEX idx_rel_source ON document_relations(source_id);

-- ---------- ส่วน/ข้อ ของเอกสาร (สำหรับ citation + ค้นหาละเอียด) ----------
CREATE TABLE document_sections (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id    TEXT NOT NULL,
  section_number TEXT,
  section_title  TEXT,
  page_number    INTEGER,
  content        TEXT
);
CREATE INDEX idx_sec_doc ON document_sections(document_id);

-- ---------- Full-Text Search (trigram = รองรับไทย) ----------
CREATE VIRTUAL TABLE documents_fts USING fts5(
  id UNINDEXED,
  title,
  abstract,
  tags,
  full_text,
  tokenize = 'trigram'
);

-- triggers ให้ FTS sync กับตารางหลักอัตโนมัติ
CREATE TRIGGER documents_ai AFTER INSERT ON documents BEGIN
  INSERT INTO documents_fts(id,title,abstract,tags,full_text)
  VALUES (new.id,new.title,new.abstract,new.tags,new.full_text);
END;
CREATE TRIGGER documents_ad AFTER DELETE ON documents BEGIN
  DELETE FROM documents_fts WHERE id = old.id;
END;
CREATE TRIGGER documents_au AFTER UPDATE ON documents BEGIN
  DELETE FROM documents_fts WHERE id = old.id;
  INSERT INTO documents_fts(id,title,abstract,tags,full_text)
  VALUES (new.id,new.title,new.abstract,new.tags,new.full_text);
END;
