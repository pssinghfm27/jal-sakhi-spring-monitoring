// SPDX-License-Identifier: MIT
import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { requireAuth, requireRole, asyncH } from '../middleware/auth.js';
import { upload, publicUrl } from '../middleware/upload.js';
import { audit } from '../db/audit.js';
import { isDischargeAnomaly, isQualityAnomaly } from '../services/anomaly.js';
import { BadRequest, NotFound } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

const baseCoord = {
  spring_id: z.string().uuid(),
  client_uuid: z.string().uuid().optional(),
  recorded_at: z.string().datetime(),
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  gps_accuracy_m: z.coerce.number().min(0).max(500).optional(),
};

// ─── POST /readings/discharge ───
// Multipart: photo (required), voice (optional), all fields as form text.
const dischargeSchema = z.object({
  ...baseCoord,
  gps_accuracy_m: z.coerce.number().min(0).max(500),
  method: z.enum(['v_notch', 'volumetric', 'float']),
  discharge_lpm: z.coerce.number().min(0).max(100000),
  duration_sec: z.coerce.number().int().min(0).max(86400).optional(),
  weather: z.enum(['dry', 'light_rain', 'heavy_rain', 'post_monsoon']),
  notes: z.string().max(1000).optional(),
  edit_reason: z.string().max(500).optional(),
  supersedes_id: z.string().uuid().optional(),
});

router.post(
  '/discharge',
  requireRole('krp', 'admin'),
  upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'voice', maxCount: 1 }]),
  asyncH(async (req, res) => {
    const photoFile = req.files?.photo?.[0];
    if (!photoFile) throw BadRequest('photo is required');
    if (req.body.gps_accuracy_m && Number(req.body.gps_accuracy_m) > 20) {
      throw BadRequest('GPS accuracy worse than 20 m — please retry');
    }

    const v = dischargeSchema.parse(req.body);
    const voiceFile = req.files?.voice?.[0];

    const anomaly = await isDischargeAnomaly(v.spring_id, v.discharge_lpm);

    const inserted = await withTx(async (client) => {
      const { rows } = await client.query(`
        INSERT INTO discharge_readings
          (spring_id, krp_id, client_uuid, recorded_at, lat, lon, gps_accuracy_m,
           method, duration_sec, discharge_lpm, weather, photo_url, voice_url, notes,
           version, supersedes_id, edit_reason, anomaly)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
                COALESCE((SELECT version+1 FROM discharge_readings WHERE id=$15), 1),
                $15,$16,$17)
        ON CONFLICT (client_uuid) DO UPDATE SET notes = EXCLUDED.notes
        RETURNING *`,
        [
          v.spring_id, req.user.sub, v.client_uuid || null, v.recorded_at,
          v.lat, v.lon, v.gps_accuracy_m, v.method, v.duration_sec || null,
          v.discharge_lpm, v.weather, publicUrl(photoFile.filename),
          voiceFile ? publicUrl(voiceFile.filename) : null, v.notes || null,
          v.supersedes_id || null, v.edit_reason || null, anomaly,
        ],
      );
      await audit(client, {
        table: 'discharge_readings',
        recordId: rows[0].id,
        action: v.supersedes_id ? 'version' : 'insert',
        newValues: rows[0],
        userId: req.user.sub,
        reason: v.edit_reason,
      });
      return rows[0];
    });

    res.status(201).json({ ok: true, reading: inserted, anomaly });
  }),
);

// ─── POST /readings/quality ───
const qualitySchema = z.object({
  ...baseCoord,
  ph: z.coerce.number().min(0).max(14).optional(),
  tds: z.coerce.number().min(0).max(10000).optional(),
  turbidity: z.coerce.number().min(0).max(1000).optional(),
  hardness: z.coerce.number().min(0).max(5000).optional(),
  alkalinity: z.coerce.number().min(0).max(5000).optional(),
  chloride: z.coerce.number().min(0).max(5000).optional(),
  iron: z.coerce.number().min(0).max(100).optional(),
  fecal_coliform: z.coerce.number().int().min(0).max(1000000).optional(),
  kit_batch: z.string().max(50).optional(),
  kit_expiry: z.string().optional(),
  edit_reason: z.string().max(500).optional(),
  supersedes_id: z.string().uuid().optional(),
});

