'use client'

import type { SummaryData } from '@/hooks/useAnalytics'
import { formatRupiah } from '@/lib/utils'

interface Props {
  data: SummaryData | null
  loading: boolean
}

function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 16,
    }}>
      <div className="animate-pulse">
        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--border)', marginBottom: 12 }} />
        <div style={{ width: '60%', height: 20, borderRadius: 6, background: 'var(--border)', marginBottom: 8 }} />
        <div style={{ width: '80%', height: 12, borderRadius: 4, background: 'var(--border)', marginBottom: 6 }} />
        <div style={{ width: '40%', height: 12, borderRadius: 4, background: 'var(--border)' }} />
      </div>
    </div>
  )
}

interface KpiCardProps {
  icon: string
  bg: string
  label: string
  value: string
  sub: string
  subColor: string
}

function KpiCard({ icon, bg, label, value, sub, subColor }: KpiCardProps) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 16,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9,
        background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, marginBottom: 12,
      }}>
        {icon}
      </div>
      <div style={{
        fontSize: 18, fontWeight: 700,
        color: 'var(--text-primary)',
        fontFamily: 'Nunito, sans-serif',
        letterSpacing: '-0.3px',
        marginBottom: 2,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: subColor }}>{sub}</div>
    </div>
  )
}

export function AnalyticsSummaryCards({ data, loading }: Props) {
  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}
        className="summary-3col">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  const avgMarginStr = data ? `${data.avg_margin_pct.toFixed(1)}% rata-rata` : '—'
  const bestDayStr   = data?.best_day
    ? `${formatRupiah(data.best_day_amount, true)} omzet`
    : 'Belum ada data'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}
      className="summary-3col">
      <KpiCard
        icon="📦"
        bg="#DBEAFE"
        label="Total SKU Aktif"
        value={data ? `${data.total_sku} produk` : '—'}
        sub="Produk terdaftar di toko"
        subColor="#2563EB"
      />
      <KpiCard
        icon="📊"
        bg="#DCFCE7"
        label="Rata-rata Margin Toko"
        value={data ? `${data.avg_margin_pct.toFixed(1)}%` : '—'}
        sub={avgMarginStr}
        subColor="#16A34A"
      />
      <KpiCard
        icon="🏆"
        bg="#FEF3C7"
        label="Hari Terbaik Bulan Ini"
        value={data?.best_day ?? '—'}
        sub={bestDayStr}
        subColor="#D97706"
      />
    </div>
  )
}
