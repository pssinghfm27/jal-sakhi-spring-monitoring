// SPDX-License-Identifier: MIT
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BIS, PARAM_LABEL, STATUS_COLOR, classify } from '../lib/bis';
import { fmtDate } from '../lib/format';

interface Props {
  param: string;
  // Each datum: { recorded_at, value }
  data: Array<{ recorded_at: string; value: number | null }>;
}

export function BisLineChart({ param, data }: Props) {
  const rule = BIS[param];
  const label = PARAM_LABEL[param] ?? param;
  const points = data
    .filter((d) => d.value !== null && Number.isFinite(d.value as number))
    .map((d) => ({ t: new Date(d.recorded_at).getTime(), v: d.value as number }));

  if (!points.length) {
    return (
      <div className="card">
        <div className="font-medium text-sm">{label}{rule.unit ? ` (${rule.unit})` : ''}</div>
        <div className="text-chirag-muted text-xs h-32 flex items-center justify-center">no data</div>
      </div>
    );
  }

  const latest = points[points.length - 1].v;
  const cls = classify(param, latest);

  // Y-axis padding so the BIS reference lines stay visible even for tight ranges.
  const minV = Math.min(...points.map((p) => p.v), rule.acceptable[0]);
  const maxV = Math.max(...points.map((p) => p.v), rule.permissible[1] || rule.acceptable[1]);
  const pad = (maxV - minV) * 0.1 || 0.5;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium text-sm">{label}{rule.unit ? ` (${rule.unit})` : ''}</div>
        <div className="text-xs" style={{ color: STATUS_COLOR[cls] }}>
          latest {latest.toFixed(2)}
        </div>
      </div>
      <div style={{ width: '100%', height: 160 }}>
        <ResponsiveContainer>
          <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="t"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(t) => fmtDate(new Date(t).toISOString())}
              tick={{ fontSize: 10 }}
              stroke="#6B7280"
            />
            <YAxis
              domain={[minV - pad, maxV + pad]}
              tick={{ fontSize: 10 }}
              stroke="#6B7280"
              width={40}
            />
            <Tooltip
              labelFormatter={(t) => fmtDate(new Date(t as number).toISOString())}
              formatter={(v) => [Number(v).toFixed(2), label]}
              contentStyle={{ fontSize: 12 }}
            />
            {/* Acceptable band */}
            <ReferenceArea
              y1={rule.acceptable[0]} y2={rule.acceptable[1]}
              fill={STATUS_COLOR.green} fillOpacity={0.08}
              ifOverflow="extendDomain"
            />
            <ReferenceLine y={rule.acceptable[1]} stroke={STATUS_COLOR.green} strokeDasharray="4 4" />
            {rule.permissible[1] !== rule.acceptable[1] && (
              <ReferenceLine y={rule.permissible[1]} stroke={STATUS_COLOR.amber} strokeDasharray="4 4" />
            )}
            <Line
              type="monotone" dataKey="v"
              stroke="#0277BD" strokeWidth={2}
              dot={{ r: 2 }} activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
