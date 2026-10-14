// SPDX-License-Identifier: MIT
//
// In-dashboard reminders only. The "Notify KRP" button in the dashboard now
// creates a `notify` row that the KRP's app sees on next sync — no SMS.
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requireRole, asyncH } from '../middleware/auth.js';
import { runNow } from '../services/reminders.js';
import { NotFound } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

// POST /reminders/test — manually trigger today's reminder calculation
router.post('/test', requireRole('admin', 'manager'), asyncH(async (_req, res) => {
  const enqueued = await runNow();
  res.json({ ok: true, enqueued });
}));

// POST /reminders/notify { krp_id, message } — managers create a one-off
// in-app message for a KRP. Stored as a reminder with kind='manual'.
// The KRP sees it on the Reminders screen next time they sync.
router.post('/notify', requireRole('manager', 'admin'), asyncH(async (req, res) => {
  const { krp_id, message } = z.object({
    krp_id: z.string().uuid(),
    message: z.string().min(1).max(500),
  }).parse(req.body);

  const { rows: krp } = await query(
    `SELECT u.id, v.id AS village_id
       FROM users u LEFT JOIN villages v ON v.id = u.village_id
      WHERE u.id = $1 AND u.role = 'krp' AND u.active`,
    [krp_id],
  );
  if (!krp.length) throw NotFound('KRP not found');

  // Pick any spring in the KRP's village to satisfy the FK; the message text is what matters.
  const { rows: springs } = await query(
    `SELECT id FROM springs WHERE village_id = $1 AND active LIMIT 1`, [krp[0].village_id],
  );
  if (!springs.length) {
    return res.status(400).json({ error: 'KRP has no springs assigned in their village' });
  }

  const today = new Date().toISOString().slice(0, 10);
  await query(
    `INSERT INTO reminders (spring_id, krp_id, due_date, kind, channel, status, error)
       VALUES ($1, $2, $3, 'manual', 'push', 'sent', $4)
     ON CONFLICT (spring_id, due_date, kind) DO UPDATE SET error = EXCLUDED.error`,
    [springs[0].id, krp_id, today, message],
  );
  res.json({ ok: true });
}));

// GET /reminders?status=pending|sent
router.get('/', requireRole('manager', 'admin'), asyncH(async (req, res) => {
  const status = req.query.status || null;
  const { rows } = await query(
    `SELECT r.*, s.name_en AS spring_name, v.name AS village, u.name AS krp_name, u.phone AS krp_phone
       FROM reminders r
       JOIN springs s ON s.id = r.spring_id
       JOIN villages v ON v.id = s.village_id
       LEFT JOIN users u ON u.id = r.krp_id
      WHERE ($1::text IS NULL OR r.status = $1)
      ORDER BY r.due_date DESC LIMIT 200`,
    [status],
  );
  res.json({ items: rows });
}));

// GET /reminders/mine — what the KRP sees in the app (their own messages + due tests)
router.get('/mine', requireRole('krp'), asyncH(async (req, res) => {
  const { rows } = await query(
    `SELECT r.id, r.due_date, r.kind, r.error AS message,
            s.id AS spring_id, s.name_en AS spring_name, s.name_hi AS spring_name_hi
       FROM reminders r
       JOIN springs s ON s.id = r.spring_id
      WHERE r.krp_id = $1
      ORDER BY r.due_date DESC LIMIT 50`,
    [req.user.sub],
  );
  res.json({ items: rows });
}));

export default router;
