'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell,
} from 'recharts'
import { useCompareData, useTrendData, getCurrentMonth, getPrevMonth } from '@/hooks/useMultiMonthData'
import { useToast } from '@/components/shared/Toast'
import { formatRupiah } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type ChartMode = 'bulanan' | 'compare' | 'trend'

const LS_MODE_KEY   = 'dashboard_chart_mode'
const LS_LINES_KEY  = 'dashboard_trend_lines'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLast12Months(): { value: string; label: string }[] {
  const result = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    result.push({ value, label })
  }
  return result
}

function deltaLabel(val: number, compareLabel: string): { text: string; color: string } {
  if (val === 0) return { text: `Sama dengan ${compareLabel}`, color: 'var(--text-muted)' }
  const sign  = val > 0 ? '↑' : '↓'
  const color = val > 0 ? '#16A34A' : '#DC2626'
  return { text: `${sign} ${formatRupiah(Math.abs(val), true)} dibanding ${compareLabel}`, color }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonChart() {
  return (
    <div style={{ height: 200 }} className="animate-pulse">
      <div style={{
        width: '100%', height: '100%',
        background: 'var(--border)',
        borderRadius: 8,
        opacity: 0.4,
      }} />
    </div>
  )
}

// ─── Mode: Compare 2 Bulan ────────────────────────────────────────────────────

function CompareView() {
  const months = getLast12Months()
  const now    = getCurrentMonth()
  const prev   = getPrevMonth(now)

  const [monthA, setMonthA] = useState(now)
  const [monthB, setMonthB] = useState(prev)
  const { data, loading, error } = useCompareData(monthA, monthB)
  const { toast } = useToast()

  useEffect(() => { if (error) toast(error, 'error') }, [error, toast])

  const chartData = data ? [
    {
      name: 'Omzet',
      A: data.monthA.omzet,
      B: data.monthB.omzet,
    },
    {
      name: 'Pengeluaran',
      A: data.monthA.pengeluaran,
      B: data.monthB.pengeluaran,
    },
    {
      name: 'Laba Bersih',
      A: data.monthA.laba,
      B: data.monthB.laba,
    },
  ] : []

  const labelA = months.find((m) => m.value === monthA)?.label ?? monthA
  const labelB = months.find((m) => m.value === monthB)?.label ?? monthB

  // Warna per grup
  const GROUP_COLORS = {
    Omzet:       { A: '#3B82F6', B: '#93C5FD' },
    Pengeluaran: { A: '#EF4444', B: '#FCA5A5' },
    'Laba Bersih': { A: '#22C55E', B: '#86EFAC' },
  }

  return (
    <div>
      {/* 2 Dropdown */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#3B82F6', flexShrink: 0 }} />
          <select
            value={monthA}
            onChange={(e) => setMonthA(e.target.value)}
            style={selectStyle}
          >
            {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#93C5FD', flexShrink: 0 }} />
          <select
            value={monthB}
            onChange={(e) => setMonthB(e.target.value)}
            style={selectStyle}
          >
            {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {/* Chart */}
      {loading ? <SkeletonChart /> : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={4}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              hide
              tickFormatter={(v) => formatRupiah(v as number, true)}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}
              formatter={(v: unknown, name: string) => [
                formatRupiah(v as number),
                name === 'A' ? labelA : labelB,
              ]}
            />
            {/* Bar A */}
            <Bar dataKey="A" radius={[5, 5, 0, 0]} maxBarSize={40}>
              {chartData.map((entry) => (
                <Cell
                  key={`A-${entry.name}`}
                  fill={GROUP_COLORS[entry.name as keyof typeof GROUP_COLORS]?.A ?? '#3B82F6'}
                />
              ))}
            </Bar>
            {/* Bar B (semi-transparan) */}
            <Bar dataKey="B" radius={[5, 5, 0, 0]} maxBarSize={40} opacity={0.5}>
              {chartData.map((entry) => (
                <Cell
                  key={`B-${entry.name}`}
                  fill={GROUP_COLORS[entry.name as keyof typeof GROUP_COLORS]?.B ?? '#93C5FD'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Delta summary */}
      {!loading && data && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8, marginTop: 14,
        }}
          className="delta-3col">
          {(
            [
              { label: 'Omzet',       val: data.delta.omzet },
              { label: 'Pengeluaran', val: data.delta.pengeluaran },
              { label: 'Laba Bersih', val: data.delta.laba },
            ] as const
          ).map((d) => {
            const dl = deltaLabel(d.val, labelB)
            return (
              <div key={d.label} style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderRadius: 10, padding: '10px 12px',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{d.label}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: dl.color }}>{dl.text}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Mode: Trend 6 Bulan ─────────────────────────────────────────────────────

function TrendView() {
  const { data, loading, error } = useTrendData()
  const { toast } = useToast()

  useEffect(() => { if (error) toast(error, 'error') }, [error, toast])

  // Toggle show/hide garis — persist ke localStorage
  const [showLines, setShowLines] = useState<{ income: boolean; expense: boolean; profit: boolean }>(() => {
    if (typeof window === 'undefined') return { income: true, expense: true, profit: true }
    try {
      const stored = localStorage.getItem(LS_LINES_KEY)
      return stored ? JSON.parse(stored) : { income: true, expense: true, profit: true }
    } catch {
      return { income: true, expense: true, profit: true }
    }
  })

  function toggleLine(key: 'income' | 'expense' | 'profit') {
    setShowLines((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem(LS_LINES_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const chartData = (data?.months ?? []).map((m) => ({
    label:  m.label,
    omzet:  m.omzet,
    keluar: m.pengeluaran,
    laba:   m.laba,
  }))

  return (
    <div>
      {/* Toggle checkboxes */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        {(
          [
            { key: 'income',  label: 'Pemasukan',   color: '#22C55E' },
            { key: 'expense', label: 'Pengeluaran',  color: '#EF4444' },
            { key: 'profit',  label: 'Laba Bersih',  color: '#3B82F6' },
          ] as const
        ).map((line) => (
          <label
            key={line.key}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
              color: showLines[line.key] ? line.color : 'var(--text-muted)',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={showLines[line.key]}
              onChange={() => toggleLine(line.key)}
              style={{ accentColor: line.color, width: 14, height: 14, cursor: 'pointer' }}
            />
            {line.label}
          </label>
        ))}
      </div>

      {/* Chart */}
      {loading ? <SkeletonChart /> : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              axisLine={false} tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}
              formatter={(v: unknown, name: string) => [
                formatRupiah(v as number),
                name === 'omzet' ? 'Pemasukan' : name === 'keluar' ? 'Pengeluaran' : 'Laba Bersih',
              ]}
            />
            {showLines.income && (
              <Line
                type="monotone" dataKey="omzet"
                stroke="#22C55E" strokeWidth={2}
                dot={{ r: 3, fill: '#22C55E', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            )}
            {showLines.expense && (
              <Line
                type="monotone" dataKey="keluar"
                stroke="#EF4444" strokeWidth={2}
                dot={{ r: 3, fill: '#EF4444', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            )}
            {showLines.profit && (
              <Line
                type="monotone" dataKey="laba"
                stroke="#3B82F6" strokeWidth={2}
                dot={{ r: 3, fill: '#3B82F6', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── Shared select style ──────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  outline: 'none',
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MultiMonthChart() {
  const [mode, setMode] = useState<ChartMode>(() => {
    if (typeof window === 'undefined') return 'bulanan'
    try {
      const stored = localStorage.getItem(LS_MODE_KEY)
      return (stored as ChartMode) ?? 'bulanan'
    } catch {
      return 'bulanan'
    }
  })

  function handleModeChange(next: ChartMode) {
    setMode(next)
    try { localStorage.setItem(LS_MODE_KEY, next) } catch {}
  }

  // Sembunyikan komponen ini jika mode Bulanan (chart bulanan tetap existing)
  if (mode === 'bulanan') {
    return (
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 20,
        marginBottom: 16,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16, flexWrap: 'wrap', gap: 8,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
              Perbandingan & Tren
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Analisis multi-bulan
            </div>
          </div>
          <ModeToggle mode={mode} onChange={handleModeChange} />
        </div>
        <div style={{
          height: 100, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', fontSize: 13, textAlign: 'center',
        }}>
          Pilih mode <strong style={{ margin: '0 4px' }}>Compare</strong> atau <strong style={{ margin: '0 4px' }}>Tren 6 Bulan</strong> untuk memulai.
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 20,
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 16, flexWrap: 'wrap', gap: 8,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
            {mode === 'compare' ? '📊 Compare 2 Bulan' : '📈 Tren 6 Bulan'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {mode === 'compare'
              ? 'Bandingkan omzet, pengeluaran & laba'
              : 'Perkembangan kinerja 6 bulan terakhir'
            }
          </div>
        </div>
        <ModeToggle mode={mode} onChange={handleModeChange} />
      </div>

      {mode === 'compare' && <CompareView />}
      {mode === 'trend'   && <TrendView />}

      <style>{`
        @media (max-width: 600px) {
          .delta-3col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

// ─── Toggle UI ────────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: ChartMode; onChange: (m: ChartMode) => void }) {
  const options: { value: ChartMode; label: string }[] = [
    { value: 'bulanan', label: 'Bulanan' },
    { value: 'compare', label: 'Compare 2 Bulan' },
    { value: 'trend',   label: 'Trend 6 Bulan' },
  ]

  return (
    <div style={{
      display: 'inline-flex',
      background: 'var(--bg-base)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: 3,
      gap: 2,
      flexShrink: 0,
    }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '5px 10px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600,
            transition: 'background 0.15s, color 0.15s',
            background: mode === opt.value ? '#D92B2B' : 'transparent',
            color:      mode === opt.value ? 'white'   : 'var(--text-muted)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
