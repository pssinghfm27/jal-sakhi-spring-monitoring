// SPDX-License-Identifier: MIT
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { KrpManaged, Village } from '../api/types';
import { fmtDate, fmtDateTime } from '../lib/format';

/* ─── tiny spinner ─── */
function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin text-chirag-primary ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function statusBadge(status: string) {
  switch (status) {
    case 'approved': return 'pill-green';
    case 'pending': return 'pill-amber';
    case 'rejected': return 'pill-red';
    default: return 'pill-muted';
  }
}

function activityClass(lastActive: string | null) {
  if (!lastActive) return 'pill-red';
  const d = Math.floor((Date.now() - new Date(lastActive).getTime()) / 86_400_000);
  if (d <= 14) return 'pill-green';
  if (d <= 45) return 'pill-amber';
  return 'pill-red';
}

export function KrpManagement() {
  const navigate = useNavigate();

  const [krps, setKrps] = useState<KrpManaged[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [villageFilter, setVillageFilter] = useState('');

  // modals
  const [editKrp, setEditKrp] = useState<KrpManaged | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  // action busy
  const [busyId, setBusyId] = useState<string | null>(null);

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  /* ─── load ─── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [k, v] = await Promise.all([api.krpAll(), api.villages()]);
      setKrps(k.items);
      setVillages(v.items);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  /* ─── stats ─── */
  const stats = useMemo(() => ({
    total: krps.length,
    active: krps.filter(k => k.active).length,
    approved: krps.filter(k => k.approval_status === 'approved').length,
    pending: krps.filter(k => k.approval_status === 'pending').length,
    rejected: krps.filter(k => k.approval_status === 'rejected').length,
  }), [krps]);

  /* ─── filtered list ─── */
  const filtered = useMemo(() => {
    let list = krps;
    if (statusFilter !== 'all') list = list.filter(k => k.approval_status === statusFilter);
    if (villageFilter) list = list.filter(k => k.village_id === villageFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(k =>
        k.name.toLowerCase().includes(q) ||
        k.phone.includes(q)
      );
    }
    return list;
  }, [krps, statusFilter, villageFilter, search]);

  /* ─── approve / reject ─── */
  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await api.approveKrp(id);
      setKrps(prev => prev.map(k => k.id === id ? { ...k, approval_status: 'approved' } : k));
      flash('KRP approved ✓');
    } catch (e) { flash(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusyId(null); }
  }

  async function handleReject(id: string) {
    const reason = prompt('Reason for rejection:');
    if (!reason || reason.trim().length < 2) return;
    setBusyId(id);
    try {
      await api.rejectKrp(id, reason.trim());
      setKrps(prev => prev.map(k => k.id === id ? { ...k, approval_status: 'rejected', rejected_reason: reason.trim() } : k));
      flash('KRP rejected');
    } catch (e) { flash(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusyId(null); }
  }

  /* ─── toggle active ─── */
  async function toggleActive(krp: KrpManaged) {
    setBusyId(krp.id);
    try {
      await api.krpUpdate(krp.id, { active: !krp.active });
      setKrps(prev => prev.map(k => k.id === krp.id ? { ...k, active: !k.active } : k));
      flash(krp.active ? 'KRP deactivated' : 'KRP activated');
    } catch (e) { flash(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusyId(null); }
  }

  /* ─── ping ─── */
  async function ping(id: string) {
    setBusyId(id);
    try { await api.notifyKrp(id, 'CHIRAG: kripya is hafte ki readings dard karein.'); flash('SMS sent'); }
    catch (e) { flash(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusyId(null); }
  }

  if (error) return <div className="p-6"><div className="card text-chirag-alert">Error: {error}</div></div>;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-chirag-text text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <span>✓</span> {toast}
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">KRP Management</h1>
          <p className="text-sm text-chirag-muted">Manage Krishi Resource Persons — approvals, assignments, and performance.</p>
        </div>
        <button onClick={load} className="btn-outline text-sm">Refresh</button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total KRPs', value: stats.total, color: 'text-chirag-text', bg: 'bg-chirag-surface' },
          { label: 'Active', value: stats.active, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Approved', value: stats.approved, color: 'text-green-700', bg: 'bg-emerald-50' },
          { label: 'Pending', value: stats.pending, color: 'text-yellow-700', bg: 'bg-yellow-50' },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-700', bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl border border-chirag-border p-4 transition-shadow hover:shadow-md`}>
            <div className="text-xs text-chirag-muted font-medium uppercase tracking-wide">{s.label}</div>
            <div className={`text-2xl font-bold mt-1 ${s.color}`}>{loading ? '—' : s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-chirag-muted text-sm">🔍</span>
          <input
            type="text" placeholder="Search name or phone…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input !w-auto min-w-[130px]">
          <option value="all">All Status</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={villageFilter} onChange={e => setVillageFilter(e.target.value)} className="input !w-auto min-w-[160px]">
          <option value="">All Villages</option>
          {villages.map(v => <option key={v.id} value={v.id}>{v.name} — {v.block}</option>)}
        </select>
        <span className="text-sm text-chirag-muted">{filtered.length} of {krps.length} KRPs</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card flex flex-col items-center py-16 gap-3">
          <Spinner className="h-10 w-10" />
          <span className="text-sm text-chirag-muted">Loading KRPs…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-2">👥</div>
          <p className="font-medium">No KRPs found</p>
          <p className="text-sm text-chirag-muted mt-1">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <section className="card overflow-x-auto p-0">
          <table className="min-w-full text-sm">
            <thead className="text-xs text-chirag-muted bg-chirag-bg sticky top-0 z-10">
              <tr className="text-left border-b border-chirag-border">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Village / Block</th>
                <th className="py-3 px-4">Approval</th>
                <th className="py-3 px-4">Active</th>
                <th className="py-3 px-4">Readings</th>
                <th className="py-3 px-4">Last Active</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((k, i) => (
                <tr
                  key={k.id}
                  className={`border-b border-chirag-border/40 transition-colors hover:bg-chirag-primary/5 ${i % 2 === 0 ? '' : 'bg-chirag-bg/30'}`}
                >
                  <td className="py-3 px-4">
                    <div className="font-medium">{k.name}</div>
                    {k.signup_note && <div className="text-xs text-chirag-muted mt-0.5 truncate max-w-[200px]" title={k.signup_note}>📝 {k.signup_note}</div>}
                  </td>
                  <td className="py-3 px-4">
                    <a href={`tel:${k.phone}`} className="text-chirag-water font-mono text-xs">{k.phone}</a>
                  </td>
                  <td className="py-3 px-4">
                    {k.village_name || <span className="text-chirag-muted italic">Unassigned</span>}
                    {k.block && <span className="text-chirag-muted"> · {k.block}</span>}
                  </td>
                  <td className="py-3 px-4">
                    <span className={statusBadge(k.approval_status)}>
                      {k.approval_status}
                    </span>
                    {k.rejected_reason && (
                      <div className="text-xs text-chirag-alert mt-0.5 truncate max-w-[150px]" title={k.rejected_reason}>
                        {k.rejected_reason}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => toggleActive(k)}
                      disabled={busyId === k.id}
                      className={`relative w-10 h-5 rounded-full transition-colors ${k.active ? 'bg-chirag-primary' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${k.active ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-3 text-xs">
                      <span className="text-green-700" title="Discharge">D: {k.discharge_count}</span>
                      <span className="text-chirag-water" title="Quality">Q: {k.quality_count}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={activityClass(k.last_active)}>
                      {fmtDate(k.last_active)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1.5 flex-wrap">
                      <button onClick={() => setEditKrp(k)} className="btn-outline text-xs !py-1 !px-2">Edit</button>
                      <button
                        onClick={() => navigate(`/readings?krp_id=${k.id}`)}
                        className="btn-outline text-xs !py-1 !px-2 text-chirag-water"
                      >Readings</button>
                      {k.approval_status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(k.id)}
                            disabled={busyId === k.id}
                            className="btn-primary text-xs !py-1 !px-2"
                          >Approve</button>
                          <button
                            onClick={() => handleReject(k.id)}
                            disabled={busyId === k.id}
                            className="btn text-xs !py-1 !px-2 border border-chirag-alert text-chirag-alert hover:bg-red-50"
                          >Reject</button>
                        </>
                      )}
                      <button
                        onClick={() => ping(k.id)}
                        disabled={busyId === k.id}
                        className="btn-outline text-xs !py-1 !px-2"
                        title="Send SMS reminder"
                      >📲</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Edit Modal */}
      {editKrp && (
        <EditKrpModal
          krp={editKrp}
          villages={villages}
          busy={editBusy}
          onClose={() => setEditKrp(null)}
          onSave={async (data) => {
            setEditBusy(true);
            try {
              await api.krpUpdate(editKrp.id, data);
              setKrps(prev => prev.map(k => k.id === editKrp.id ? { ...k, ...data as Partial<KrpManaged> } : k));
              flash('KRP updated successfully');
              setEditKrp(null);
            } catch (e) { flash(e instanceof Error ? e.message : 'Failed'); }
            finally { setEditBusy(false); }
          }}
        />
      )}
    </div>
  );
}

/* ─── Edit KRP Modal ─── */
function EditKrpModal({
  krp, villages, busy, onClose, onSave,
}: {
  krp: KrpManaged; villages: Village[]; busy: boolean;
  onClose: () => void; onSave: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(krp.name);
  const [phone, setPhone] = useState(krp.phone);
  const [villageId, setVillageId] = useState(krp.village_id || '');
  const [active, setActive] = useState(krp.active);

  function handle(e: React.FormEvent) {
    e.preventDefault();
    onSave({ name, phone, village_id: villageId || null, active });
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Edit KRP — {krp.name}</h2>
        <form onSubmit={handle} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-chirag-muted block mb-1">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required className="input" />
          </div>
          <div>
            <label className="text-xs font-medium text-chirag-muted block mb-1">Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} required className="input" />
          </div>
          <div>
            <label className="text-xs font-medium text-chirag-muted block mb-1">Assigned Village</label>
            <select value={villageId} onChange={e => setVillageId(e.target.value)} className="input">
              <option value="">Unassigned</option>
              {villages.map(v => <option key={v.id} value={v.id}>{v.name} — {v.block}, {v.district}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-chirag-muted">Active:</label>
            <button
              type="button"
              onClick={() => setActive(!active)}
              className={`relative w-10 h-5 rounded-full transition-colors ${active ? 'bg-chirag-primary' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${active ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
          {krp.approval_status === 'pending' && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              ⚠️ This KRP is still pending approval. Use Approve/Reject buttons in the table.
            </div>
          )}
          {krp.rejected_reason && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              Rejection reason: {krp.rejected_reason}
            </div>
          )}
          <div className="text-xs text-chirag-muted pt-1">
            Joined: {fmtDateTime(krp.created_at)}
            {krp.approved_at && <> · Approved: {fmtDateTime(krp.approved_at)}</>}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-outline text-sm">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary text-sm">
              {busy ? <Spinner className="h-4 w-4" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
