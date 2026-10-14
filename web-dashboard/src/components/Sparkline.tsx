// SPDX-License-Identifier: MIT
import { LineChart, Line, ResponsiveContainer } from 'recharts';

export function Sparkline({ data, color = '#0277BD' }: { data: number[]; color?: string }) {
  if (!data.length) return <div className="text-chirag-muted text-xs">no data</div>;
  const chart = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ width: '100%', height: 40 }}>
      <ResponsiveContainer>
        <LineChart data={chart} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
