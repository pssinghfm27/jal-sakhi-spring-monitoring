// SPDX-License-Identifier: MIT
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { fmtDateTime } from '../lib/format';

interface PendingKrp {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  signup_note: string | null;
  village_id: string | null;
  village_name: string | null;
  block: string | null;
  district: string | null;
}

export function PendingApprovals() {
  const [items, setItems] = useState<PendingKrp[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<PendingKrp | null>(null);
  const [reason, setReason] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    try {
      const r = await api.pendingKrps();
      setItems(r.items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'load failed');
    }
  }
  useEffect(() => { load(); }, []);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function approve(id: string) {
    setBusyId(id);
    try {
      await api.approveKrp(id);
      flash('Approved ✓');
      setItems((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Failed');
    } finally { setBusyId(null); }
  }

  async function reject() {
    if (!rejectFor || reason.trim().length < 2) return;
    setBusyId(rejectFor.id);
    try {
      await api.rejectKrp(rejectFor.id, reason.trim());
      flash('Rejected ✓');
      setItems((prev) => prev.filter((p) => p.id !== rejectFor.id));
      setRejectFor(null); setReason('');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Failed');
    } finally { setBusyId(null); }
  }

  if (err) return <div className="p-6"><div className="card text-chirag-alert">Error: {err}</div></div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Pending KRP approvals</h1>
          <p className="text-sm text-chirag-muted">
            New KRPs who signed up in the mobile app and are waiting to be approved.
          </p>
        </div>
        <button onClick={load} className="btn-outline text-sm">Refresh</button>
      </header>

      {toast && (
        <div className="fixed bottom-4 right-4 bg-chirag-text text-white text-sm px-3 py-2 rounded-md shadow-lg z-50">
          {toast}
        </div>
      )}

      {items.length === 0 ? (
        <div className="card text-center py-10">
          <div className="text-4xl mb-2">✓</div>
          <p className="font-medium">No pending approvals</p>
          <p className="text-sm text-chirag-muted">New signups will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((p) => (
            <div key={p.id} className="card">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{p.name}</h2>
                    <span className="pill-amber">pending</span>
                  </div>
                  <div className="text-sm text-chirag-muted mt-1">
                    <span className="font-mono">{p.phone}</span>
                    {' · '}
                    {p.village_name ? `${p.village_name}, ${p.block}, ${p.district}` : <em>(no village set)</em>}
                  </div>
                  {p.signup_note && (
                    <div className="mt-2 text-sm bg-chirag-bg border border-chirag-border rounded p-2">
                      <span className="text-chirag-muted text-xs">Note from KRP: </span>
                      {p.signup_note}
                    </div>
                  )}
                  <div className="text-xs text-chirag-muted mt-2">
                    Requested {fmtDateTime(p.created_at)}
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-stretch min-w-[140px]">
                  <button
                    onClick={() => approve(p.id)}
                    disabled={busyId === p.id}
                    className="btn-primary"
                  >Approve</button>
                  <button
                    onClick={() => { setRejectFor(p); setReason(''); }}
                    disabled={busyId === p.id}
                    className="btn-outline"
                  >Reject…</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject dialog */}
      {rejectFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4"
             onClick={() => setRejectFor(null)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2">Reject {rejectFor.name}?</h2>
            <p className="text-sm text-chirag-muted mb-3">
              They will see your reason when they try to log in.
            </p>
            <textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Reason (visible to KRP)…"
              className="input"
            />
            <div className="flex gap-2 justify-end mt-3">
              <button className="btn-outline" onClick={() => setRejectFor(null)}>Cancel</button>
              <button className="btn-primary !bg-chirag-alert hover:!bg-red-700"
                      disabled={reason.trim().length < 2}
                      onClick={reject}>
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
