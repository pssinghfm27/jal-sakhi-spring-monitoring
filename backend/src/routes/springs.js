// SPDX-License-Identifier: MIT
//
// Spring routes — master list, CRUD, Excel upload, template download, upload history.
//   GET    /springs/master          (auth'd)        full active list (for app sync), supports ?since= for delta
//   GET    /springs/all             (mgr+admin)     all springs with stats (for dashboard management)
//   GET    /springs/upload-history  (mgr+admin)     past upload logs
//   GET    /springs/template        (mgr+admin)     download blank Excel template
//   POST   /springs/upload          (mgr+admin)     upload Excel file of springs
//   POST   /springs                 (mgr+admin)     create a single spring
//   PUT    /springs/:id             (mgr+admin)     update a spring
//   PATCH  /springs/:id/deactivate  (mgr+admin)     soft-delete (active=false)
//   PATCH  /springs/:id/activate    (mgr+admin)     reactivate (active=true)
//   GET    /springs/:id             (auth'd)        single spring detail
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { requireAuth, requireRole, asyncH } from '../middleware/auth.js';
import { audit } from '../db/audit.js';
import { NotFound, BadRequest } from '../utils/errors.js';
import { parseSpringExcel, generateTemplate } from '../services/excelParser.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireAuth);

// GET /springs/master — full active list (for app sync), supports ?since= for delta sync
router.get('/master', asyncH(async (req, res) => {
  const since = req.query.since; // ISO timestamp
  let sql = `
    SELECT s.id, s.code, s.name_en, s.name_hi, s.lat, s.lon, s.altitude_m,
           s.spring_type, s.project_name, s.active, s.updated_at,
           v.id AS village_id, v.name AS village_name, v.gp, v.block, v.district
      FROM springs s JOIN villages v ON v.id = s.village_id
     WHERE s.active = true`;
  const params = [];
  if (since) {
    sql += ` AND s.updated_at > $1`;
    params.push(since);
  }
  sql += ` ORDER BY v.district, v.block, v.name, s.name_en`;
  const { rows } = await query(sql, params);
  res.json({ items: rows, count: rows.length, generated_at: new Date().toISOString() });
}));

// GET /springs/all — all springs with stats (for dashboard spring management table)
router.get('/all', requireRole('manager', 'admin'), asyncH(async (_req, res) => {
  const { rows } = await query(`
    SELECT s.id, s.code, s.name_en, s.name_hi, s.lat, s.lon, s.altitude_m,
           s.spring_type, s.project_name, s.active, s.created_at, s.updated_at,
           v.id AS village_id, v.name AS village_name, v.gp, v.block, v.district,
           (SELECT COUNT(*) FROM discharge_readings dr WHERE dr.spring_id = s.id) AS discharge_count,
           (SELECT COUNT(*) FROM quality_readings qr WHERE qr.spring_id = s.id) AS quality_count,
           (SELECT MAX(dr2.recorded_at) FROM discharge_readings dr2 WHERE dr2.spring_id = s.id) AS last_discharge_at,
           (SELECT MAX(qr2.recorded_at) FROM quality_readings qr2 WHERE qr2.spring_id = s.id) AS last_quality_at
      FROM springs s JOIN villages v ON v.id = s.village_id
     ORDER BY s.active DESC, v.district, v.block, v.name, s.name_en
  `);
  res.json({ items: rows, count: rows.length });
}));

// GET /springs/upload-history — past upload logs
router.get('/upload-history', requireRole('manager', 'admin'), asyncH(async (_req, res) => {
  const { rows } = await query(`
    SELECT su.*, u.name AS uploaded_by_name
      FROM spring_uploads su LEFT JOIN users u ON u.id = su.uploaded_by
     ORDER BY su.created_at DESC LIMIT 50
  `);
  res.json({ items: rows });
}));

// GET /springs/template — download blank Excel template
router.get('/template', requireRole('manager', 'admin'), asyncH(async (_req, res) => {
  const { buffer, filename } = generateTemplate();
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(Buffer.from(buffer));
}));

