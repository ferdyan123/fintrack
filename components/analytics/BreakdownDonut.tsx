'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { BreakdownData } from '@/hooks/useAnalytics'
import { formatRupiah } from '@/lib/utils'

interface Props {
  data: BreakdownData | null
  loading: boolean
}

const COLORS = ['#D92B2B', '#FBBF24']

function SkeletonDonut() {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 20,
    }}
      className="animate-pulse">
      <div style={{ width: '50%', height: 14, borderRadius: 4, background: 'var(--border)', marginBottom: 6 }} />
      <div style={{ width: '70%', height: 11, borderRadius: 4, background: 'var(--border)', marginBottom: 20 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ width: '80%', height: 40, borderRadius: 8, background: 'var(--border)' }} />
          <div style={{ width: '80%', height: 40, borderRadius: 8, background: 'var(--border)' }} />
        </div>
      </div>
    </div>
  )
}

export function BreakdownDonut({ data, loading }: Props) {
  if (loading) return <SkeletonDonut />

  const isEmpty = !data || (data.kasir_total === 0 && data.catering_total === 0)

  const chartData = [
    { name: '🛒 Kasir',   value: data?.kasir_total    ?? 0, pct: data?.kasir_pct    ?? 0 },
    { name: '🍱 Catering', value: data?.catering_total ?? 0, pct: data?.catering_pct ?? 0 },
  ]

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 20,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
        Sumber Penjualan
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        Kasir vs Catering bulan ini
      </div>

      {isEmpty ? (
        <div style={{
          height: 140, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', fontSize: 13, textAlign: 'center',
        }}>
          Belum ada data penjualan
        </div>
      ) : (
        <>
          {/* Chart + legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ flexShrink: 0 }}>
              <ResponsiveContainer width={120} height={140}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    cx={55} cy={65}
                    innerRadius={34} outerRadius={54}
                    paddingAngle={2}
                    startAngle={90} endAngle={450}
                  >
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--border)' }}
                    formatter={(v: unknown) => [formatRupiah(v as number), 'Total']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chartData.map((item, i) => (
                <div key={item.name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{
                      width: 10, height: 10,
                      borderRadius: 3,
                      background: COLORS[i % COLORS.length],
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {item.name}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {item.pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 2 kartu total di bawah chart */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
            {chartData.map((item, i) => (
              <div key={item.name} style={{
                background: 'var(--bg-base)',
                border: `1px solid ${COLORS[i % COLORS.length]}30`,
                borderRadius: 10,
                padding: '10px 12px',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                  {item.name}
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  color: 'var(--text-primary)',
                  fontFamily: 'Nunito, sans-serif',
                }}>
                  {formatRupiah(item.value, true)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
