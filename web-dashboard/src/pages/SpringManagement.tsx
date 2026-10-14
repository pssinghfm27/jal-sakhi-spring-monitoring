// SPDX-License-Identifier: MIT
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import type { SpringManaged, UploadResult, UploadHistoryItem, Village } from '../api/types';
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

type SortKey = 'code' | 'name_en' | 'village_name' | 'block' | 'district' | 'spring_type' | 'active' | 'discharge_count' | 'quality_count' | 'last_quality_at';

export function SpringManagement() {
  /* ─── state ─── */
  const [springs, setSprings] = useState<SpringManaged[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [blockFilter, setBlockFilter] = useState('');

  // sort
  const [sortKey, setSortKey] = useState<SortKey>('code');
  const [sortAsc, setSortAsc] = useState(true);

  // upload
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // upload history
  const [history, setHistory] = useState<UploadHistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // modals
  const [addOpen, setAddOpen] = useState(false);
  const [editSpring, setEditSpring] = useState<SpringManaged | null>(null);
  const [formBusy, setFormBusy] = useState(false);

  // busy action row
  const [busyId, setBusyId] = useState<string | null>(null);

  /* ─── helpers ─── */
  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  /* ─── load ─── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, v] = await Promise.all([api.springsAll(), api.villages()]);
      setSprings(s.items);
      setVillages(v.items);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  /* ─── derived data ─── */
  const blocks = useMemo(() => [...new Set(springs.map(s => s.block))].sort(), [springs]);
  const totalActive = springs.filter(s => s.active).length;
  const totalInactive = springs.length - totalActive;

  const filtered = useMemo(() => {
    let list = springs;
    if (statusFilter === 'active') list = list.filter(s => s.active);
    else if (statusFilter === 'inactive') list = list.filter(s => !s.active);
    if (blockFilter) list = list.filter(s => s.block === blockFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.code.toLowerCase().includes(q) ||
        s.name_en.toLowerCase().includes(q) ||
        (s.name_hi && s.name_hi.toLowerCase().includes(q)) ||
        s.village_name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [springs, statusFilter, blockFilter, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let av: string | number | boolean = '';
      let bv: string | number | boolean = '';
      switch (sortKey) {
        case 'code': av = a.code; bv = b.code; break;
        case 'name_en': av = a.name_en; bv = b.name_en; break;
        case 'village_name': av = a.village_name; bv = b.village_name; break;
        case 'block': av = a.block; bv = b.block; break;
        case 'district': av = a.district; bv = b.district; break;
        case 'spring_type': av = a.spring_type || ''; bv = b.spring_type || ''; break;
        case 'active': av = a.active ? 1 : 0; bv = b.active ? 1 : 0; break;
        case 'discharge_count': av = a.discharge_count; bv = b.discharge_count; break;
        case 'quality_count': av = a.quality_count; bv = b.quality_count; break;
        case 'last_quality_at': av = a.last_quality_at || ''; bv = b.last_quality_at || ''; break;
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return '↕';
    return sortAsc ? '↑' : '↓';
  }

  /* ─── upload ─── */
  async function handleFile(file: File) {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) { flash('Please upload .xlsx, .xls, or .csv'); return; }
    setUploading(true);
    try {
      const res = await api.springsUpload(file);
      setUploadResult(res);
      flash(`Upload complete: ${res.summary.created} created, ${res.summary.updated} updated`);
      load();
    } catch (e) { flash(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setUploading(false); }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  }

  /* ─── toggle active ─── */
  async function toggleActive(s: SpringManaged) {
    setBusyId(s.id);
    try {
      if (s.active) await api.springDeactivate(s.id);
      else await api.springActivate(s.id);
      setSprings(prev => prev.map(x => x.id === s.id ? { ...x, active: !x.active } : x));
      flash(s.active ? 'Spring deactivated' : 'Spring activated');
    } catch (e) { flash(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusyId(null); }
  }

  /* ─── load history ─── */
  async function loadHistory() {
    if (historyOpen) { setHistoryOpen(false); return; }
    try {
      const r = await api.springsUploadHistory();
      setHistory(r.items);
      setHistoryOpen(true);
    } catch { flash('Failed to load history'); }
  }

  /* ─── error state ─── */
  if (error) return (
    <div className="p-6"><div className="card text-chirag-alert">Error: {error}</div></div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-chirag-text text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50 animate-fade-in flex items-center gap-2">
          <span>✓</span> {toast}
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Spring Management</h1>
          <p className="text-sm text-chirag-muted">Register, update, and manage monitored springs across all blocks.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAddOpen(true)} className="btn-primary text-sm">+ Add Spring</button>
          <button onClick={load} className="btn-outline text-sm">Refresh</button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Springs', value: springs.length, color: 'text-chirag-text', bg: 'bg-chirag-surface' },
          { label: 'Active', value: totalActive, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Inactive', value: totalInactive, color: 'text-red-700', bg: 'bg-red-50' },
          { label: 'Blocks Covered', value: blocks.length, color: 'text-chirag-water', bg: 'bg-blue-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl border border-chirag-border p-4 transition-shadow hover:shadow-md`}>
            <div className="text-xs text-chirag-muted font-medium uppercase tracking-wide">{s.label}</div>
            <div className={`text-2xl font-bold mt-1 ${s.color}`}>{loading ? '—' : s.value}</div>
          </div>
        ))}
      </div>

      {/* Upload Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Bulk Upload</h2>
          <div className="flex gap-2">
            <button onClick={loadHistory} className="btn-outline text-xs">
              {historyOpen ? 'Hide' : 'Show'} History
            </button>
            <a href="/api/springs/template" download className="btn-outline text-xs">↓ Download Template</a>
          </div>
        </div>
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
            ${dragOver ? 'border-chirag-primary bg-green-50' : 'border-chirag-border hover:border-chirag-primary/50 hover:bg-chirag-bg'}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Spinner className="h-8 w-8" />
              <span className="text-sm text-chirag-muted">Uploading and processing…</span>
            </div>
          ) : (
            <>
              <div className="text-3xl mb-2">📄</div>
              <p className="font-medium">Drag and drop your spreadsheet here</p>
              <p className="text-sm text-chirag-muted mt-1">or click to browse · Accepts .xlsx, .xls, .csv</p>
            </>
          )}
        </div>

        {/* Upload History */}
        {historyOpen && history.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-chirag-muted">
                <tr className="border-b border-chirag-border">
                  <th className="py-2 pr-3 text-left">File</th>
                  <th className="py-2 pr-3 text-left">Uploaded By</th>
                  <th className="py-2 pr-3 text-left">Rows</th>
                  <th className="py-2 pr-3 text-left">Created</th>
                  <th className="py-2 pr-3 text-left">Updated</th>
                  <th className="py-2 pr-3 text-left">Errors</th>
                  <th className="py-2 pr-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} className="border-b border-chirag-border/60 hover:bg-chirag-bg/50">
                    <td className="py-2 pr-3 font-medium">{h.filename}</td>
                    <td className="py-2 pr-3">{h.uploaded_by_name}</td>
                    <td className="py-2 pr-3">{h.total_rows}</td>
                    <td className="py-2 pr-3 text-green-700">{h.created_count}</td>
                    <td className="py-2 pr-3 text-chirag-water">{h.updated_count}</td>
                    <td className="py-2 pr-3">{h.error_count > 0 ? <span className="text-chirag-alert font-medium">{h.error_count}</span> : '0'}</td>
                    <td className="py-2 pr-3 text-chirag-muted">{fmtDateTime(h.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {historyOpen && history.length === 0 && (
          <p className="text-sm text-chirag-muted text-center py-4 mt-4">No upload history yet.</p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-chirag-muted text-sm">🔍</span>
          <input
            type="text" placeholder="Search code, name, village…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className="input !w-auto min-w-[120px]">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={blockFilter} onChange={e => setBlockFilter(e.target.value)} className="input !w-auto min-w-[140px]">
          <option value="">All Blocks</option>
          {blocks.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <span className="text-sm text-chirag-muted">{filtered.length} of {springs.length} springs</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card flex flex-col items-center py-16 gap-3">
          <Spinner className="h-10 w-10" />
          <span className="text-sm text-chirag-muted">Loading springs…</span>
        </div>
      ) : sorted.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-2">🔍</div>
          <p className="font-medium">No springs found</p>
          <p className="text-sm text-chirag-muted mt-1">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <section className="card overflow-x-auto p-0">
          <table className="min-w-full text-sm">
            <thead className="text-xs text-chirag-muted bg-chirag-bg sticky top-0 z-10">
              <tr className="text-left border-b border-chirag-border">
                {([
                  ['code', 'Code'],
                  ['name_en', 'Name (EN)'],
                  ['village_name', 'Village'],
                  ['block', 'Block'],
                  ['district', 'District'],
                  ['spring_type', 'Type'],
                  ['active', 'Status'],
                  ['discharge_count', 'Readings'],
                  ['last_quality_at', 'Last Reading'],
                ] as [SortKey, string][]).map(([k, label]) => (
                  <th
                    key={k}
                    onClick={() => toggleSort(k)}
                    className="py-3 px-4 cursor-pointer hover:text-chirag-primary select-none whitespace-nowrap"
                  >
                    {label} <span className="text-[10px] ml-0.5">{sortIcon(k)}</span>
                  </th>
                ))}
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <tr
                  key={s.id}
                  className={`border-b border-chirag-border/40 transition-colors hover:bg-chirag-primary/5 ${i % 2 === 0 ? '' : 'bg-chirag-bg/30'}`}
                >
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-chirag-water">{s.code}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium">{s.name_en}</div>
                    {s.name_hi && <div className="text-xs text-chirag-muted">{s.name_hi}</div>}
                  </td>
                  <td className="py-3 px-4">{s.village_name}</td>
                  <td className="py-3 px-4">{s.block}</td>
                  <td className="py-3 px-4">{s.district}</td>
                  <td className="py-3 px-4">{s.spring_type ?? '—'}</td>
                  <td className="py-3 px-4">
                    <span className={s.active ? 'pill-green' : 'pill-red'}>{s.active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-3 text-xs">
                      <span title="Discharge readings" className="text-green-700">D: {s.discharge_count}</span>
                      <span title="Quality readings" className="text-chirag-water">Q: {s.quality_count}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-chirag-muted text-xs whitespace-nowrap">{fmtDate(s.last_quality_at || s.last_discharge_at)}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditSpring(s)}
                        className="btn-outline text-xs !py-1 !px-2.5"
                      >Edit</button>
                      <button
                        onClick={() => toggleActive(s)}
                        disabled={busyId === s.id}
                        className={`btn text-xs !py-1 !px-2.5 ${s.active
                          ? 'border border-chirag-alert text-chirag-alert hover:bg-red-50'
                          : 'border border-green-600 text-green-700 hover:bg-green-50'}`}
                      >
                        {busyId === s.id ? '…' : s.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Upload Result Modal */}
      {uploadResult && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-40 p-4" onClick={() => setUploadResult(null)}>
          <div className="card w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-3">Upload Results</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-chirag-bg rounded-lg p-3 text-center">
                <div className="text-xl font-bold">{uploadResult.summary.total_parsed}</div>
                <div className="text-xs text-chirag-muted">Parsed</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-green-700">{uploadResult.summary.created}</div>
                <div className="text-xs text-chirag-muted">Created</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-chirag-water">{uploadResult.summary.updated}</div>
                <div className="text-xs text-chirag-muted">Updated</div>
              </div>
              <div className={`rounded-lg p-3 text-center ${uploadResult.summary.errors > 0 ? 'bg-red-50' : 'bg-chirag-bg'}`}>
                <div className={`text-xl font-bold ${uploadResult.summary.errors > 0 ? 'text-chirag-alert' : ''}`}>{uploadResult.summary.errors}</div>
                <div className="text-xs text-chirag-muted">Errors</div>
              </div>
            </div>
            {uploadResult.summary.error_details.length > 0 && (
              <div className="max-h-40 overflow-y-auto mb-3 border border-chirag-border rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="text-xs text-chirag-muted bg-chirag-bg sticky top-0">
                    <tr><th className="py-1.5 px-3 text-left">Row</th><th className="py-1.5 px-3 text-left">Error</th></tr>
                  </thead>
                  <tbody>
                    {uploadResult.summary.error_details.map((e, i) => (
                      <tr key={i} className="border-t border-chirag-border/40">
                        <td className="py-1.5 px-3 font-mono text-xs">{e.row}</td>
                        <td className="py-1.5 px-3 text-chirag-alert text-xs">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => setUploadResult(null)} className="btn-primary text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Spring Modal */}
      {addOpen && (
        <SpringFormModal
          title="Add New Spring"
          villages={villages}
          onClose={() => setAddOpen(false)}
          busy={formBusy}
          onSubmit={async (data) => {
            setFormBusy(true);
            try {
              const r = await api.springCreate(data);
              setSprings(prev => [...prev, r.spring]);
              flash('Spring created successfully');
              setAddOpen(false);
            } catch (e) { flash(e instanceof Error ? e.message : 'Failed'); }
            finally { setFormBusy(false); }
          }}
        />
      )}

      {/* Edit Spring Modal */}
      {editSpring && (
        <SpringFormModal
          title={`Edit Spring — ${editSpring.code}`}
          villages={villages}
          initial={editSpring}
          onClose={() => setEditSpring(null)}
          busy={formBusy}
          onSubmit={async (data) => {
            setFormBusy(true);
            try {
              await api.springUpdate(editSpring.id, data);
              setSprings(prev => prev.map(x => x.id === editSpring.id ? { ...x, ...data as Partial<SpringManaged> } : x));
              flash('Spring updated successfully');
              setEditSpring(null);
            } catch (e) { flash(e instanceof Error ? e.message : 'Failed'); }
            finally { setFormBusy(false); }
          }}
        />
      )}
    </div>
  );
}

/* ─── Reusable form modal for Add / Edit spring ─── */
function SpringFormModal({
  title, villages, initial, onClose, onSubmit, busy,
}: {
  title: string;
  villages: Village[];
  initial?: SpringManaged;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}) {
  const [code, setCode] = useState(initial?.code ?? '');
  const [nameEn, setNameEn] = useState(initial?.name_en ?? '');
  const [nameHi, setNameHi] = useState(initial?.name_hi ?? '');
  const [villageId, setVillageId] = useState(initial?.village_id ?? '');
  const [lat, setLat] = useState(initial?.lat?.toString() ?? '');
  const [lon, setLon] = useState(initial?.lon?.toString() ?? '');
  const [altitude, setAltitude] = useState(initial?.altitude_m?.toString() ?? '');
  const [springType, setSpringType] = useState(initial?.spring_type ?? '');
  const [projectName, setProjectName] = useState(initial?.project_name ?? '');

  function handle(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      code, name_en: nameEn, name_hi: nameHi || null,
      village_id: villageId, lat: lat ? parseFloat(lat) : null, lon: lon ? parseFloat(lon) : null,
      altitude_m: altitude ? parseFloat(altitude) : null,
      spring_type: springType || null, project_name: projectName || null,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-40 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        <form onSubmit={handle} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-chirag-muted">Code *</label>
              <input value={code} onChange={e => setCode(e.target.value)} required className="input" placeholder="SPR-001" />
            </div>
            <div>
              <label className="text-xs font-medium text-chirag-muted">Spring Type</label>
              <select value={springType} onChange={e => setSpringType(e.target.value)} className="input">
                <option value="">Select type</option>
                {['Perennial', 'Seasonal', 'Seepage', 'Artesian', 'Other'].map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-chirag-muted">Name (English) *</label>
            <input value={nameEn} onChange={e => setNameEn(e.target.value)} required className="input" />
          </div>
          <div>
            <label className="text-xs font-medium text-chirag-muted">Name (Hindi)</label>
            <input value={nameHi} onChange={e => setNameHi(e.target.value)} className="input" />
          </div>
          <div>
            <label className="text-xs font-medium text-chirag-muted">Village *</label>
            <select value={villageId} onChange={e => setVillageId(e.target.value)} required className="input">
              <option value="">Select village</option>
              {villages.map(v => <option key={v.id} value={v.id}>{v.name} — {v.block}, {v.district}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-chirag-muted">Latitude</label>
              <input value={lat} onChange={e => setLat(e.target.value)} type="number" step="any" className="input" />
            </div>
            <div>
              <label className="text-xs font-medium text-chirag-muted">Longitude</label>
              <input value={lon} onChange={e => setLon(e.target.value)} type="number" step="any" className="input" />
            </div>
            <div>
              <label className="text-xs font-medium text-chirag-muted">Altitude (m)</label>
              <input value={altitude} onChange={e => setAltitude(e.target.value)} type="number" step="any" className="input" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-chirag-muted">Project Name</label>
            <input value={projectName} onChange={e => setProjectName(e.target.value)} className="input" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-outline text-sm">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary text-sm">
              {busy ? <Spinner className="h-4 w-4" /> : initial ? 'Save Changes' : 'Create Spring'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
