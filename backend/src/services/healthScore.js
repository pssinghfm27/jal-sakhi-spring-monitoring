// SPDX-License-Identifier: MIT
// Composite spring health (0-100):
//   30% discharge stability  — 100 - (CV * 100), clamped
//   50% BIS compliance       — fraction of latest 4 readings green / amber / red weighted 1.0 / 0.6 / 0
//   20% sampling regularity  — within 90d window weight 1.0; >180d => 0
//
// Returns an object so callers can show component sub-scores in the UI.

import { query } from '../db/pool.js';
import { classifyQualityReading } from './bis.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function coefficientOfVariation(xs) {
  if (xs.length < 2) return null;
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  if (mean === 0) return null;
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
  return Math.sqrt(variance) / mean;
}

export async function computeHealthScore(springId) {
  const dq = await query(
    `SELECT discharge_lpm FROM discharge_readings
      WHERE spring_id = $1
      ORDER BY recorded_at DESC LIMIT 12`,
    [springId],
  );
  const qq = await query(
    `SELECT *, recorded_at FROM quality_readings
      WHERE spring_id = $1
      ORDER BY recorded_at DESC LIMIT 4`,
    [springId],
  );

  // (1) Discharge stability
  const flows = dq.rows.map((r) => Number(r.discharge_lpm));
  const cv = coefficientOfVariation(flows);
  const stability = cv === null ? 50 : clamp(100 - cv * 100, 0, 100);

  // (2) BIS compliance over latest 4 quality readings
  let comp = 50;
  if (qq.rows.length) {
    const weights = qq.rows.map((row) => {
      const cls = classifyQualityReading(row);
      return cls === 'green' ? 1 : cls === 'amber' ? 0.6 : 0;
    });
    comp = (weights.reduce((a, b) => a + b, 0) / weights.length) * 100;
  }

  // (3) Sampling regularity (latest quality reading recency)
  let regularity = 0;
  if (qq.rows.length) {
    const days = (Date.now() - new Date(qq.rows[0].recorded_at).getTime()) / 86_400_000;
    regularity = days <= 90 ? 100 : days >= 180 ? 0 : 100 - ((days - 90) / 90) * 100;
  }

  const total = Math.round(stability * 0.3 + comp * 0.5 + regularity * 0.2);
  return {
    total,
    components: {
      discharge_stability: Math.round(stability),
      bis_compliance: Math.round(comp),
      sampling_regularity: Math.round(regularity),
    },
  };
}
