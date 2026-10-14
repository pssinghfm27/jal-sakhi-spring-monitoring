// SPDX-License-Identifier: MIT
// BIS 10500:2012 (drinking water) acceptable & permissible ranges.
// `acceptable` = desirable limit; `permissible` = max permissible in absence of alternate source.
// For coliforms BIS requires zero — anything > 0 is unsafe.

export const BIS = {
  ph:             { acceptable: [6.5, 8.5], permissible: [6.5, 8.5], unit: '' },
  tds:            { acceptable: [0, 500],   permissible: [0, 2000],  unit: 'mg/L' },
  turbidity:      { acceptable: [0, 1],     permissible: [0, 5],     unit: 'NTU' },
  hardness:       { acceptable: [0, 200],   permissible: [0, 600],   unit: 'mg/L as CaCO3' },
  alkalinity:     { acceptable: [0, 200],   permissible: [0, 600],   unit: 'mg/L as CaCO3' },
  chloride:       { acceptable: [0, 250],   permissible: [0, 1000],  unit: 'mg/L' },
  iron:           { acceptable: [0, 0.3],   permissible: [0, 0.3],   unit: 'mg/L' },
  fecal_coliform: { acceptable: [0, 0],     permissible: [0, 0],     unit: 'MPN/100ml' },
};

/** @returns {'green'|'amber'|'red'|'unknown'} */
export function classifyValue(param, value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'unknown';
  const rule = BIS[param];
  if (!rule) return 'unknown';
  const [aLo, aHi] = rule.acceptable;
  const [pLo, pHi] = rule.permissible;
  if (value >= aLo && value <= aHi) return 'green';
  if (value >= pLo && value <= pHi) return 'amber';
  return 'red';
}

/** Worst class across all 8 parameters in a quality reading. */
export function classifyQualityReading(q) {
  const params = ['ph','tds','turbidity','hardness','alkalinity','chloride','iron','fecal_coliform'];
  let worst = 'green';
  const order = { green: 0, amber: 1, red: 2, unknown: -1 };
  for (const p of params) {
    const c = classifyValue(p, q[p]);
    if (order[c] > order[worst]) worst = c;
  }
  return worst;
}
