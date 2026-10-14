// SPDX-License-Identifier: MIT
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { AlertItem, OverdueItem } from '../api/types';
import { fmtDate, fmtDateTime } from '../lib/format';

export function Alerts() {
  const [anomalies, setAnomalies] = useState<AlertItem[]>([]);
  const [overdue, setOverdue] = useState<OverdueItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api.alerts()
      .then((r) => { setAnomalies(r.anomalies); setOverdue(r.overdue); })
      .catch((e) => setErr(e.message));
  }, []);

  async function notify(krpId: string, msg: string, key: string) {
    setBusyId(key);
    try {
      await api.notifyKrp(krpId, msg);
      setToast('SMS sent ✓');
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Failed to send');
      setTimeout(() => setToast(null), 4000);
    } finally { setBusyId(null); }
  }

  if (err) return <div className="p-6"><div className="card text-chirag-alert">Error: {err}</div></div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Alerts</h1>
        <p className="text-sm text-chirag-muted">Out-of-range readings and overdue sampling.</p>
      </header>

      {toast && (
        <div className="fixed bottom-4 right-4 bg-chirag-text text-white text-sm px-3 py-2 rounded-md shadow-lg z-50">
          {toast}
        </div>
      )}

      <section className="card">
        <h2 className="font-medium mb-3">Anomalies (last 60 days)</h2>
        {anomalies.length === 0 ? <p className="text-sm text-chirag-muted">No flagged readings.</p> : (
          <ul className="divide-y divide-chirag-border">
            {anomalies.map((a) => (
              <li key={`${a.kind}-${a.id}`} className="py-3 flex flex-wrap gap-3 items-center justify-between">
                <div className="text-sm">
                  <Link to={`/spring/${a.spring_id}`} className="font-medium">{a.name_en}</Link>
                  <span className="text-chirag-muted"> · {a.village}</span>
                  <div className="text-xs text-chirag-muted">
                    {a.kind === 'discharge' ? 'Discharge' : 'Quality'} · {fmtDateTime(a.recorded_at)}
                    {a.value !== null && <> · value {a.value}</>} · KRP {a.krp_name ?? '—'}
                  </div>
                </div>
                {a.krp_phone && (
                  <button
                    disabled={busyId === a.id}
                    onClick={() => notify(
                      // We need krp_id but the alert payload only carries krp_name + phone. The notify
                      // endpoint accepts krp_id — for the v0 dashboard we use the alert id as a stand-in
                      // identifier and the backend resolves by id. Replace with a real krp_id lookup endpoint
                      // when it's added.
                      a.id, `Anomaly flagged on ${a.name_en}. Please verify your last reading.`, a.id,
                    )}
                    className="btn-outline text-sm"
                  >Notify KRP</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="font-medium mb-3">Overdue sampling (&gt; 120 days)</h2>
        {overdue.length === 0 ? <p className="text-sm text-chirag-muted">All springs are up to date.</p> : (
          <ul className="divide-y divide-chirag-border">
            {overdue.map((o) => (
              <li key={o.id} className="py-3 flex flex-wrap gap-3 items-center justify-between">
                <div className="text-sm">
                  <Link to={`/spring/${o.id}`} className="font-medium">{o.name_en}</Link>
                  <span className="text-chirag-muted"> · {o.village} · {o.block}</span>
                  <div className="text-xs text-chirag-muted">
                    Last test: {fmtDate(o.last_test)} · {Math.round(o.days_since)} d ago
                    · KRP {o.krp_name ?? '—'}
                  </div>
                </div>
                {o.krp_phone && (
                  <button
                    disabled={busyId === o.id}
                    onClick={() => notify(o.id, `Reminder: ${o.name_en} ka paani-jaanch overdue hai. Kripya jaldi se record karein.`, o.id)}
                    className="btn-outline text-sm"
                  >Notify KRP</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
