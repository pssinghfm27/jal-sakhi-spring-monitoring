// SPDX-License-Identifier: MIT
import type { SpringTrends } from '../api/types';

interface Props { health: SpringTrends['health'] }

export function HealthScoreGauge({ health }: Props) {
  const v = health.total;
  const color = v >= 75 ? '#2E7D32' : v >= 50 ? '#F9A825' : '#C62828';
  const r = 56, c = 2 * Math.PI * r;
  const offset = c - (v / 100) * c;
  return (
    <div className="card">
      <div className="text-sm text-chirag-muted mb-1">Health score</div>
      <div className="flex items-center gap-4">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={r} stroke="#E5E7EB" strokeWidth="12" fill="none" />
          <circle
            cx="70" cy="70" r={r}
            stroke={color} strokeWidth="12" fill="none"
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 70 70)"
          />
          <text x="70" y="76" textAnchor="middle" fontSize="28" fontWeight="600" fill="#1B1B1B">{v}</text>
        </svg>
        <div className="space-y-1 text-sm">
          <Bar label="Discharge stability" v={health.components.discharge_stability} w={0.3} />
          <Bar label="BIS compliance"      v={health.components.bis_compliance}      w={0.5} />
          <Bar label="Sampling regularity" v={health.components.sampling_regularity} w={0.2} />
        </div>
      </div>
    </div>
  );
}

function Bar({ label, v, w }: { label: string; v: number; w: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span>{label} <span className="text-chirag-muted">({Math.round(w * 100)}%)</span></span>
        <span className="font-medium">{v}</span>
      </div>
      <div className="w-44 h-1.5 bg-gray-100 rounded">
        <div className="h-1.5 rounded bg-chirag-water" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
