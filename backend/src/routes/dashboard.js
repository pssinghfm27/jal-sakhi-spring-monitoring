// SPDX-License-Identifier: MIT
import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, requireRole, asyncH } from '../middleware/auth.js';
import { computeHealthScore } from '../services/healthScore.js';
import { classifyQualityReading } from '../services/bis.js';
import { NotFound } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

// GET /dashboard/summary — counts, status mix, latest activity
router.get('/summary', requireRole('manager', 'admin'), asyncH(async (_req, res) => {
  const [{ rows: counts }, { rows: status }, { rows: recent }] = await Promise.all([
    query(`
      SELECT
        (SELECT COUNT(*) FROM springs WHERE active) AS springs,
        (SELECT COUNT(*) FROM users WHERE role='krp' AND active) AS krps,
        (SELECT COUNT(*) FROM villages) AS villages,
        (SELECT COUNT(*) FROM discharge_readings WHERE recorded_at > now()-interval '30 days') AS discharge_30d,
        (SELECT COUNT(*) FROM quality_readings   WHERE recorded_at > now()-interval '30 days') AS quality_30d
    `),
    // Latest quality per spring → classify, then aggregate
    query(`
      WITH latest AS (
        SELECT DISTINCT ON (spring_id) spring_id, recorded_at,
               ph, tds, turbidity, hardness, alkalinity, chloride, iron, fecal_coliform
          FROM quality_readings ORDER BY spring_id, recorded_at DESC
      )
      SELECT s.id, s.name_en, l.ph, l.tds, l.turbidity, l.hardness, l.alkalinity,
             l.chloride, l.iron, l.fecal_coliform, l.recorded_at
        FROM springs s LEFT JOIN latest l ON l.spring_id = s.id
       WHERE s.active`),
    query(`
      SELECT 'discharge' AS kind, dr.id, dr.recorded_at, s.name_en, u.name AS krp_name
        FROM discharge_readings dr JOIN springs s ON s.id=dr.spring_id JOIN users u ON u.id=dr.krp_id
       UNION ALL
      SELECT 'quality',    qr.id, qr.recorded_at, s.name_en, u.name
        FROM quality_readings   qr JOIN springs s ON s.id=qr.spring_id JOIN users u ON u.id=qr.krp_id
       ORDER BY recorded_at DESC LIMIT 10`),
  ]);

  const mix = { green: 0, amber: 0, red: 0, unknown: 0 };
  for (const r of status) {
    const cls = r.recorded_at ? classifyQualityReading(r) : 'unknown';
    mix[cls]++;
  }
  res.json({ counts: counts[0], status_mix: mix, recent_activity: recent });
}));

// GET /dashboard/map — markers with status colour
router.get('/map', requireRole('manager', 'admin'), asyncH(async (_req, res) => {
  const { rows } = await query(`
    WITH latest_q AS (
      SELECT DISTINCT ON (spring_id) spring_id, recorded_at,
             ph, tds, turbidity, hardness, alkalinity, chloride, iron, fecal_coliform
        FROM quality_readings ORDER BY spring_id, recorded_at DESC
    )
    SELECT s.id, s.code, s.name_en, s.name_hi, s.lat, s.lon, s.altitude_m,
           v.name AS village, v.block, v.district,
           lq.recorded_at AS last_quality_at,
           lq.ph, lq.tds, lq.turbidity, lq.hardness, lq.alkalinity,
           lq.chloride, lq.iron, lq.fecal_coliform
      FROM springs s
      JOIN villages v ON v.id = s.village_id
      LEFT JOIN latest_q lq ON lq.spring_id = s.id
     WHERE s.active`);

  const items = rows.map((r) => {
    const cls = r.last_quality_at ? classifyQualityReading(r) : 'unknown';
    const daysSince = r.last_quality_at ? Math.floor((Date.now() - new Date(r.last_quality_at).getTime()) / 86_400_000) : null;
    let status = cls;
    if (daysSince === null || daysSince > 120) status = 'red';
    else if (daysSince > 90 && status === 'green') status = 'amber';
    return {
      id: r.id, code: r.code, name_en: r.name_en, name_hi: r.name_hi,
      lat: r.lat, lon: r.lon, village: r.village, block: r.block, district: r.district,
      last_quality_at: r.last_quality_at, days_since: daysSince, status,
    };
  });
  res.json({ items });
}));

// GET /dashboard/spring/:id/trends?from=&to=
router.get('/spring/:id/trends', requireRole('manager', 'admin'), asyncH(async (req, res) => {
  const id = req.params.id;
  const { rows: s } = await query(
    `SELECT s.*, v.name AS village, v.block, v.district FROM springs s JOIN villages v ON v.id=s.village_id WHERE s.id=$1`,
    [id],
  );
  if (!s.length) throw NotFound('Spring not found');

  const [dRes, qRes, health] = await Promise.all([
    query(`SELECT recorded_at, discharge_lpm, method, weather, anomaly
             FROM discharge_readings WHERE spring_id=$1 ORDER BY recorded_at ASC LIMIT 365`, [id]),
    query(`SELECT recorded_at, ph, tds, turbidity, hardness, alkalinity, chloride, iron, fecal_coliform, anomaly, photo_url
             FROM quality_readings   WHERE spring_id=$1 ORDER BY recorded_at ASC LIMIT 365`, [id]),
    computeHealthScore(id),
  ]);

  res.json({
    spring: s[0],
    discharge: dRes.rows,
    quality: qRes.rows,
    health,
  });
}));

