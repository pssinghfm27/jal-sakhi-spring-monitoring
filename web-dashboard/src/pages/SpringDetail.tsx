// SPDX-License-Identifier: MIT
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/client';
import type { SpringTrends } from '../api/types';
import { BisLineChart } from '../components/BisLineChart';
import { HealthScoreGauge } from '../components/HealthScoreGauge';
import { fmtDate, fmtDateTime, fmtNum } from '../lib/format';

const PARAMS = ['ph', 'tds', 'turbidity', 'hardness', 'alkalinity', 'chloride', 'iron', 'fecal_coliform'] as const;
type CompareMode = 'none' | 'qoq' | 'yoy';

export function SpringDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState<SpringTrends | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [compare, setCompare] = useState<CompareMode>('none');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.springTrends(id).then(setData).catch((e) => setErr(e.message));
  }, [id]);

  const discharge = useMemo(() => {
    if (!data) return [];
    return data.discharge.map((d) => ({
      t: new Date(d.recorded_at).getTime(),
      v: d.discharge_lpm,
      anomaly: d.anomaly,
    }));
  }, [data]);

  const comparativeSeries = useMemo(() => {
    if (!data || compare === 'none') return null;
    const now = Date.now();
    const day = 86_400_000;
    const ranges = compare === 'qoq'
      ? { current: [now - 90 * day, now], previous: [now - 180 * day, now - 90 * day], labelA: 'This Q', labelB: 'Last Q' }
      : { current: [now - 90 * day, now], previous: [now - 455 * day, now - 365 * day], labelA: 'This Q', labelB: 'Same Q LY' };
    const cur = data.discharge.filter((d) => {
      const t = new Date(d.recorded_at).getTime();
      return t >= ranges.current[0] && t <= ranges.current[1];
    });
    const prev = data.discharge.filter((d) => {
      const t = new Date(d.recorded_at).getTime();
      return t >= ranges.previous[0] && t <= ranges.previous[1];
    });
    const avg = (xs: typeof cur) => xs.length ? xs.reduce((s, x) => s + x.discharge_lpm, 0) / xs.length : null;
    return {
      labelA: ranges.labelA, valueA: avg(cur), countA: cur.length,
      labelB: ranges.labelB, valueB: avg(prev), countB: prev.length,
    };
  }, [data, compare]);

  async function exportPdf() {
    if (!data) return;
    setExporting(true);
    try {
      const { exportSpringPdf } = await import('../lib/pdf');
      exportSpringPdf(data);
    } finally { setExporting(false); }
  }

  async function exportExcel() {
    if (!data) return;
    setExporting(true);
    try {
      const { exportSpringExcel } = await import('../lib/excel');
      await exportSpringExcel(data);
    } finally { setExporting(false); }
  }

  if (err) return <div className="p-6"><div className="card text-chirag-alert">Error: {err}</div></div>;
  if (!data) return <div className="p-6 text-chirag-muted">Loading…</div>;

  const s = data.spring;
  const latestQ = data.quality[data.quality.length - 1] ?? null;
  const latestD = data.discharge[data.discharge.length - 1] ?? null;
  const photos = data.quality.slice(-10).reverse().filter((q) => q.photo_url);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <button onClick={() => nav(-1)} className="text-sm text-chirag-water">← Back</button>

      {/* Header */}
      <header className="card">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold leading-tight">{s.name_hi}</h1>
            <div className="text-chirag-muted text-sm">{s.name_en} {s.code && <>· <code className="text-xs">{s.code}</code></>}</div>
            <div className="text-sm mt-1">{s.village} · {s.block} · {s.district}</div>
            <div className="text-xs text-chirag-muted mt-1">
              GPS {fmtNum(s.lat, 5)}, {fmtNum(s.lon, 5)}
              {s.altitude_m && <> · {s.altitude_m} m</>}
              {s.spring_type && <> · {s.spring_type}</>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-start">
            <button onClick={exportPdf} disabled={exporting} className="btn-outline">Export PDF</button>
            <button onClick={exportExcel} disabled={exporting} className="btn-outline">Export Excel</button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
          <Stat label="Latest discharge" value={latestD ? `${fmtNum(latestD.discharge_lpm)} L/min` : '—'} sub={fmtDate(latestD?.recorded_at ?? null)} />
          <Stat label="Latest quality test" value={fmtDate(latestQ?.recorded_at ?? null)} sub={latestQ ? `pH ${fmtNum(latestQ.ph, 1)} · TDS ${fmtNum(latestQ.tds, 0)}` : '—'} />
          <Stat label="Discharge readings" value={String(data.discharge.length)} sub="all-time" />
          <Stat label="Quality readings" value={String(data.quality.length)} sub="all-time" />
        </div>
      </header>

      {/* Health gauge + Discharge chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <HealthScoreGauge health={data.health} />
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">Discharge (L/min)</div>
            <div className="flex gap-1 text-xs">
              {(['none','qoq','yoy'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setCompare(m)}
                  className={'px-2 py-1 rounded ' + (compare === m ? 'bg-chirag-primary text-white' : 'bg-gray-100')}
                >{m === 'none' ? 'All' : m === 'qoq' ? 'This Q vs Last Q' : 'This Q vs LY'}</button>
              ))}
            </div>
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={discharge} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="t" type="number" domain={['dataMin','dataMax']}
                  tickFormatter={(t) => fmtDate(new Date(t).toISOString())} tick={{ fontSize: 11 }} stroke="#6B7280" />
                <YAxis tick={{ fontSize: 11 }} stroke="#6B7280" width={42} />
                <Tooltip
                  labelFormatter={(t) => fmtDateTime(new Date(t as number).toISOString())}
                  formatter={(v) => [Number(v).toFixed(2) + ' L/min', 'Discharge']}
                />
                <Line type="monotone" dataKey="v" stroke="#0277BD" strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props as { cx: number; cy: number; payload: { anomaly: boolean } };
                    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return <></>;
                    return <circle cx={cx} cy={cy} r={3} fill={payload.anomaly ? '#C62828' : '#0277BD'} />;
                  }}
                  isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {comparativeSeries && (
            <div className="mt-3 flex gap-4 text-sm">
              <CompareCard label={comparativeSeries.labelA} value={comparativeSeries.valueA} n={comparativeSeries.countA} />
              <CompareCard label={comparativeSeries.labelB} value={comparativeSeries.valueB} n={comparativeSeries.countB} />
              {comparativeSeries.valueA !== null && comparativeSeries.valueB !== null && comparativeSeries.valueB !== 0 && (
                <ChangeCard pct={((comparativeSeries.valueA - comparativeSeries.valueB) / comparativeSeries.valueB) * 100} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* 8 BIS small multiples */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Water quality — BIS 10500</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PARAMS.map((p) => (
            <BisLineChart key={p} param={p}
              data={data.quality.map((q) => ({ recorded_at: q.recorded_at, value: (q as unknown as Record<string, unknown>)[p] as number | null }))} />
          ))}
        </div>
      </section>

      {/* Photo gallery */}
      {photos.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Latest photos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {photos.map((q, i) => (
              <a key={i} href={q.photo_url ?? '#'} target="_blank" rel="noreferrer"
                className="block aspect-square overflow-hidden rounded-md border border-chirag-border bg-gray-50">
                <img src={q.photo_url ?? ''} alt={`reading ${fmtDate(q.recorded_at)}`}
                  className="w-full h-full object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs text-chirag-muted">{label}</div>
      <div className="font-semibold">{value}</div>
      {sub && <div className="text-xs text-chirag-muted">{sub}</div>}
    </div>
  );
}

function CompareCard({ label, value, n }: { label: string; value: number | null; n: number }) {
  return (
    <div className="border border-chirag-border rounded-md px-3 py-2">
      <div className="text-xs text-chirag-muted">{label}</div>
      <div className="font-semibold">{value === null ? '—' : `${value.toFixed(1)} L/min`}</div>
      <div className="text-xs text-chirag-muted">{n} reading{n === 1 ? '' : 's'}</div>
    </div>
  );
}

function ChangeCard({ pct }: { pct: number }) {
  const positive = pct >= 0;
  return (
    <div className="border border-chirag-border rounded-md px-3 py-2">
      <div className="text-xs text-chirag-muted">Change</div>
      <div className={'font-semibold ' + (positive ? 'text-chirag-primary' : 'text-chirag-alert')}>
        {positive ? '+' : ''}{pct.toFixed(1)}%
      </div>
    </div>
  );
}
