// SPDX-License-Identifier: MIT
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { MapMarker, Status, DashboardSummary } from '../api/types';
import { STATUS_COLOR } from '../lib/bis';
import { StatusBadge } from '../components/StatusBadge';
import { fmtDate } from '../lib/format';

// Uttarakhand bounding box (rough): SW (28.43, 77.57) → NE (31.46, 81.04)
const UK_CENTER: [number, number] = [29.97, 79.10];
const UK_BOUNDS: [[number, number], [number, number]] = [[28.43, 77.57], [31.46, 81.04]];

export function MapView() {
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    Promise.all([api.map(), api.summary()])
      .then(([m, s]) => { setMarkers(m.items); setSummary(s); })
      .catch((e) => setErr(e.message));
  }, []);

  const filtered = useMemo(
    () => filter === 'all' ? markers : markers.filter((m) => m.status === filter),
    [markers, filter],
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Spring map</h1>
          <p className="text-sm text-chirag-muted">Uttarakhand springshed overview</p>
        </div>
        {summary && (
          <div className="flex gap-2 text-sm">
            <StatCard label="Springs" value={summary.counts.springs} />
            <StatCard label="KRPs" value={summary.counts.krps} />
            <StatCard label="30-day readings" value={summary.counts.discharge_30d + summary.counts.quality_30d} />
          </div>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        {(['all', 'green', 'amber', 'red', 'unknown'] as const).map((s) => {
          const count = s === 'all' ? markers.length : markers.filter((m) => m.status === s).length;
          const active = filter === s;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={
                'px-3 py-1.5 rounded-md text-sm border ' +
                (active ? 'bg-chirag-primary text-white border-chirag-primary' : 'bg-white border-chirag-border')
              }
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                style={{ backgroundColor: s === 'all' ? '#1B1B1B' : STATUS_COLOR[s as Status] }}
              />
              {s} ({count})
            </button>
          );
        })}
      </div>

      {err && <div className="card text-chirag-alert">Failed to load map: {err}</div>}

      <div className="card p-0 overflow-hidden">
        <div style={{ height: '70vh' }}>
          <MapContainer
            center={UK_CENTER}
            zoom={9}
            maxBounds={UK_BOUNDS}
            scrollWheelZoom
          >
            <TileLayer
              attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filtered.map((m) => (
              <CircleMarker
                key={m.id}
                center={[m.lat, m.lon]}
                radius={9}
                pathOptions={{
                  color: STATUS_COLOR[m.status],
                  fillColor: STATUS_COLOR[m.status],
                  fillOpacity: 0.75,
                  weight: 2,
                }}
                eventHandlers={{ click: () => nav(`/spring/${m.id}`) }}
              >
                <Popup>
                  <div className="space-y-1 min-w-[180px]">
                    <div className="font-semibold">{m.name_hi}</div>
                    <div className="text-xs text-gray-600">{m.name_en}</div>
                    <div className="text-xs">{m.village} · {m.block} · {m.district}</div>
                    <div className="mt-2"><StatusBadge status={m.status} /></div>
                    <div className="text-xs text-gray-600">
                      Last test: {fmtDate(m.last_quality_at)}
                      {m.days_since !== null && <> · {m.days_since} d ago</>}
                    </div>
                    <button
                      onClick={() => nav(`/spring/${m.id}`)}
                      className="btn-primary w-full mt-2 !py-1 text-xs"
                    >Open detail →</button>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-chirag-border rounded-md px-3 py-2 min-w-[120px]">
      <div className="text-xs text-chirag-muted">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
