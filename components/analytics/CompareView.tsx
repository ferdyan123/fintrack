'use client'

import { useEffect } from 'react'
import { useAnalytics } from '@/hooks/useAnalytics'
import { useToast } from '@/components/shared/Toast'
import { formatRupiah } from '@/lib/utils'
import { AnalyticsSummaryCards } from './AnalyticsSummaryCards'
import { TopProductsCard } from './TopProductsCard'
import { BreakdownDonut } from './BreakdownDonut'
import { SparklineChart } from './SparklineChart'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  monthA: string
  monthB: string
  labelA: string
  labelB: string
}

// ─── Delta helpers ────────────────────────────────────────────────────────────

function Delta({ val, suffix = '' }: { val: number; suffix?: string }) {
  if (val === 0) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Sama</span>
  const up    = val > 0
  const color = up ? '#16A34A' : '#DC2626'
  const arrow = up ? '↑' : '↓'
  return (
    <span style={{ color, fontSize: 12, fontWeight: 700 }}>
      {arrow} {formatRupiah(Math.abs(val), true)}{suffix}
    </span>
  )
}

function DeltaPct({ a, b }: { a: number; b: number }) {
  if (b === 0) return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
  const pct   = ((a - b) / b) * 100
  const up    = pct >= 0
  const color = up ? '#16A34A' : '#DC2626'
  return (
    <span style={{ color, fontSize: 11, fontWeight: 600 }}>
      {up ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

// ─── Skeleton column ──────────────────────────────────────────────────────────

function SkeletonCol() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} className="animate-pulse">
      {[80, 60, 100, 80].map((w, i) => (
        <div key={i} style={{
          height: 14, width: `${w}%`,
          background: 'var(--border)', borderRadius: 6,
        }} />
      ))}
    </div>
  )
}

// ─── Satu kolom rekap ─────────────────────────────────────────────────────────

function RekapColumn({
  month,
  label,
  accent,
}: {
  month: string
  label: string
  accent: string
}) {
  const { data, loading, error } = useAnalytics(month)
  const { toast } = useToast()

  useEffect(() => { if (error) toast(error, 'error') }, [error, toast])

  const totalOmzet   = (data?.top_products ?? []).reduce((s, p) => s + p.total_omzet, 0)
  const totalQty     = (data?.top_products ?? []).reduce((s, p) => s + p.total_qty, 0)

  return (
    <div style={{ flex: 1, minWidth: 0 }}>

      {/* Label bulan */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: accent + '18',
        border: `1px solid ${accent}40`,
        borderRadius: 8, padding: '4px 10px',
        marginBottom: 14,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>{label}</span>
      </div>

      {/* Summary cards mini */}
      {loading ? <SkeletonCol /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <MiniKpi label="Total SKU Aktif"       value={data ? `${data.summary.total_sku} produk` : '—'} />
          <MiniKpi label="Rata-rata Margin"       value={data ? `${data.summary.avg_margin_pct.toFixed(1)}%` : '—'} />
          <MiniKpi label="Hari Terbaik"           value={data?.summary.best_day ?? '—'} sub={data?.summary.best_day_amount ? formatRupiah(data.summary.best_day_amount, true) : undefined} />
          <MiniKpi label="Total Omzet Produk"    value={formatRupiah(totalOmzet, true)} />
          <MiniKpi label="Total Qty Terjual"     value={`${totalQty} item`} />
          <MiniKpi label="Sumber Kasir"          value={data ? `${data.breakdown.kasir_pct}%` : '—'} sub={data ? formatRupiah(data.breakdown.kasir_total, true) : undefined} />
          <MiniKpi label="Sumber Catering"       value={data ? `${data.breakdown.catering_pct}%` : '—'} sub={data ? formatRupiah(data.breakdown.catering_total, true) : undefined} />
        </div>
      )}

      {/* Top 5 produk */}
      <TopProductsCard products={data?.top_products ?? []} loading={loading} compact />

    </div>
  )
}

function MiniKpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: 'var(--bg-base)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '9px 12px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── Delta Panel (tengah) ─────────────────────────────────────────────────────

