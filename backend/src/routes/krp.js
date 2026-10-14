// SPDX-License-Identifier: MIT
//
// KRP routes — profile, springs, plus the manager-side approval endpoints:
//   GET  /krp/profile         (auth'd)    current user
//   GET  /krp/springs         (auth'd)    springs visible to caller
//   GET  /krp/pending         (mgr+admin) list of pending KRP signups
//   POST /krp/:id/approve     (mgr+admin) approve a pending KRP
//   POST /krp/:id/reject      (mgr+admin) reject a pending KRP (with reason)
//   GET  /krp/villages        (public-ish, auth optional) for app's signup dropdown
import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { requireAuth, requireRole, asyncH } from '../middleware/auth.js';
import { audit } from '../db/audit.js';
import { NotFound, BadRequest } from '../utils/errors.js';

const router = Router();

// Villages list is needed by the (unauthenticated) signup screen.
// We keep it as a small read-only endpoint, no auth required.
router.get('/villages', asyncH(async (_req, res) => {
  const { rows } = await query(
    `SELECT id, name, gp, block, district FROM villages
      ORDER BY district, block, name`,
  );
  res.json({ items: rows });
}));

router.use(requireAuth);

// GET /krp/profile
router.get('/profile', asyncH(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.phone, u.email, u.name, u.role, u.trained_on, u.active, u.approval_status,
            v.id AS village_id, v.name AS village_name, v.gp, v.block, v.district
       FROM users u LEFT JOIN villages v ON v.id = u.village_id
      WHERE u.id = $1`,
    [req.user.sub],
  );
  if (!rows.length) throw NotFound('User not found');
  res.json(rows[0]);
}));

// GET /krp/springs — springs visible to the caller
router.get('/springs', requireRole('krp', 'manager', 'admin'), asyncH(async (req, res) => {
  const sql = req.user.role === 'krp'
    ? `SELECT s.* FROM springs s
        JOIN users u ON u.village_id = s.village_id
       WHERE u.id = $1 AND s.active = true ORDER BY s.name_en`
    : `SELECT s.* FROM springs s WHERE s.active = true ORDER BY s.name_en`;
  const { rows } = await query(sql, req.user.role === 'krp' ? [req.user.sub] : []);
  res.json({ items: rows });
}));

// ─── Manager approval queue ───

// GET /krp/pending — list pending signups
router.get('/pending', requireRole('manager', 'admin'), asyncH(async (_req, res) => {
  const { rows } = await query(`
    SELECT u.id, u.name, u.phone, u.created_at, u.signup_note,
           v.id AS village_id, v.name AS village_name, v.block, v.district
      FROM users u LEFT JOIN villages v ON v.id = u.village_id
     WHERE u.role = 'krp' AND u.approval_status = 'pending'
     ORDER BY u.created_at ASC`);
  res.json({ items: rows, count: rows.length });
}));

// POST /krp/:id/approve
router.post('/:id/approve', requireRole('manager', 'admin'), asyncH(async (req, res) => {
  const id = req.params.id;
  await withTx(async (client) => {
    const { rows: before } = await client.query(
      `SELECT id, approval_status FROM users WHERE id = $1 AND role = 'krp'`,
      [id],
    );
    if (!before.length) throw NotFound('KRP not found');
    if (before[0].approval_status === 'approved') throw BadRequest('Already approved');

    const { rows } = await client.query(
      `UPDATE users
          SET approval_status = 'approved',
              approved_by = $2,
              approved_at = now(),
              rejected_reason = NULL
        WHERE id = $1
       RETURNING id, name, phone, approval_status, approved_at`,
      [id, req.user.sub],
    );
    await audit(client, {
      table: 'users', recordId: id, action: 'update',
      oldValues: { approval_status: before[0].approval_status },
      newValues: { approval_status: 'approved' },
      userId: req.user.sub, reason: 'manager approval',
    });
    res.json({ ok: true, user: rows[0] });
  });
}));

// POST /krp/:id/reject  { reason }
router.post('/:id/reject', requireRole('manager', 'admin'), asyncH(async (req, res) => {
  const id = req.params.id;
  const { reason } = z.object({ reason: z.string().min(1).max(500) }).parse(req.body);
  await withTx(async (client) => {
    const { rows: before } = await client.query(
      `SELECT id, approval_status FROM users WHERE id = $1 AND role = 'krp'`,
      [id],
    );
    if (!before.length) throw NotFound('KRP not found');

    const { rows } = await client.query(
      `UPDATE users
          SET approval_status = 'rejected',
              approved_by = $2,
              approved_at = now(),
              rejected_reason = $3,
              active = false
        WHERE id = $1
       RETURNING id, name, phone, approval_status, rejected_reason`,
      [id, req.user.sub, reason],
    );
    await audit(client, {
      table: 'users', recordId: id, action: 'update',
      oldValues: { approval_status: before[0].approval_status },
      newValues: { approval_status: 'rejected', rejected_reason: reason },
      userId: req.user.sub, reason: 'manager rejection',
    });
    res.json({ ok: true, user: rows[0] });
  });
}));

// GET /krp/all — list ALL KRPs (approved, pending, rejected) with stats
router.get('/all', requireRole('manager', 'admin'), asyncH(async (_req, res) => {
  const { rows } = await query(`
    SELECT u.id, u.name, u.phone, u.role, u.active, u.approval_status,
           u.created_at, u.approved_at, u.rejected_reason, u.signup_note,
           v.id AS village_id, v.name AS village_name, v.block, v.district,
           COUNT(DISTINCT dr.id)::integer AS discharge_count,
           COUNT(DISTINCT qr.id)::integer AS quality_count,
           GREATEST(MAX(dr.recorded_at), MAX(qr.recorded_at)) AS last_active
      FROM users u
      LEFT JOIN villages v ON v.id = u.village_id
      LEFT JOIN discharge_readings dr ON dr.krp_id = u.id
      LEFT JOIN quality_readings qr ON qr.krp_id = u.id
     WHERE u.role = 'krp'
     GROUP BY u.id, u.name, u.phone, u.role, u.active, u.approval_status,
              u.created_at, u.approved_at, u.rejected_reason, u.signup_note,
              v.id, v.name, v.block, v.district
     ORDER BY u.created_at DESC
  `);
  res.json({ items: rows, count: rows.length });
}));

// PATCH /krp/:id — edit KRP (reassign village, toggle active, rename)
router.patch('/:id', requireRole('manager', 'admin'), asyncH(async (req, res) => {
  const id = req.params.id;
  const allowed = z.object({
    village_id: z.string().uuid().optional(),
    active: z.boolean().optional(),
    name: z.string().min(2).max(80).optional(),
  }).parse(req.body);

  const { rows: before } = await query(
    `SELECT * FROM users WHERE id = $1 AND role = 'krp'`, [id],
  );
  if (!before.length) throw NotFound('KRP not found');

  const sets = [];
  const params = [id];
  let pi = 2;
  for (const [key, val] of Object.entries(allowed)) {
    if (val !== undefined) {
      sets.push(`${key} = $${pi}`);
      params.push(val);
      pi++;
    }
  }
  if (!sets.length) throw BadRequest('No fields to update');

  await withTx(async (client) => {
    const { rows } = await client.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $1
       RETURNING id, name, phone, role, active, village_id, approval_status`,
      params,
    );
    await audit(client, {
      table: 'users', recordId: id, action: 'update',
      oldValues: { name: before[0].name, village_id: before[0].village_id, active: before[0].active },
      newValues: allowed,
      userId: req.user.sub, reason: 'manager edit',
    });
    res.json({ ok: true, user: rows[0] });
  });
}));

export default router;
