'use client'

import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface Props {
  data: number[] // 7 nilai qty per hari
}

export function SparklineChart({ data }: Props) {
  const hasData   = data.some((v) => v > 0)
  const isUp      = data[data.length - 1] >= data[0]
  const lineColor = isUp ? '#16A34A' : '#DC2626'

  const chartData = data.map((qty, i) => ({ i, qty }))

  if (!hasData) {
    return (
      <div style={{
        width: 120, height: 40,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: '100%', height: 1,
          background: 'var(--border)',
          borderRadius: 1,
        }} />
      </div>
    )
  }

  return (
    <div style={{ width: 120, height: 40, flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <Line
            type="monotone"
            dataKey="qty"
            stroke={lineColor}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