// GET /dashboard/blocks — block-wise rollup
router.get('/blocks', requireRole('manager', 'admin'), asyncH(async (_req, res) => {
  const { rows } = await query(`
    WITH latest_q AS (
      SELECT DISTINCT ON (spring_id) spring_id, recorded_at,
             ph, tds, turbidity, hardness, alkalinity, chloride, iron, fecal_coliform
        FROM quality_readings ORDER BY spring_id, recorded_at DESC
    ),
    latest_d AS (
      SELECT DISTINCT ON (spring_id) spring_id, discharge_lpm, recorded_at
        FROM discharge_readings ORDER BY spring_id, recorded_at DESC
    ),
    prev_d AS (
      SELECT spring_id, AVG(discharge_lpm) AS prev_avg
        FROM discharge_readings
       WHERE recorded_at BETWEEN now() - interval '180 days' AND now() - interval '90 days'
       GROUP BY spring_id
    )
    SELECT v.block, v.district,
           COUNT(DISTINCT s.id) AS spring_count,
           AVG(ld.discharge_lpm) AS avg_discharge_lpm,
           AVG(CASE WHEN pd.prev_avg > 0 THEN (ld.discharge_lpm - pd.prev_avg) / pd.prev_avg END) AS discharge_change,
           json_agg(json_build_object('id', s.id, 'name', s.name_en, 'ph', lq.ph, 'tds', lq.tds,
             'turbidity', lq.turbidity, 'hardness', lq.hardness, 'alkalinity', lq.alkalinity,
             'chloride', lq.chloride, 'iron', lq.iron, 'fecal_coliform', lq.fecal_coliform,
             'recorded_at', lq.recorded_at)) AS quality_rows
      FROM springs s
      JOIN villages v ON v.id = s.village_id
      LEFT JOIN latest_q lq ON lq.spring_id = s.id
      LEFT JOIN latest_d ld ON ld.spring_id = s.id
      LEFT JOIN prev_d   pd ON pd.spring_id = s.id
     WHERE s.active
     GROUP BY v.block, v.district
     ORDER BY v.district, v.block`);

  const out = rows.map((r) => {
    const mix = { green: 0, amber: 0, red: 0, unknown: 0 };
    for (const q of r.quality_rows || []) {
      const cls = q.recorded_at ? classifyQualityReading(q) : 'unknown';
      mix[cls]++;
    }
    return {
      block: r.block, district: r.district, spring_count: Number(r.spring_count),
      avg_discharge_lpm: r.avg_discharge_lpm ? Number(r.avg_discharge_lpm) : null,
      discharge_change_pct: r.discharge_change !== null ? Number(r.discharge_change) * 100 : null,
      status_mix: mix,
    };
  });
  res.json({ items: out });
}));

// GET /dashboard/krp-performance
router.get('/krp-performance', requireRole('manager', 'admin'), asyncH(async (_req, res) => {
  const { rows } = await query(`
    SELECT u.id, u.name, u.phone, v.name AS village, v.block,
           COUNT(DISTINCT dr.id) AS discharge_count,
           COUNT(DISTINCT qr.id) AS quality_count,
           GREATEST(MAX(dr.recorded_at), MAX(qr.recorded_at)) AS last_active
      FROM users u
      LEFT JOIN villages v          ON v.id = u.village_id
      LEFT JOIN discharge_readings dr ON dr.krp_id = u.id
      LEFT JOIN quality_readings   qr ON qr.krp_id = u.id
     WHERE u.role = 'krp' AND u.active
     GROUP BY u.id, u.name, u.phone, v.name, v.block
     ORDER BY last_active DESC NULLS LAST`);
  res.json({ items: rows });
}));

