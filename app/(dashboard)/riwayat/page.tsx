'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store/appStore'
import { formatRupiah, formatDate } from '@/lib/utils'
import { TrendingUp, TrendingDown, Search, Filter } from 'lucide-react'
import type { Transaction } from '@/types'

export default function RiwayatPage() {
  const currentStore = useAppStore((s) => s.currentStore)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all'|'income'|'expense'>('all')

  useEffect(() => {
    if (!currentStore) return
    const load = async () => {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('store_id', currentStore.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200)
      setTransactions((data as Transaction[]) ?? [])
      setLoading(false)
    }
    load()
  }, [currentStore])

  const filtered = transactions.filter((t) => {
    const matchSearch = !search || t.product_name?.toLowerCase().includes(search.toLowerCase())
      || t.category.toLowerCase().includes(search.toLowerCase())
      || t.note?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || t.type === filter
    return matchSearch && matchFilter
  })

  const S = {
    page: { maxWidth: 640, margin: '0 auto', padding: '20px 16px 100px' } as React.CSSProperties,
  }

  return (
    <div style={S.page}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>
        Riwayat Transaksi
      </h1>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={15} style={{ position: 'absolute', left: 14, top: '50%',
          transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input className="input" placeholder="Cari produk, kategori..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: 38 }} />
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['all','income','expense'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '7px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', border: 'none',
            background: filter === f ? 'var(--accent)' : 'var(--bg-elevated)',
            color: filter === f ? 'white' : 'var(--text-secondary)',
          }}>
            {f === 'all' ? 'Semua' : f === 'income' ? 'Pemasukan' : 'Pengeluaran'}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          Memuat...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px',
          background: 'var(--bg-surface)', borderRadius: 16, border: '1px dashed var(--border-strong)' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Tidak ada transaksi ditemukan</p>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          {filtered.map((t, i) => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
              borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: t.type === 'income' ? 'var(--success-bg)' : 'var(--danger-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {t.type === 'income'
                  ? <TrendingUp size={16} color="var(--success)" />
                  : <TrendingDown size={16} color="var(--danger)" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 14,
                  color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.product_name ?? t.category}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                  {formatDate(t.date)} · {t.category}
                  {t.qty && t.qty > 1 ? ` · ${t.qty}×` : ''}
                  {t.source === 'catering' ? ' · 🍱 Catering' : ''}
                </p>
              </div>
              <p style={{
                margin: 0, fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 15,
                color: t.type === 'income' ? 'var(--success)' : 'var(--danger)',
                flexShrink: 0,
              }}>
                {t.type === 'income' ? '+' : '-'}{formatRupiah(t.amount)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
