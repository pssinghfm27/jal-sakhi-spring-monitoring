// SPDX-License-Identifier: MIT
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { BlockRollup, MapMarker } from '../api/types';
import { STATUS_COLOR } from '../lib/bis';
import { fmtNum } from '../lib/format';

export function Comparative() {
  const [blocks, setBlocks] = useState<BlockRollup[]>([]);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.blocks(), api.map()])
      .then(([b, m]) => { setBlocks(b.items); setMarkers(m.items); })
      .catch((e) => setErr(e.message));
  }, []);

  // Bar: discharge by district
  const byDistrict = useMemo(() => {
    const map = new Map<string, { district: string; total: number; n: number }>();
    blocks.forEach((b) => {
      const row = map.get(b.district) ?? { district: b.district, total: 0, n: 0 };
      if (b.avg_discharge_lpm !== null) { row.total += b.avg_discharge_lpm * b.spring_count; row.n += b.spring_count; }
      map.set(b.district, row);
    });
    return Array.from(map.values()).map((r) => ({ district: r.district, avg: r.n ? r.total / r.n : 0 }));
  }, [blocks]);

  if (err) return <div className="p-6"><div className="card text-chirag-alert">Error: {err}</div></div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Comparative dashboard</h1>
        <p className="text-sm text-chirag-muted">Block-wise rollup, top & bottom springs, district averages.</p>
      </header>

      {/* Block rollup */}
      <section className="card overflow-x-auto">
        <h2 className="font-medium mb-3">Block rollup</h2>
        <table className="min-w-full text-sm">
          <thead className="text-xs text-chirag-muted">
            <tr className="text-left border-b border-chirag-border">
              <th className="py-2 pr-3">Block</th>
              <th className="py-2 pr-3">District</th>
              <th className="py-2 pr-3">Springs</th>
              <th className="py-2 pr-3">Avg discharge (L/min)</th>
              <th className="py-2 pr-3">Δ% vs prev 90 d</th>
              <th className="py-2 pr-3">Status mix</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((b) => (
              <tr key={`${b.district}-${b.block}`} className="border-b border-chirag-border/60">
                <td className="py-2 pr-3 font-medium">{b.block}</td>
                <td className="py-2 pr-3">{b.district}</td>
                <td className="py-2 pr-3">{b.spring_count}</td>
                <td className="py-2 pr-3">{fmtNum(b.avg_discharge_lpm, 1)}</td>
                <td className="py-2 pr-3">
                  {b.discharge_change_pct === null
                    ? '—'
                    : <span className={b.discharge_change_pct >= 0 ? 'text-chirag-primary' : 'text-chirag-alert'}>
                        {b.discharge_change_pct >= 0 ? '+' : ''}{b.discharge_change_pct.toFixed(1)}%
                      </span>}
                </td>
                <td className="py-2 pr-3">
                  <MixBar mix={b.status_mix} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top + bottom 5 */}
        <TopBottom title="Best springs (by status)" rows={markers.filter((m) => m.status === 'green').slice(0, 5)} />
        <TopBottom title="Springs needing attention" rows={markers.filter((m) => m.status === 'red' || m.status === 'unknown').slice(0, 5)} accent="red" />
      </div>

      {/* District bar chart */}
      <section className="card">
        <h2 className="font-medium mb-3">Average discharge by district (L/min)</h2>
        <div style={{ height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={byDistrict} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="district" tick={{ fontSize: 11 }} stroke="#6B7280" />
              <YAxis tick={{ fontSize: 11 }} stroke="#6B7280" />
              <Tooltip formatter={(v) => [Number(v).toFixed(1) + ' L/min', 'Avg discharge']} />
              <Bar dataKey="avg" fill="#0277BD" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

function MixBar({ mix }: { mix: Record<string, number> }) {
  const total = (mix.green ?? 0) + (mix.amber ?? 0) + (mix.red ?? 0) + (mix.unknown ?? 0) || 1;
  return (
    <div className="flex items-center gap-2">
      <div className="flex w-32 h-2 rounded overflow-hidden">
        {(['green','amber','red','unknown'] as const).map((k) => (
          <div key={k} style={{ width: `${((mix[k] ?? 0) / total) * 100}%`, backgroundColor: STATUS_COLOR[k] }} />
        ))}
      </div>
      <div className="text-xs text-chirag-muted">
        {mix.green ?? 0} / {mix.amber ?? 0} / {mix.red ?? 0}
      </div>
    </div>
  );
}

function TopBottom({ title, rows, accent }: { title: string; rows: MapMarker[]; accent?: 'red' }) {
  return (
    <div className="card">
      <h2 className="font-medium mb-3">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-chirag-muted">No springs to show.</p> : (
        <ul className="space-y-2">
          {rows.map((m) => (
            <li key={m.id} className="flex justify-between items-center">
              <Link to={`/spring/${m.id}`} className="text-sm">
                <div className="font-medium">{m.name_hi}</div>
                <div className="text-xs text-chirag-muted">{m.village} · {m.block}</div>
              </Link>
              <span className={accent === 'red' ? 'pill-red' : 'pill-green'}>{m.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
