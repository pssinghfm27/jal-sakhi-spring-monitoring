// SPDX-License-Identifier: MIT
// Reminder logic: a quarterly water-quality test is due every 90 days from the
// last test. We enqueue (and send) three reminders per cycle: pre7, due, overdue7.

import { query, withTx } from '../db/pool.js';
import { sendSMS } from './sms.js';
import { logger } from '../utils/logger.js';

const TEST_INTERVAL_DAYS = 90;

export async function computeAndEnqueueReminders(today = new Date()) {
  const t = new Date(today);
  t.setUTCHours(0, 0, 0, 0);

  // Get latest quality reading per active spring (and assigned KRP via village).
  const { rows: springs } = await query(`
    SELECT s.id        AS spring_id,
           s.name_en   AS spring_name,
           v.name      AS village,
           u.id        AS krp_id,
           u.phone     AS krp_phone,
           u.name      AS krp_name,
           MAX(q.recorded_at) AS last_test
      FROM springs s
      JOIN villages v   ON v.id = s.village_id
      LEFT JOIN users u ON u.village_id = v.id AND u.role = 'krp' AND u.active
      LEFT JOIN quality_readings q ON q.spring_id = s.id
     WHERE s.active = true
     GROUP BY s.id, v.name, u.id, u.phone, u.name
  `);

  let enqueued = 0;
  for (const s of springs) {
    // If no prior test, treat "due" as today.
    const lastTest = s.last_test ? new Date(s.last_test) : t;
    const due = new Date(lastTest);
    due.setUTCDate(due.getUTCDate() + TEST_INTERVAL_DAYS);

    const candidates = [
      { kind: 'pre7', date: addDays(due, -7) },
      { kind: 'due', date: due },
      { kind: 'overdue7', date: addDays(due, 7) },
    ];

    for (const c of candidates) {
      if (sameDay(c.date, t)) {
        const ins = await query(
          `INSERT INTO reminders (spring_id, krp_id, due_date, kind, channel)
             VALUES ($1, $2, $3, $4, 'sms')
           ON CONFLICT (spring_id, due_date, kind) DO NOTHING
           RETURNING id`,
          [s.spring_id, s.krp_id, c.date.toISOString().slice(0, 10), c.kind],
        );
        if (ins.rows[0]) enqueued++;
      }
    }
  }
  logger.info(`Reminders enqueued: ${enqueued}`);
  await sendPending();
  return enqueued;
}

export async function sendPending() {
  const { rows } = await query(`
    SELECT r.id, r.kind, r.due_date, r.spring_id,
           s.name_en AS spring_name, v.name AS village,
           u.phone, u.name AS krp_name
      FROM reminders r
      JOIN springs s   ON s.id = r.spring_id
      JOIN villages v  ON v.id = s.village_id
      LEFT JOIN users u ON u.id = r.krp_id
     WHERE r.status = 'pending'
     LIMIT 200
  `);

  for (const r of rows) {
    if (!r.phone) {
      await query(`UPDATE reminders SET status='failed', error='no KRP phone' WHERE id=$1`, [r.id]);
      continue;
    }
    const human = r.kind === 'pre7' ? '7 din mein deya hai' : r.kind === 'due' ? 'aaj deya hai' : '7 din se overdue hai';
    const msg = `CHIRAG Jal Sakhi: ${r.spring_name} (${r.village}) ki paani jaanch ${human}. Kripya aaj hi record karein.`;
    try {
      await sendSMS(r.phone, msg);
      await query(`UPDATE reminders SET status='sent', sent_at=now() WHERE id=$1`, [r.id]);
    } catch (e) {
      await query(`UPDATE reminders SET status='failed', error=$2 WHERE id=$1`, [r.id, String(e?.message || e)]);
    }
  }
}

function addDays(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function sameDay(a, b) {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

// Manual trigger (e.g. POST /reminders/test) — runs the same daily logic now.
export async function runNow() {
  return withTx(async () => computeAndEnqueueReminders(new Date()));
}
