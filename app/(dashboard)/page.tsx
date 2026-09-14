'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store/appStore'
import { pullFromSupabase } from '@/lib/supabase/sync'
import { formatRupiah, formatDate } from '@/lib/utils'
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag } from 'lucide-react'

export default function DashboardPage() {
  const currentStore = useAppStore((s) => s.currentStore)

  useEffect(() => {
    if (currentStore?.id) pullFromSupabase(currentStore.id)
  }, [currentStore?.id])

  const today = formatDate(new Date(), 'long')

  return (
    <div className="page">
      {/* Greeting */}
      <div className="greeting-card">
        <div>
          <p className="greeting-sub">Selamat datang 👋</p>
          <h1 className="greeting-name">{currentStore?.name ?? 'Toko'}</h1>
          <p className="greeting-date">{today}</p>
        </div>
        <div className="greeting-icon">🍽️</div>
      </div>

      {/* KPI Cards */}
      <p className="section-title">Hari Ini</p>
      <div className="kpi-grid">
        <KpiCard
          label="Pemasukan"
          value={formatRupiah(0)}
          icon={<TrendingUp size={18} />}
          color="success"
        />
        <KpiCard
          label="Pengeluaran"
          value={formatRupiah(0)}
          icon={<TrendingDown size={18} />}
          color="danger"
        />
        <KpiCard
          label="Laba Bersih"
          value={formatRupiah(0)}
          icon={<DollarSign size={18} />}
          color="accent"
        />
        <KpiCard
          label="Transaksi"
          value="0"
          icon={<ShoppingBag size={18} />}
          color="info"
        />
      </div>

      {/* Empty state */}
      <div className="empty-state">
        <div className="empty-icon">📊</div>
        <h3 className="empty-title">Belum ada transaksi hari ini</h3>
        <p className="empty-desc">Tap tombol + di bawah untuk mulai catat via Kasir</p>
      </div>

      <style jsx>{`
        .page {
          max-width: 640px;
          margin: 0 auto;
          padding: 20px 16px 90px;
        }
        .greeting-card {
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
          border-radius: 20px;
          padding: 24px;
          color: white;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          box-shadow: 0 8px 24px rgba(217,43,43,0.30);
        }
        .greeting-sub { font-size: 13px; opacity: 0.85; margin: 0 0 4px; }
        .greeting-name { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
        .greeting-date { font-size: 12px; opacity: 0.7; margin: 0; }
        .greeting-icon { font-size: 48px; opacity: 0.9; }

        .section-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          margin: 0 0 12px;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 28px;
        }
        .empty-state {
          text-align: center;
          padding: 40px 20px;
          background: var(--bg-surface);
          border-radius: 20px;
          border: 1px dashed var(--border-strong);
        }
        .empty-icon { font-size: 48px; margin-bottom: 12px; }
        .empty-title { font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0 0 8px; }
        .empty-desc { font-size: 13px; color: var(--text-muted); margin: 0; }
      `}</style>
    </div>
  )
}

// KPI Card component
function KpiCard({
  label, value, icon, color
}: {
  label: string
  value: string
  icon: React.ReactNode
  color: 'success' | 'danger' | 'accent' | 'info'
}) {
  const colorMap = {
    success: { bg: 'var(--success-bg)', text: 'var(--success)' },
    danger:  { bg: 'var(--danger-bg)',  text: 'var(--danger)'  },
    accent:  { bg: 'var(--accent-subtle)', text: 'var(--accent)' },
    info:    { bg: '#DBEAFE', text: '#2563EB' },
  }
  const c = colorMap[color]

  return (
    <div className="kpi-card">
      <div className="kpi-icon-wrap" style={{ background: c.bg, color: c.text }}>
        {icon}
      </div>
      <p className="kpi-value font-number">{value}</p>
      <p className="kpi-label">{label}</p>

      <style jsx>{`
        .kpi-card {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-shadow: var(--shadow-sm);
        }
        .kpi-icon-wrap {
          width: 36px; height: 36px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
        }
        .kpi-value {
          font-size: 18px;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0;
        }
        .kpi-label {
          font-size: 12px;
          color: var(--text-muted);
          margin: 0;
          font-weight: 500;
        }
      `}</style>
    </div>
  )
}
