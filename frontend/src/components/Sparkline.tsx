'use client';

import { ResponsiveContainer, AreaChart, Area } from 'recharts';

interface Props {
  data: number[];
  color?: string; // hex
  height?: number;
}

export default function Sparkline({ data, color = '#3b82f6', height = 32 }: Props) {
  if (!data || data.length < 2) return null;
  const chartData = data.map((value, i) => ({ i, value }));
  const id = `sl-${color.replace('#', '')}-${data.length}`;

  return (
    <div style={{ height, width: '100%' }}>
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${id})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
