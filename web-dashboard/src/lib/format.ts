// SPDX-License-Identifier: MIT

export const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtDateTime = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export const fmtNum = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toFixed(digits);

export const daysAgo = (iso: string | null) => {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
};
