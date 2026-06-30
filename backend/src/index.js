/**
 * PSRU DocIntel — Cloudflare Worker API
 * Round 1: Documents + Search (เอกสาร + ค้นหา)
 *
 * Bindings (wrangler.toml):
 *   DB  -> D1 database "psru-docintel"
 *
 * Endpoints:
 *   GET    /api/health
 *   GET    /api/stats
 *   GET    /api/documents?type=&status=&year=&org=&q=&limit=&offset=
 *   GET    /api/documents/:id
 *   POST   /api/documents
 *   PUT    /api/documents/:id
 *   DELETE /api/documents/:id
 *   GET    /api/search?q=...
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });

const err = (message, status = 400) => json({ error: message }, status);

// แปลงแถวจาก DB ให้พร้อมใช้งานฝั่ง frontend (tags เป็น array)
function shape(row) {
  if (!row) return row;
  let tags = [];
  try { tags = row.tags ? JSON.parse(row.tags) : []; } catch { tags = []; }
  const related = row.related_ids ? String(row.related_ids).split(',') : [];
  const out = { ...row, tags, related };
  delete out.related_ids;
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = request.method;

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    try {
      // ---------- health ----------
      if (path === '/api/health') {
        return json({ ok: true, service: 'psru-docintel-api', time: new Date().toISOString() });
      }

      // ---------- stats (สำหรับ Dashboard) ----------
      if (path === '/api/stats' && method === 'GET') {
        const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM documents').first();
        const byStatus = await env.DB.prepare(
          'SELECT status, COUNT(*) AS n FROM documents GROUP BY status'
        ).all();
        const byType = await env.DB.prepare(
          'SELECT document_type AS type, COUNT(*) AS n FROM documents GROUP BY document_type'
        ).all();
        const byYear = await env.DB.prepare(
          "SELECT substr(issue_date,1,4) AS year, COUNT(*) AS n FROM documents GROUP BY year ORDER BY year"
        ).all();
        const highRisk = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM documents WHERE risk='high'"
        ).first();
        return json({
          total: total.n,
          high_risk: highRisk.n,
          by_status: byStatus.results,
          by_type: byType.results,
          by_year: byYear.results,
        });
      }

      // ---------- search (FTS trigram) ----------
      if (path === '/api/search' && method === 'GET') {
        const q = (url.searchParams.get('q') || '').trim();
        if (!q) return json({ query: q, count: 0, results: [] });
        // trigram ต้องการอย่างน้อย 3 ตัวอักษร; เผื่อสั้นกว่านั้น fallback เป็น LIKE
        let rows;
        if (q.length >= 3) {
          const stmt = env.DB.prepare(
            `SELECT d.*, bm25(documents_fts) AS rank,
                    snippet(documents_fts, 2, '[', ']', '…', 12) AS snippet
             FROM documents_fts
             JOIN documents d ON d.id = documents_fts.id
             WHERE documents_fts MATCH ?
             ORDER BY rank LIMIT 50`
          ).bind('"' + q.replace(/"/g, '') + '"');
          rows = await stmt.all();
        } else {
          rows = await env.DB.prepare(
            `SELECT *, NULL AS rank, NULL AS snippet FROM documents
             WHERE title LIKE ?1 OR abstract LIKE ?1 OR tags LIKE ?1 LIMIT 50`
          ).bind('%' + q + '%').all();
        }
        return json({ query: q, count: rows.results.length, results: rows.results.map(shape) });
      }

      // ---------- documents collection ----------
      if (path === '/api/documents') {
        if (method === 'GET') {
          const p = url.searchParams;
          const where = [], bind = [];
          if (p.get('type'))   { where.push('document_type = ?'); bind.push(p.get('type')); }
          if (p.get('status')) { where.push('status = ?');        bind.push(p.get('status')); }
          if (p.get('org'))    { where.push('organization = ?');  bind.push(p.get('org')); }
          if (p.get('year'))   { where.push("substr(issue_date,1,4) = ?"); bind.push(p.get('year')); }
          if (p.get('q')) {
            where.push('(title LIKE ? OR abstract LIKE ? OR tags LIKE ?)');
            const kw = '%' + p.get('q') + '%'; bind.push(kw, kw, kw);
          }
          const limit  = Math.min(parseInt(p.get('limit') || '100', 10), 200);
          const offset = parseInt(p.get('offset') || '0', 10);
          const sql = `SELECT *,
                         (SELECT GROUP_CONCAT(target_id) FROM document_relations WHERE source_id = documents.id) AS related_ids
                       FROM documents ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                       ORDER BY issue_date DESC LIMIT ${limit} OFFSET ${offset}`;
          const rows = await env.DB.prepare(sql).bind(...bind).all();
          return json(rows.results.map(shape));
        }
        if (method === 'POST') {
          const b = await request.json();
          if (!b.id || !b.title || !b.document_type)
            return err('ต้องระบุ id, title, document_type');
          await env.DB.prepare(
            `INSERT INTO documents
             (id,title,document_type,document_number,issue_date,effective_date,expired_date,
              organization,signer,status,version,category,risk,views,tags,abstract,full_text,file_url)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
          ).bind(
            b.id, b.title, b.document_type, b.document_number ?? null, b.issue_date ?? null,
            b.effective_date ?? null, b.expired_date ?? null, b.organization ?? null, b.signer ?? null,
            b.status ?? 'active', b.version ?? '1.0', b.category ?? null, b.risk ?? 'low',
            b.views ?? 0, JSON.stringify(b.tags ?? []), b.abstract ?? null, b.full_text ?? null, b.file_url ?? null
          ).run();
          return json({ ok: true, id: b.id }, 201);
        }
      }

      // ---------- single document ----------
      const m = path.match(/^\/api\/documents\/([^/]+)$/);
      if (m) {
        const id = decodeURIComponent(m[1]);
        if (method === 'GET') {
          const doc = await env.DB.prepare('SELECT * FROM documents WHERE id = ?').bind(id).first();
          if (!doc) return err('ไม่พบเอกสาร', 404);
          // นับวิว + ดึงความสัมพันธ์ + ข้อ/ส่วน
          await env.DB.prepare('UPDATE documents SET views = views + 1 WHERE id = ?').bind(id).run();
          const rels = await env.DB.prepare(
            `SELECT r.relation_type, r.description, r.target_id, t.title AS target_title, t.document_number AS target_number
             FROM document_relations r LEFT JOIN documents t ON t.id = r.target_id
             WHERE r.source_id = ?`
          ).bind(id).all();
          const secs = await env.DB.prepare(
            'SELECT section_number, section_title, page_number, content FROM document_sections WHERE document_id = ?'
          ).bind(id).all();
          return json({ ...shape(doc), relations: rels.results, sections: secs.results });
        }
        if (method === 'PUT') {
          const b = await request.json();
          const fields = ['title','document_type','document_number','issue_date','effective_date',
            'expired_date','organization','signer','status','version','category','risk','abstract','full_text','file_url'];
          const set = [], bind = [];
          for (const f of fields) if (f in b) { set.push(`${f} = ?`); bind.push(b[f]); }
          if ('tags' in b) { set.push('tags = ?'); bind.push(JSON.stringify(b.tags)); }
          if (!set.length) return err('ไม่มีฟิลด์ให้แก้ไข');
          set.push("updated_at = datetime('now')");
          bind.push(id);
          const r = await env.DB.prepare(
            `UPDATE documents SET ${set.join(', ')} WHERE id = ?`
          ).bind(...bind).run();
          if (!r.meta.changes) return err('ไม่พบเอกสาร', 404);
          return json({ ok: true, id });
        }
        if (method === 'DELETE') {
          const r = await env.DB.prepare('DELETE FROM documents WHERE id = ?').bind(id).run();
          await env.DB.prepare('DELETE FROM document_relations WHERE source_id = ? OR target_id = ?').bind(id, id).run();
          if (!r.meta.changes) return err('ไม่พบเอกสาร', 404);
          return json({ ok: true, deleted: id });
        }
      }

      // ========================================================
      // Surveys (แบบสำรวจการเข้าร่วมกิจกรรมของผู้บริหาร)
      // ========================================================

      // ---------- responses collection ----------
      const rm = path.match(/^\/api\/surveys\/([^/]+)\/responses$/);
      if (rm) {
        const sid = decodeURIComponent(rm[1]);
        if (method === 'POST') {
          const b = await request.json();
          if (b.no == null) return err('ต้องระบุ no (ลำดับผู้ตอบ)');
          const s = await env.DB.prepare('SELECT deadline FROM surveys WHERE sid = ?').bind(sid).first();
          if (s && s.deadline && Date.now() > Number(s.deadline)) return err('ปิดรับคำตอบแล้ว', 403);
          await env.DB.prepare(
            `INSERT INTO survey_responses (sid,no,name,answers,submitted_at)
             VALUES (?,?,?,?,datetime('now'))
             ON CONFLICT(sid,no) DO UPDATE SET name=excluded.name, answers=excluded.answers, submitted_at=datetime('now')`
          ).bind(sid, b.no, b.name ?? null, JSON.stringify(b.answers ?? [])).run();
          return json({ ok: true }, 201);
        }
        if (method === 'GET') {
          const r = await env.DB.prepare(
            'SELECT no,name,answers,submitted_at FROM survey_responses WHERE sid = ? ORDER BY no'
          ).bind(sid).all();
          const responses = r.results.map(x => {
            let a = []; try { a = JSON.parse(x.answers || '[]'); } catch {}
            return { no: x.no, name: x.name, answers: a, submitted_at: x.submitted_at };
          });
          return json({ sid, count: responses.length, responses });
        }
      }

      // ---------- survey publish / fetch ----------
      const sm = path.match(/^\/api\/surveys\/([^/]+)$/);
      if (sm) {
        const sid = decodeURIComponent(sm[1]);
        if (method === 'PUT' || method === 'POST') {
          const b = await request.json();
          await env.DB.prepare(
            `INSERT INTO surveys (sid,label,deadline,activities)
             VALUES (?,?,?,?)
             ON CONFLICT(sid) DO UPDATE SET label=excluded.label, deadline=excluded.deadline, activities=excluded.activities`
          ).bind(sid, b.label ?? null, b.deadline ?? null, JSON.stringify(b.activities ?? [])).run();
          return json({ ok: true, sid });
        }
        if (method === 'GET') {
          const s = await env.DB.prepare('SELECT * FROM surveys WHERE sid = ?').bind(sid).first();
          if (!s) return err('ไม่พบแบบสำรวจ', 404);
          const r = await env.DB.prepare(
            'SELECT no,name,answers,submitted_at FROM survey_responses WHERE sid = ? ORDER BY no'
          ).bind(sid).all();
          let activities = []; try { activities = JSON.parse(s.activities || '[]'); } catch {}
          const responses = r.results.map(x => {
            let a = []; try { a = JSON.parse(x.answers || '[]'); } catch {}
            return { no: x.no, name: x.name, answers: a, submitted_at: x.submitted_at };
          });
          return json({ sid: s.sid, label: s.label, deadline: s.deadline, activities, responses });
        }
      }

      return err('ไม่พบ endpoint ที่ระบุ', 404);
    } catch (e) {
      return err('เกิดข้อผิดพลาด: ' + e.message, 500);
    }
  },
};
