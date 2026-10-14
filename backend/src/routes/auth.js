// SPDX-License-Identifier: MIT
//
// Unified auth — no SMS, no OTP. Everyone (KRP, manager, admin) logs in with
// phone-or-email + password. New KRPs self-sign-up and wait for manager approval.
//
// Routes:
//   POST /auth/signup       (public)  KRP creates a pending account
//   POST /auth/login        (public)  returns JWT if approved
//   POST /auth/password     (auth'd)  user changes own password
//   GET  /auth/me           (auth'd)  current user profile (cheap; for app cold-start)
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { signToken, requireAuth, asyncH } from '../middleware/auth.js';
import { audit } from '../db/audit.js';
import { Unauthorized, BadRequest, Conflict } from '../utils/errors.js';

const router = Router();

const loginLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true });

// Accept both "+919999900001" and "9999900001"; store everything in E.164.
const PHONE_RE = /^\+?[1-9]\d{9,14}$/;
function normalisePhone(raw) {
  const p = String(raw || '').trim().replace(/[\s-]/g, '');
  const norm = p.startsWith('+') ? p : '+91' + p.replace(/^0+/, '');
  if (!PHONE_RE.test(norm)) throw BadRequest('Invalid phone number');
  return norm;
}

// ─── POST /auth/signup ───  (public)
// KRP self-registration. Manager approves before they can log in.
const signupSchema = z.object({
  name: z.string().min(2).max(80),
  phone: z.string().min(8),
  password: z.string().min(6).max(80),
  village_id: z.string().uuid(),
  note: z.string().max(500).optional(),
});

router.post('/signup', loginLimiter, asyncH(async (req, res) => {
  const v = signupSchema.parse(req.body);
  const phone = normalisePhone(v.phone);

  // Phone-unique check (covers both pending and approved rows)
  const existing = await query('SELECT id, approval_status FROM users WHERE phone = $1', [phone]);
  if (existing.rows.length) {
    const s = existing.rows[0].approval_status;
    if (s === 'rejected') {
      throw Conflict('This phone number was previously rejected. Contact the manager.');
    }
    throw Conflict(s === 'pending'
      ? 'Already submitted. Waiting for manager approval.'
      : 'Phone already registered. Please log in.');
  }

  // Village must exist (we don't want signups against random uuids)
  const v_ok = await query('SELECT id FROM villages WHERE id = $1', [v.village_id]);
  if (!v_ok.rows.length) throw BadRequest('Unknown village');

  const hash = await bcrypt.hash(v.password, 10);
  const inserted = await withTx(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO users (phone, password_hash, name, role, village_id, approval_status, signup_note)
       VALUES ($1, $2, $3, 'krp', $4, 'pending', $5)
       RETURNING id, phone, name, role, village_id, approval_status, created_at`,
      [phone, hash, v.name, v.village_id, v.note || null],
    );
    await audit(client, {
      table: 'users', recordId: rows[0].id, action: 'insert',
      newValues: { ...rows[0], password_hash: '[REDACTED]' },
      reason: 'KRP self-signup',
    });
    return rows[0];
  });

  res.status(201).json({
    ok: true,
    pending: true,
    user: inserted,
    message: 'Signup received. A manager will review and approve your account.',
  });
}));

// ─── POST /auth/login ───  (public; works for all roles)
const loginSchema = z.object({
  identifier: z.string().min(3),       // phone OR email
  password: z.string().min(1),
});

router.post('/login', loginLimiter, asyncH(async (req, res) => {
  const { identifier, password } = loginSchema.parse(req.body);

  // Email → managers/admins. Anything else → treat as phone.
  const looksLikeEmail = identifier.includes('@');
  let row;
  if (looksLikeEmail) {
    const { rows } = await query(
      `SELECT u.id, u.email, u.phone, u.name, u.role, u.password_hash, u.active, u.approval_status,
              u.village_id, v.name AS village_name, v.block, v.district
         FROM users u LEFT JOIN villages v ON v.id = u.village_id
        WHERE u.email = $1`, [identifier.toLowerCase()],
    );
    row = rows[0];
  } else {
    const phone = normalisePhone(identifier);
    const { rows } = await query(
      `SELECT u.id, u.email, u.phone, u.name, u.role, u.password_hash, u.active, u.approval_status,
              u.village_id, v.name AS village_name, v.block, v.district
         FROM users u LEFT JOIN villages v ON v.id = u.village_id
        WHERE u.phone = $1`, [phone],
    );
    row = rows[0];
  }

  if (!row || !row.password_hash) throw Unauthorized('Invalid credentials');
  if (!row.active) throw Unauthorized('Account is disabled. Contact the manager.');
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) throw Unauthorized('Invalid credentials');

  if (row.approval_status === 'pending') {
    return res.status(202).json({
      ok: false,
      pending: true,
      message: 'Your account is awaiting manager approval.',
    });
  }
  if (row.approval_status === 'rejected') {
    throw Unauthorized('Your account was not approved. Contact the office.');
  }

  const token = signToken({ sub: row.id, role: row.role, name: row.name });
  res.json({
    ok: true,
    token,
    user: {
      id: row.id, name: row.name, role: row.role, phone: row.phone, email: row.email,
      village_id: row.village_id, village_name: row.village_name,
      block: row.block, district: row.district,
    },
  });
}));

// ─── POST /auth/password ───  (auth'd; user changes own)
router.post('/password', requireAuth, asyncH(async (req, res) => {
  const { oldPassword, newPassword } = z.object({
    oldPassword: z.string().min(1),
    newPassword: z.string().min(6).max(80),
  }).parse(req.body);
  const { rows } = await query('SELECT id, password_hash FROM users WHERE id = $1', [req.user.sub]);
  if (!rows.length || !(await bcrypt.compare(oldPassword, rows[0].password_hash))) {
    throw Unauthorized('Wrong current password');
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, rows[0].id]);
  res.json({ ok: true });
}));

// ─── GET /auth/me ───  (auth'd; quick profile fetch for app start)
router.get('/me', requireAuth, asyncH(async (req, res) => {
  const { rows } = await query(`
    SELECT u.id, u.phone, u.email, u.name, u.role, u.approval_status,
           u.village_id, v.name AS village_name, v.block, v.district
      FROM users u LEFT JOIN villages v ON v.id = u.village_id
     WHERE u.id = $1`, [req.user.sub],
  );
  if (!rows.length) throw Unauthorized();
  res.json(rows[0]);
}));

export default router;