router.post(
  '/quality',
  requireRole('krp', 'admin'),
  upload.single('photo'),
  asyncH(async (req, res) => {
    if (!req.file) throw BadRequest('photo is required');
    const v = qualitySchema.parse(req.body);

    const newRow = {
      ph: v.ph, tds: v.tds, turbidity: v.turbidity, hardness: v.hardness,
      alkalinity: v.alkalinity, chloride: v.chloride, iron: v.iron,
      fecal_coliform: v.fecal_coliform,
    };
    const anomaly = await isQualityAnomaly(v.spring_id, newRow);

    const inserted = await withTx(async (client) => {
      const { rows } = await client.query(`
        INSERT INTO quality_readings
          (spring_id, krp_id, client_uuid, recorded_at, lat, lon,
           ph, tds, turbidity, hardness, alkalinity, chloride, iron, fecal_coliform,
           kit_batch, kit_expiry, photo_url,
           version, supersedes_id, edit_reason, anomaly)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
                COALESCE((SELECT version+1 FROM quality_readings WHERE id=$18), 1),
                $18,$19,$20)
        ON CONFLICT (client_uuid) DO UPDATE SET kit_batch = EXCLUDED.kit_batch
        RETURNING *`,
        [
          v.spring_id, req.user.sub, v.client_uuid || null, v.recorded_at,
          v.lat, v.lon,
          v.ph, v.tds, v.turbidity, v.hardness, v.alkalinity, v.chloride, v.iron, v.fecal_coliform,
          v.kit_batch || null, v.kit_expiry || null, publicUrl(req.file.filename),
          v.supersedes_id || null, v.edit_reason || null, anomaly,
        ],
      );
      await audit(client, {
        table: 'quality_readings',
        recordId: rows[0].id,
        action: v.supersedes_id ? 'version' : 'insert',
        newValues: rows[0],
        userId: req.user.sub,
        reason: v.edit_reason,
      });
      return rows[0];
    });

    res.status(201).json({ ok: true, reading: inserted, anomaly });
  }),
);

// ─── GET /readings?spring_id=&from=&to=&kind=discharge|quality ───
router.get('/', asyncH(async (req, res) => {
  const q = z.object({
    spring_id: z.string().uuid().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    kind: z.enum(['discharge', 'quality']).default('discharge'),
    limit: z.coerce.number().int().min(1).max(500).default(100),
  }).parse(req.query);

  const table = q.kind === 'discharge' ? 'discharge_readings' : 'quality_readings';
  const params = [];
  const where = [];
  if (q.spring_id) { params.push(q.spring_id); where.push(`spring_id = $${params.length}`); }
  if (q.from)      { params.push(q.from);      where.push(`recorded_at >= $${params.length}`); }
  if (q.to)        { params.push(q.to);        where.push(`recorded_at <= $${params.length}`); }
  // KRPs only see their own village's readings
  if (req.user.role === 'krp') {
    params.push(req.user.sub);
    where.push(`spring_id IN (SELECT s.id FROM springs s JOIN users u ON u.village_id = s.village_id WHERE u.id = $${params.length})`);
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  params.push(q.limit);
  const { rows } = await query(
    `SELECT * FROM ${table} ${whereSql} ORDER BY recorded_at DESC LIMIT $${params.length}`,
    params,
  );
  res.json({ items: rows, count: rows.length, kind: q.kind });
}));

// GET /readings/:kind/:id
router.get('/:kind/:id', asyncH(async (req, res) => {
  if (!['discharge', 'quality'].includes(req.params.kind)) throw NotFound();
  const table = req.params.kind === 'discharge' ? 'discharge_readings' : 'quality_readings';
  const { rows } = await query(`SELECT * FROM ${table} WHERE id = $1`, [req.params.id]);
  if (!rows.length) throw NotFound();
  res.json(rows[0]);
}));

export default router;
