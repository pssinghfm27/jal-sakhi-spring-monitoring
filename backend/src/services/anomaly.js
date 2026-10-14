// SPDX-License-Identifier: MIT
// Anomaly = |new_value - median(last 3 months)| / median > 0.5
// Returns true if the new reading should be flagged for manager review.

import { query } from '../db/pool.js';

function median(nums) {
  const xs = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

export async function isDischargeAnomaly(springId, newLpm) {
  const { rows } = await query(
    `SELECT discharge_lpm
       FROM discharge_readings
      WHERE spring_id = $1
        AND recorded_at >= now() - INTERVAL '90 days'`,
    [springId],
  );
  const med = median(rows.map((r) => Number(r.discharge_lpm)));
  if (med === null || med === 0) return false;
  return Math.abs(newLpm - med) / med > 0.5;
}

export async function isQualityAnomaly(springId, newRow) {
  const params = ['ph','tds','turbidity','hardness','alkalinity','chloride','iron','fecal_coliform'];
  const { rows } = await query(
    `SELECT ${params.join(',')}
       FROM quality_readings
      WHERE spring_id = $1
        AND recorded_at >= now() - INTERVAL '90 days'`,
    [springId],
  );
  for (const p of params) {
    const med = median(rows.map((r) => Number(r[p])));
    const v = Number(newRow[p]);
    if (med === null || med === 0 || !Number.isFinite(v)) continue;
    if (Math.abs(v - med) / med > 0.5) return true;
  }
  return false;
}