function DeltaPanel({
  dataA,
  dataB,
  labelA,
  labelB,
}: {
  dataA: ReturnType<typeof useAnalytics>['data']
  dataB: ReturnType<typeof useAnalytics>['data']
  labelA: string
  labelB: string
}) {
  if (!dataA || !dataB) return null

  const omzetA   = dataA.top_products.reduce((s, p) => s + p.total_omzet, 0)
  const omzetB   = dataB.top_products.reduce((s, p) => s + p.total_omzet, 0)
  const qtyA     = dataA.top_products.reduce((s, p) => s + p.total_qty, 0)
  const qtyB     = dataB.top_products.reduce((s, p) => s + p.total_qty, 0)
  const marginA  = dataA.summary.avg_margin_pct
  const marginB  = dataB.summary.avg_margin_pct
  const kasirA   = dataA.breakdown.kasir_total
  const kasirB   = dataB.breakdown.kasir_total
  const cateringA = dataA.breakdown.catering_total
  const cateringB = dataB.breakdown.catering_total

  // Produk yang naik/turun antara 2 bulan
  const mapA: Record<string, number> = {}
  const mapB: Record<string, number> = {}
  dataA.top_products.forEach((p) => { mapA[p.product_name] = p.total_omzet })
  dataB.top_products.forEach((p) => { mapB[p.product_name] = p.total_omzet })

  const allNames = Array.from(new Set([...Object.keys(mapA), ...Object.keys(mapB)]))
  const productDeltas = allNames
    .map((name) => ({
      name,
      delta: (mapA[name] ?? 0) - (mapB[name] ?? 0),
      a: mapA[name] ?? 0,
      b: mapB[name] ?? 0,
    }))
    .filter((p) => p.a > 0 || p.b > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5)

  return (
    <div style={{
      width: 200, flexShrink: 0,
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '0 4px',
    }}
      className="delta-panel"
    >
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        marginBottom: 4, textAlign: 'center',
      }}>
        Delta
      </div>

      {/* Metrik utama */}
      {[
        { label: 'Omzet',         a: omzetA,    b: omzetB    },
        { label: 'Qty Terjual',   a: qtyA,      b: qtyB,     isQty: true },
        { label: 'Avg Margin',    a: marginA,   b: marginB,  isPct: true },
        { label: 'Kasir',         a: kasirA,    b: kasirB    },
        { label: 'Catering',      a: cateringA, b: cateringB },
      ].map((m) => (
        <div key={m.label} style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 10, padding: '8px 10px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{m.label}</div>
          {'isPct' in m && m.isPct ? (
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: m.a >= m.b ? '#16A34A' : '#DC2626',
            }}>
              {m.a >= m.b ? '↑' : '↓'} {Math.abs(m.a - m.b).toFixed(1)}%
            </div>
          ) : 'isQty' in m && m.isQty ? (
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: m.a >= m.b ? '#16A34A' : '#DC2626',
            }}>
              {m.a >= m.b ? '↑' : '↓'} {Math.abs(m.a - m.b)} item
            </div>
          ) : (
            <Delta val={m.a - m.b} />
          )}
          <DeltaPct a={m.a} b={m.b} />
        </div>
      ))}

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

      {/* Pergerakan produk */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 2 }}>
        Pergerakan Produk
      </div>
      {productDeltas.map((p) => (
        <div key={p.name} style={{
          background: 'var(--bg-surface)',
          border: `1px solid ${p.delta > 0 ? '#16A34A' : p.delta < 0 ? '#DC2626' : 'var(--border)'}30`,
          borderRadius: 10, padding: '7px 10px',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginBottom: 3,
          }}>
            {p.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Delta val={p.delta} />
            <DeltaPct a={p.a} b={p.b} />
          </div>
        </div>
      ))}

      {productDeltas.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
          Tidak ada produk untuk dibandingkan
        </div>
      )}
    </div>
  )
}

// ─── Wrapper yang hold kedua data untuk delta ─────────────────────────────────

function CompareDeltaWrapper({ monthA, monthB, labelA, labelB }: Props) {
  const resultA = useAnalytics(monthA)
  const resultB = useAnalytics(monthB)

  return (
    <div
      style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}
      className="compare-layout"
    >
      <RekapColumn month={monthA} label={labelA} accent="#3B82F6" />
      <DeltaPanel dataA={resultA.data} dataB={resultB.data} labelA={labelA} labelB={labelB} />
      <RekapColumn month={monthB} label={labelB} accent="#F59E0B" />
    </div>
  )
}

// ─── Export utama ─────────────────────────────────────────────────────────────

export function CompareView({ monthA, monthB, labelA, labelB }: Props) {
  return (
    <>
      <CompareDeltaWrapper
        monthA={monthA} monthB={monthB}
        labelA={labelA} labelB={labelB}
      />
      <style>{`
        @media (max-width: 900px) {
          .compare-layout {
            flex-direction: column !important;
          }
          .delta-panel {
            width: 100% !important;
            flex-direction: row !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
          }
          .delta-panel > div {
            flex: 1 !important;
            min-width: 140px !important;
          }
        }
      `}</style>
    </>
  )
}