// SPDX-License-Identifier: MIT
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { ReadingRow, PaginatedReadings } from '../api/types';
import { fmtDate, fmtDateTime, fmtNum } from '../lib/format';

/* ─── tiny spinner ─── */
function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin text-chirag-primary ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

const PAGE_SIZE = 25;

export function ReadingsExplorer() {
  const [searchParams, setSearchParams] = useSearchParams();

  /* ─── filters from URL ─── */
  const initialKind = searchParams.get('kind') || '';
  const initialSpring = searchParams.get('spring') || '';
  const initialKrp = searchParams.get('krp_id') || searchParams.get('krp') || '';
  const initialFrom = searchParams.get('from') || '';
  const initialTo = searchParams.get('to') || '';

  const [kind, setKind] = useState(initialKind);
  const [springFilter, setSpringFilter] = useState(initialSpring);
  const [krpFilter, setKrpFilter] = useState(initialKrp);
  const [dateFrom, setDateFrom] = useState(initialFrom);
  const [dateTo, setDateTo] = useState(initialTo);
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PaginatedReadings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  const fetchData = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.dashboardReadings({
        kind: kind || undefined,
        spring_id: springFilter || undefined,
        krp_id: krpFilter || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        page: p,
        limit: PAGE_SIZE,
      });
      setData(res);
      setPage(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load readings');
    } finally { setLoading(false); }
  }, [kind, springFilter, krpFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  /* sync filters to URL */
  function applyFilters() {
    const p: Record<string, string> = {};
    if (kind) p.kind = kind;
    if (springFilter) p.spring = springFilter;
    if (krpFilter) p.krp = krpFilter;
    if (dateFrom) p.from = dateFrom;
    if (dateTo) p.to = dateTo;
    setSearchParams(p, { replace: true });
    fetchData(1);
  }

  function clearFilters() {
    setKind(''); setSpringFilter(''); setKrpFilter('');
    setDateFrom(''); setDateTo('');
    setSearchParams({}, { replace: true });
  }

  /* ─── export CSV ─── */
  function exportCsv() {
    if (!data || data.items.length === 0) { flash('No data to export'); return; }
    const headers = ['Kind','Spring','KRP','Date','Discharge LPM','pH','TDS','Anomaly','Village','Block','District'];
    const rows = data.items.map(r => [
      r.kind, r.spring_name, r.krp_name || '', fmtDateTime(r.recorded_at),
      r.discharge_lpm?.toString() || '', r.ph?.toString() || '', r.tds?.toString() || '',
      r.anomaly ? 'Yes' : 'No', r.village_name, r.block, r.district,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `readings_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    flash('Export downloaded');
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
          <h1 className="text-2xl font-semibold tracking-tight">Readings Explorer</h1>
          <p className="text-sm text-chirag-muted">Browse and analyze all discharge & water quality readings.</p>
        </div>
        <button onClick={exportCsv} className="btn-outline text-sm">↓ Export CSV</button>
      </header>

      {/* Filter Bar */}
      <div className="card">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[130px]">
            <label className="text-xs font-medium text-chirag-muted block mb-1">Type</label>
            <select value={kind} onChange={e => setKind(e.target.value)} className="input">
              <option value="">All Types</option>
              <option value="discharge">Discharge</option>
              <option value="quality">Water Quality</option>
            </select>
          </div>
          <div className="min-w-[160px] flex-1 max-w-xs">
            <label className="text-xs font-medium text-chirag-muted block mb-1">Spring (ID or name)</label>
            <input value={springFilter} onChange={e => setSpringFilter(e.target.value)} className="input" placeholder="Spring ID…" />
          </div>
          <div className="min-w-[160px] flex-1 max-w-xs">
            <label className="text-xs font-medium text-chirag-muted block mb-1">KRP (ID or name)</label>
            <input value={krpFilter} onChange={e => setKrpFilter(e.target.value)} className="input" placeholder="KRP ID…" />
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs font-medium text-chirag-muted block mb-1">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input" />
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs font-medium text-chirag-muted block mb-1">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input" />
          </div>
          <div className="flex gap-2">
            <button onClick={applyFilters} className="btn-primary text-sm">Apply</button>
            <button onClick={clearFilters} className="btn-outline text-sm">Clear</button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      {loading ? (
        <div className="card flex flex-col items-center py-16 gap-3">
          <Spinner className="h-10 w-10" />
          <span className="text-sm text-chirag-muted">Loading readings…</span>
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-2">📋</div>
          <p className="font-medium">No readings found</p>
          <p className="text-sm text-chirag-muted mt-1">Try adjusting your filters or date range.</p>
        </div>
      ) : (
        <>
          <section className="card overflow-x-auto p-0">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-chirag-muted bg-chirag-bg sticky top-0 z-10">
                <tr className="text-left border-b border-chirag-border">
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Spring</th>
                  <th className="py-3 px-4">KRP</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Key Values</th>
                  <th className="py-3 px-4">Anomaly</th>
                  <th className="py-3 px-4">📷</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r, i) => (
                  <ReadingTableRow
                    key={r.id}
                    row={r}
                    index={i}
                    expanded={expandedId === r.id}
                    onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  />
                ))}
              </tbody>
            </table>
          </section>

          {/* Pagination */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-sm text-chirag-muted">
              Showing {(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)} of {data.total} readings
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchData(page - 1)}
                disabled={page <= 1}
                className="btn-outline text-sm"
              >← Previous</button>
              <span className="flex items-center px-3 text-sm font-medium">
                Page {data.page} of {data.pages}
              </span>
              <button
                onClick={() => fetchData(page + 1)}
                disabled={page >= data.pages}
                className="btn-outline text-sm"
              >Next →</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Row Component with expandable details ─── */
function ReadingTableRow({ row: r, index, expanded, onToggle }: {
  row: ReadingRow; index: number; expanded: boolean; onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`border-b border-chirag-border/40 cursor-pointer transition-colors hover:bg-chirag-primary/5
          ${index % 2 === 0 ? '' : 'bg-chirag-bg/30'}`}
      >
        <td className="py-3 px-4">
          <span className={r.kind === 'discharge' ? 'pill-green' : 'pill inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'}>
            {r.kind === 'discharge' ? '💧 Discharge' : '🧪 Quality'}
          </span>
        </td>
        <td className="py-3 px-4">
          <div className="font-medium">{r.spring_name}</div>
          <div className="text-xs text-chirag-muted">{r.spring_code}</div>
        </td>
        <td className="py-3 px-4">
          <div>{r.krp_name || '—'}</div>
          {r.krp_phone && <div className="text-xs text-chirag-muted">{r.krp_phone}</div>}
        </td>
        <td className="py-3 px-4 whitespace-nowrap text-chirag-muted">{fmtDate(r.recorded_at)}</td>
        <td className="py-3 px-4">
          {r.kind === 'discharge' ? (
            <span className="font-semibold text-green-700">{fmtNum(r.discharge_lpm)} <span className="text-xs font-normal text-chirag-muted">LPM</span></span>
          ) : (
            <div className="flex gap-3 text-xs">
              <span>pH: <b>{fmtNum(r.ph)}</b></span>
              <span>TDS: <b>{fmtNum(r.tds, 0)}</b></span>
            </div>
          )}
        </td>
        <td className="py-3 px-4 text-center">
          {r.anomaly && <span className="inline-block w-2.5 h-2.5 rounded-full bg-chirag-alert animate-pulse" title="Anomaly detected" />}
        </td>
        <td className="py-3 px-4 text-center">
          {r.photo_url && <span title="Has photo">📷</span>}
        </td>
        <td className="py-3 px-4 text-chirag-muted text-xs">
          {expanded ? '▲' : '▼'}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-chirag-bg/60">
          <td colSpan={8} className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <DetailField label="Village" value={r.village_name} />
              <DetailField label="Block" value={r.block} />
              <DetailField label="District" value={r.district} />
              <DetailField label="Recorded At" value={fmtDateTime(r.recorded_at)} />
              <DetailField label="Latitude" value={r.lat?.toString()} />
              <DetailField label="Longitude" value={r.lon?.toString()} />
              {r.kind === 'discharge' && (
                <>
                  <DetailField label="Discharge (LPM)" value={fmtNum(r.discharge_lpm)} />
                  <DetailField label="Method" value={r.method} />
                  <DetailField label="Weather" value={r.weather} />
                </>
              )}
              {r.kind === 'quality' && (
                <>
                  <DetailField label="pH" value={fmtNum(r.ph)} />
                  <DetailField label="TDS (mg/L)" value={fmtNum(r.tds, 0)} />
                  <DetailField label="Turbidity (NTU)" value={fmtNum(r.turbidity)} />
                  <DetailField label="Hardness (mg/L)" value={fmtNum(r.hardness)} />
                  <DetailField label="Alkalinity (mg/L)" value={fmtNum(r.alkalinity)} />
                  <DetailField label="Chloride (mg/L)" value={fmtNum(r.chloride)} />
                  <DetailField label="Iron (mg/L)" value={fmtNum(r.iron, 2)} />
                  <DetailField label="Fecal Coliform" value={fmtNum(r.fecal_coliform, 0)} />
                </>
              )}
              <DetailField label="Synced" value={fmtDateTime(r.synced_at)} />
              <DetailField label="Anomaly" value={r.anomaly ? '⚠️ Yes' : 'No'} />
            </div>
            {r.photo_url && (
              <div className="mt-3">
                <label className="text-xs font-medium text-chirag-muted block mb-1">Photo</label>
                <img src={r.photo_url} alt="Reading photo" className="rounded-lg border border-chirag-border max-h-48 object-cover" />
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-chirag-muted">{label}</div>
      <div className="font-medium">{value || '—'}</div>
    </div>
  );
}
