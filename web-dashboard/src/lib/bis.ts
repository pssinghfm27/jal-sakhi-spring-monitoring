// SPDX-License-Identifier: MIT
// Mirror of backend/src/services/bis.js — keep these synced.

export type BisClass = 'green' | 'amber' | 'red' | 'unknown';

interface Rule { acceptable: [number, number]; permissible: [number, number]; unit: string }

export const BIS: Record<string, Rule> = {
  ph:             { acceptable: [6.5, 8.5], permissible: [6.5, 8.5], unit: '' },
  tds:            { acceptable: [0, 500],   permissible: [0, 2000],  unit: 'mg/L' },
  turbidity:      { acceptable: [0, 1],     permissible: [0, 5],     unit: 'NTU' },
  hardness:       { acceptable: [0, 200],   permissible: [0, 600],   unit: 'mg/L' },
  alkalinity:     { acceptable: [0, 200],   permissible: [0, 600],   unit: 'mg/L' },
  chloride:       { acceptable: [0, 250],   permissible: [0, 1000],  unit: 'mg/L' },
  iron:           { acceptable: [0, 0.3],   permissible: [0, 0.3],   unit: 'mg/L' },
  fecal_coliform: { acceptable: [0, 0],     permissible: [0, 0],     unit: 'MPN/100ml' },
};

export const PARAM_LABEL: Record<string, string> = {
  ph: 'pH',
  tds: 'TDS',
  turbidity: 'Turbidity',
  hardness: 'Hardness',
  alkalinity: 'Alkalinity',
  chloride: 'Chloride',
  iron: 'Iron',
  fecal_coliform: 'Fecal coliform',
};

export function classify(param: string, value: number | null | undefined): BisClass {
  if (value === null || value === undefined || Number.isNaN(value)) return 'unknown';
  const r = BIS[param];
  if (!r) return 'unknown';
  if (value >= r.acceptable[0] && value <= r.acceptable[1]) return 'green';
  if (value >= r.permissible[0] && value <= r.permissible[1]) return 'amber';
  return 'red';
}

export const STATUS_COLOR: Record<BisClass, string> = {
  green:   '#2E7D32',
  amber:   '#F9A825',
  red:     '#C62828',
  unknown: '#9CA3AF',
};