// GET /dashboard/alerts — anomalies + overdue sampling
router.get('/alerts', requireRole('manager', 'admin'), asyncH(async (_req, res) => {
  const [{ rows: anomalies }, { rows: overdue }] = await Promise.all([
    query(`
      SELECT 'discharge' AS kind, dr.id, dr.recorded_at, dr.discharge_lpm AS value,
             s.id AS spring_id, s.name_en, v.name AS village, u.name AS krp_name, u.phone AS krp_phone
        FROM discharge_readings dr
        JOIN springs s ON s.id = dr.spring_id
        JOIN villages v ON v.id = s.village_id
        LEFT JOIN users u ON u.id = dr.krp_id
       WHERE dr.anomaly = true AND dr.recorded_at > now() - interval '60 days'
       UNION ALL
      SELECT 'quality', qr.id, qr.recorded_at, NULL,
             s.id, s.name_en, v.name, u.name, u.phone
        FROM quality_readings qr
        JOIN springs s ON s.id = qr.spring_id
        JOIN villages v ON v.id = s.village_id
        LEFT JOIN users u ON u.id = qr.krp_id
       WHERE qr.anomaly = true AND qr.recorded_at > now() - interval '60 days'
       ORDER BY recorded_at DESC LIMIT 100`),
    query(`
      WITH latest_q AS (
        SELECT spring_id, MAX(recorded_at) AS last_test FROM quality_readings GROUP BY spring_id
      )
      SELECT s.id, s.name_en, v.name AS village, v.block,
             lq.last_test,
             EXTRACT(EPOCH FROM (now() - COALESCE(lq.last_test, s.created_at))) / 86400 AS days_since,
             u.name AS krp_name, u.phone AS krp_phone
        FROM springs s
        JOIN villages v ON v.id = s.village_id
        LEFT JOIN latest_q lq ON lq.spring_id = s.id
        LEFT JOIN users u ON u.village_id = v.id AND u.role = 'krp' AND u.active
       WHERE s.active
         AND (lq.last_test IS NULL OR lq.last_test < now() - interval '120 days')
       ORDER BY days_since DESC NULLS LAST`),
  ]);
  res.json({ anomalies, overdue });
}));

// GET /dashboard/readings — paginated list of all readings for management view
router.get('/readings', requireRole('manager', 'admin'), asyncH(async (req, res) => {
  const { spring_id, krp_id, kind, from, to, page = '1', limit = '50' } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  const params = [];
  let pi = 1;

  if (spring_id) { conditions.push(`r.spring_id = $${pi++}`); params.push(spring_id); }
  if (krp_id) { conditions.push(`r.krp_id = $${pi++}`); params.push(krp_id); }
  if (from) { conditions.push(`r.recorded_at >= $${pi++}`); params.push(from); }
  if (to) { conditions.push(`r.recorded_at <= $${pi++}`); params.push(to); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  // Build queries based on kind filter
  const queries = [];
  if (!kind || kind === 'discharge') {
    queries.push(`
      SELECT 'discharge' AS kind, r.id, r.spring_id, r.krp_id, r.client_uuid,
             r.recorded_at, r.lat, r.lon, r.discharge_lpm, r.method, r.weather,
             r.anomaly, r.synced_at, r.photo_url,
             NULL::real AS ph, NULL::real AS tds, NULL::real AS turbidity,
             NULL::real AS hardness, NULL::real AS alkalinity, NULL::real AS chloride,
             NULL::real AS iron, NULL::integer AS fecal_coliform,
             s.code AS spring_code, s.name_en AS spring_name,
             v.name AS village_name, v.block, v.district,
             u.name AS krp_name, u.phone AS krp_phone
        FROM discharge_readings r
        JOIN springs s ON s.id = r.spring_id
        JOIN villages v ON v.id = s.village_id
        LEFT JOIN users u ON u.id = r.krp_id
        ${where}
    `);
  }
  if (!kind || kind === 'quality') {
    queries.push(`
      SELECT 'quality' AS kind, r.id, r.spring_id, r.krp_id, r.client_uuid,
             r.recorded_at, r.lat, r.lon, NULL::real AS discharge_lpm, NULL AS method, NULL AS weather,
             r.anomaly, r.synced_at, r.photo_url,
             r.ph, r.tds, r.turbidity, r.hardness, r.alkalinity, r.chloride, r.iron, r.fecal_coliform,
             s.code AS spring_code, s.name_en AS spring_name,
             v.name AS village_name, v.block, v.district,
             u.name AS krp_name, u.phone AS krp_phone
        FROM quality_readings r
        JOIN springs s ON s.id = r.spring_id
        JOIN villages v ON v.id = s.village_id
        LEFT JOIN users u ON u.id = r.krp_id
        ${where}
    `);
  }

  const unionSql = queries.join(' UNION ALL ');
  const countSql = `SELECT COUNT(*) AS total FROM (${unionSql}) _c`;
  const dataSql = `${unionSql} ORDER BY recorded_at DESC LIMIT $${pi} OFFSET $${pi + 1}`;

  const [{ rows: countRows }, { rows: dataRows }] = await Promise.all([
    query(countSql, params),
    query(dataSql, [...params, limitNum, offset]),
  ]);

  res.json({
    items: dataRows,
    total: Number(countRows[0].total),
    page: pageNum,
    limit: limitNum,
    pages: Math.ceil(Number(countRows[0].total) / limitNum),
  });
}));

// GET /dashboard/villages — list all villages (for dropdowns)
router.get('/villages', requireRole('manager', 'admin'), asyncH(async (_req, res) => {
  const { rows } = await query(`
    SELECT v.id, v.name, v.gp, v.block, v.district,
           (SELECT COUNT(*) FROM springs s WHERE s.village_id = v.id AND s.active) AS spring_count,
           (SELECT COUNT(*) FROM users u WHERE u.village_id = v.id AND u.role = 'krp' AND u.active) AS krp_count
      FROM villages v
     ORDER BY v.district, v.block, v.name
  `);
  res.json({ items: rows });
}));

export default router;