// POST /springs/upload — upload Excel file of springs (multipart)
router.post('/upload', requireRole('manager', 'admin'), upload.single('file'), asyncH(async (req, res) => {
  if (!req.file) throw BadRequest('No file uploaded');
  const ext = (req.file.originalname || '').split('.').pop()?.toLowerCase();
  if (!['xlsx', 'xls'].includes(ext)) throw BadRequest('File must be .xlsx or .xls');

  const { rows, errors, totalParsed } = parseSpringExcel(req.file.buffer);

  let createdCount = 0;
  let updatedCount = 0;

  await withTx(async (client) => {
    for (const r of rows) {
      // Upsert village
      const { rows: vRows } = await client.query(`
        INSERT INTO villages (name, gp, block, district, updated_at)
        VALUES ($1, $2, $3, $4, now())
        ON CONFLICT (name, block, district) DO UPDATE SET
          gp = COALESCE(EXCLUDED.gp, villages.gp),
          updated_at = now()
        RETURNING id
      `, [r.village, r.gp, r.block, r.district]);
      const villageId = vRows[0].id;

      // Upsert spring
      const { rows: existing } = await client.query(
        'SELECT id FROM springs WHERE code = $1', [r.code],
      );

      if (existing.length) {
        // Update existing
        await client.query(`
          UPDATE springs SET
            name_en = $2, name_hi = $3, village_id = $4, lat = $5, lon = $6,
            altitude_m = $7, spring_type = $8, project_name = $9,
            active = true, updated_at = now(), uploaded_by = $10
          WHERE id = $1
        `, [existing[0].id, r.name_en, r.name_hi, villageId, r.lat, r.lon,
            r.altitude_m, r.spring_type, r.project_name, req.user.sub]);
        updatedCount++;
      } else {
        // Create new
        await client.query(`
          INSERT INTO springs (code, name_en, name_hi, village_id, lat, lon, altitude_m,
                               spring_type, project_name, active, uploaded_by, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, now())
        `, [r.code, r.name_en, r.name_hi, villageId, r.lat, r.lon,
            r.altitude_m, r.spring_type, r.project_name, req.user.sub]);
        createdCount++;
      }
    }

    // Log the upload
    await client.query(`
      INSERT INTO spring_uploads (filename, uploaded_by, total_rows, created_count, updated_count, error_count, errors)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [req.file.originalname, req.user.sub, totalParsed, createdCount, updatedCount,
        errors.length, errors.length ? JSON.stringify(errors) : null]);
  });

  res.json({
    ok: true,
    summary: {
      total_parsed: totalParsed,
      created: createdCount,
      updated: updatedCount,
      errors: errors.length,
      error_details: errors,
    },
  });
}));

// POST /springs — create a single spring
const createSchema = z.object({
  code: z.string().min(1).max(30),
  name_en: z.string().min(1).max(100),
  name_hi: z.string().max(100).optional(),
  village_id: z.string().uuid(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  altitude_m: z.number().optional(),
  spring_type: z.enum(['depression', 'contact', 'fracture', 'artesian', 'seepage']).optional(),
  project_name: z.string().max(100).optional(),
});

router.post('/', requireRole('manager', 'admin'), asyncH(async (req, res) => {
  const v = createSchema.parse(req.body);
  const { rows } = await withTx(async (client) => {
    const result = await client.query(`
      INSERT INTO springs (code, name_en, name_hi, village_id, lat, lon, altitude_m,
                           spring_type, project_name, active, uploaded_by, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, true, $10, now())
      RETURNING *
    `, [v.code, v.name_en, v.name_hi || null, v.village_id, v.lat || null, v.lon || null,
        v.altitude_m || null, v.spring_type || null, v.project_name || null, req.user.sub]);
    await audit(client, {
      table: 'springs', recordId: result.rows[0].id, action: 'insert',
      newValues: result.rows[0], userId: req.user.sub, reason: 'manual creation',
    });
    return result;
  });
  res.status(201).json({ ok: true, spring: rows[0] });
}));

// PUT /springs/:id — update a spring
const updateSchema = z.object({
  code: z.string().min(1).max(30).optional(),
  name_en: z.string().min(1).max(100).optional(),
  name_hi: z.string().max(100).optional(),
  village_id: z.string().uuid().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lon: z.number().min(-180).max(180).nullable().optional(),
  altitude_m: z.number().nullable().optional(),
  spring_type: z.enum(['depression', 'contact', 'fracture', 'artesian', 'seepage']).nullable().optional(),
  project_name: z.string().max(100).nullable().optional(),
});

router.put('/:id', requireRole('manager', 'admin'), asyncH(async (req, res) => {
  const v = updateSchema.parse(req.body);
  const id = req.params.id;
  const { rows: before } = await query('SELECT * FROM springs WHERE id = $1', [id]);
  if (!before.length) throw NotFound('Spring not found');

  const sets = [];
  const params = [id];
  let pi = 2;
  for (const [key, val] of Object.entries(v)) {
    if (val !== undefined) {
      sets.push(`${key} = $${pi}`);
      params.push(val);
      pi++;
    }
  }
  if (!sets.length) throw BadRequest('No fields to update');
  sets.push('updated_at = now()');

  await withTx(async (client) => {
    const { rows } = await client.query(
      `UPDATE springs SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params,
    );
    await audit(client, {
      table: 'springs', recordId: id, action: 'update',
      oldValues: before[0], newValues: rows[0],
      userId: req.user.sub, reason: 'manual update',
    });
    res.json({ ok: true, spring: rows[0] });
  });
}));

// PATCH /springs/:id/deactivate
router.patch('/:id/deactivate', requireRole('manager', 'admin'), asyncH(async (req, res) => {
  const { rows } = await query(
    `UPDATE springs SET active = false, updated_at = now() WHERE id = $1 RETURNING id, code, name_en, active`,
    [req.params.id],
  );
  if (!rows.length) throw NotFound('Spring not found');
  res.json({ ok: true, spring: rows[0] });
}));

// PATCH /springs/:id/activate
router.patch('/:id/activate', requireRole('manager', 'admin'), asyncH(async (req, res) => {
  const { rows } = await query(
    `UPDATE springs SET active = true, updated_at = now() WHERE id = $1 RETURNING id, code, name_en, active`,
    [req.params.id],
  );
  if (!rows.length) throw NotFound('Spring not found');
  res.json({ ok: true, spring: rows[0] });
}));

// GET /springs/:id — single spring detail (keep last for route matching)
router.get('/:id', asyncH(async (req, res) => {
  const { rows } = await query(`
    SELECT s.*, v.name AS village_name, v.gp, v.block, v.district
      FROM springs s JOIN villages v ON v.id = s.village_id
     WHERE s.id = $1
  `, [req.params.id]);
  if (!rows.length) throw NotFound('Spring not found');
  res.json(rows[0]);
}));

export default router;
