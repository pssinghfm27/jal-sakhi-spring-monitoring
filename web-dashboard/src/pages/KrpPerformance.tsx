// SPDX-License-Identifier: MIT
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { KrpRow } from '../api/types';
import { fmtDate } from '../lib/format';

export function KrpPerformance() {
  const [rows, setRows] = useState<KrpRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    api.krpPerformance().then((r) => setRows(r.items)).catch((e) => setErr(e.message));
  }, []);

  async function ping(id: string) {
    setBusyId(id);
    try { await api.notifyKrp(id, 'CHIRAG: kripya is hafte ki readings dard karein.'); }
    catch (e) { console.error(e); }
    finally { setBusyId(null); }
  }

  function activityClass(lastActive: string | null) {
    if (!lastActive) return 'pill-red';
    const d = Math.floor((Date.now() - new Date(lastActive).getTime()) / 86_400_000);
    if (d <= 14) return 'pill-green';
    if (d <= 45) return 'pill-amber';
    return 'pill-red';
  }

  if (err) return <div className="p-6"><div className="card text-chirag-alert">Error: {err}</div></div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">KRP performance</h1>
        <p className="text-sm text-chirag-muted">Reporting cadence and last activity for every KRP.</p>
      </header>
      <section className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs text-chirag-muted">
            <tr className="text-left border-b border-chirag-border">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Phone</th>
              <th className="py-2 pr-3">Village / Block</th>
              <th className="py-2 pr-3">Discharge</th>
              <th className="py-2 pr-3">Quality</th>
              <th className="py-2 pr-3">Last active</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-chirag-border/60">
                <td className="py-2 pr-3 font-medium">{r.name}</td>
                <td className="py-2 pr-3"><a href={`tel:${r.phone}`} className="text-chirag-water">{r.phone}</a></td>
                <td className="py-2 pr-3">{r.village ?? '—'}{r.block && <span className="text-chirag-muted"> · {r.block}</span>}</td>
                <td className="py-2 pr-3">{r.discharge_count}</td>
                <td className="py-2 pr-3">{r.quality_count}</td>
                <td className="py-2 pr-3">
                  <span className={activityClass(r.last_active)}>{fmtDate(r.last_active)}</span>
                </td>
                <td className="py-2 pr-3 text-right">
                  <button onClick={() => ping(r.id)} disabled={busyId === r.id} className="btn-outline text-xs !py-1">Ping SMS</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
