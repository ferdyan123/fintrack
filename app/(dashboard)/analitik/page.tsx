'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAnalytics } from '@/hooks/useAnalytics'
import { useToast } from '@/components/shared/Toast'
import { AnalyticsSummaryCards } from '@/components/analytics/AnalyticsSummaryCards'
import { TopProductsCard } from '@/components/analytics/TopProductsCard'
import { BreakdownDonut } from '@/components/analytics/BreakdownDonut'
import { CompareView } from '@/components/analytics/CompareView'

// ─── Types ────────────────────────────────────────────────────────────────────

type PageMode = 'rekap' | 'compare'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getPrevMonth(month: string): string {
  const [year, mon] = month.split('-').map(Number)
  const d = new Date(year, mon - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

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

// ─── Toggle UI ────────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: PageMode; onChange: (m: PageMode) => void }) {
  return (
    <div className="mode-toggle" style={{
      display: 'inline-flex',
      background: 'var(--bg-base)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: 3,
      gap: 2,
      flexWrap: 'wrap',
    }}>
      {([
        { value: 'rekap',   label: '📊 Rekap Bulanan' },
        { value: 'compare', label: '⚖️ Bandingkan Bulan' },
      ] as { value: PageMode; label: string }[]).map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: 'nowrap',
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

// ─── Mode: Rekap Bulanan (existing) ──────────────────────────────────────────

function RekapView({
  selectedMonth,
  selectedLabel,
  onMonthChange,
  months,
}: {
  selectedMonth: string
  selectedLabel: string
  onMonthChange: (v: string) => void
  months: { value: string; label: string }[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const { data, loading, error } = useAnalytics(selectedMonth)

  useEffect(() => { if (error) toast(error, 'error') }, [error, toast])

  return (
    <>
      {/* Dropdown bulan */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <select
          value={selectedMonth}
          onChange={(e) => onMonthChange(e.target.value)}
          style={selectStyle}
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <AnalyticsSummaryCards data={data?.summary ?? null} loading={loading} />

      {/* Grid: Top Products + Donut */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}
        className="analytics-2col"
      >
        <div style={{ gridColumn: '1 / 2' }} className="analytics-top">
          <TopProductsCard products={data?.top_products ?? []} loading={loading} />
        </div>
        <div style={{ gridColumn: '2 / 3' }} className="analytics-donut">
          <BreakdownDonut data={data?.breakdown ?? null} loading={loading} />
        </div>
      </div>

      {/* Empty state */}
      {!loading && data && data.top_products.length === 0 && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '48px 24px',
          textAlign: 'center',
        }}>
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: 16 }}>
            <circle cx="40" cy="40" r="38" fill="var(--bg-base)" stroke="var(--border)" strokeWidth="2"/>
            <rect x="22" y="30" width="36" height="24" rx="4" fill="var(--border)" opacity="0.5"/>
            <rect x="28" y="38" width="10" height="10" rx="2" fill="#D92B2B" opacity="0.5"/>
            <rect x="42" y="34" width="10" height="14" rx="2" fill="#FBBF24" opacity="0.5"/>
            <line x1="22" y1="54" x2="58" y2="54" stroke="var(--border)" strokeWidth="2"/>
            <circle cx="40" cy="22" r="5" fill="var(--border)" opacity="0.5"/>
            <line x1="40" y1="27" x2="40" y2="30" stroke="var(--border)" strokeWidth="2"/>
          </svg>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            Belum cukup data.
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, maxWidth: 320, margin: '0 auto 20px' }}>
            Tidak ada transaksi di bulan {selectedLabel}. Mulai catat penjualan untuk melihat analitik produk.
          </div>
          <button
            onClick={() => router.push('/kasir')}
            style={{
              background: '#D92B2B', color: 'white',
              border: 'none', borderRadius: 10,
              padding: '10px 24px', fontSize: 13,
              fontWeight: 700, cursor: 'pointer',
            }}
          >
            Buka Kasir →
          </button>
        </div>
      )}
    </>
  )
}

// ─── Mode: Bandingkan Bulan ───────────────────────────────────────────────────

function BandingkanView({ months }: { months: { value: string; label: string }[] }) {
  const now  = getCurrentMonth()
  const prev = getPrevMonth(now)

  const [monthA, setMonthA] = useState(now)
  const [monthB, setMonthB] = useState(prev)

  const labelA = months.find((m) => m.value === monthA)?.label ?? monthA
  const labelB = months.find((m) => m.value === monthB)?.label ?? monthB

  return (
    <>
      {/* 2 Dropdown bulan */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 20,
        alignItems: 'center', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B82F6', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Bulan A</span>
          <select value={monthA} onChange={(e) => setMonthA(e.target.value)} style={selectStyle}>
            {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>vs</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Bulan B</span>
          <select value={monthB} onChange={(e) => setMonthB(e.target.value)} style={selectStyle}>
            {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {/* Compare 2 kolom */}
      <CompareView
        monthA={monthA}
        monthB={monthB}
        labelA={labelA}
        labelB={labelB}
      />
    </>
  )
}

// ─── Inner content (butuh Suspense karena useSearchParams) ────────────────────

function AnalitikContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [mode, setMode] = useState<PageMode>('rekap')

  const months        = getLast12Months()
  const selectedMonth = searchParams.get('month') ?? getCurrentMonth()
  const selectedLabel = months.find((m) => m.value === selectedMonth)?.label ?? selectedMonth

  function handleMonthChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', value)
    router.push(`/analitik?${params.toString()}`)
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div
        style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 80px' }}
        className="analitik-wrap"
      >

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12, marginBottom: 20, flexWrap: 'wrap',
        }}>
          <div>
            <h1 style={{
              fontSize: 20, fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'DM Sans, sans-serif',
              margin: 0, marginBottom: 4,
            }}>
              📈 Analitik Produk
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              {mode === 'rekap'
                ? `Performa produk terlaris — ${selectedLabel}`
                : 'Bandingkan performa antar bulan secara detail'
              }
            </p>
          </div>

          {/* Toggle mode */}
          <ModeToggle mode={mode} onChange={setMode} />
        </div>

        {/* ── Content berdasarkan mode ── */}
        {mode === 'rekap' && (
          <RekapView
            selectedMonth={selectedMonth}
            selectedLabel={selectedLabel}
            onMonthChange={handleMonthChange}
            months={months}
          />
        )}

        {mode === 'compare' && (
          <BandingkanView months={months} />
        )}

      </div>

      <style>{`
        @media (max-width: 767px) {
          .analitik-wrap { padding: 16px 16px 90px !important; }
          .summary-3col  { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
          .summary-3col > div:nth-child(3) { grid-column: 1 / -1 !important; }
          .analytics-2col { grid-template-columns: 1fr !important; }
          .analytics-top  { grid-column: 1 / 2 !important; }
          .analytics-donut { grid-column: 1 / 2 !important; }
          .mode-toggle { width: 100%; }
          .mode-toggle button { flex: 1 1 0; padding: 6px 8px !important; font-size: 11px !important; }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .summary-3col { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function AnalitikPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '60vh', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ fontSize: 36 }}>⏳</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Memuat analitik...</p>
      </div>
    }>
      <AnalitikContent />
    </Suspense>
  )
}

// ─── Shared style ─────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  padding: '7px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  outline: 'none',
}