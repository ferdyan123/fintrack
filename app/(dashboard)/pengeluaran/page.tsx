'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingDown, Plus, Filter } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store/appStore'
import { formatRupiah, formatDate, toISODate } from '@/lib/utils'
import { ExpenseModal } from '@/components/shared/ExpenseModal'
import type { Transaction } from '@/types'

// Group transaksi by tanggal
function groupByDate(txs: Transaction[]): { date: string; items: Transaction[] }[] {
  const map = new Map<string, Transaction[]>()
  for (const tx of txs) {
    const key = tx.date
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(tx)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, items }))
}

function isToday(dateStr: string) {
  return dateStr === toISODate()
}

export default function PengeluaranPage() {
  const currentStore      = useAppStore((s) => s.currentStore)
  const expenseCategories = useAppStore((s) => s.expenseCategories)

  const [txs,          setTxs]          = useState<Transaction[]>([])
  const [loading,      setLoading]      = useState(true)
  const [modalOpen,    setModalOpen]    = useState(false)
  const [filterCat,    setFilterCat]    = useState<string>('all')

  const isOffline  = typeof navigator !== 'undefined' && !navigator.onLine
  const isDummy    = currentStore?.id === 'dummy-store-001'
  const skipSupabase = isOffline || isDummy

  const load = useCallback(async () => {
    if (!currentStore) return
    setLoading(true)

    if (skipSupabase) {
      setTxs([])
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('store_id', currentStore.id)
      .eq('type', 'expense')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300)

    setTxs((data as Transaction[]) ?? [])
    setLoading(false)
  }, [currentStore, skipSupabase])

  useEffect(() => { load() }, [load])

  // Tambah tx baru dari modal ke list lokal (tanpa refetch)
  function handleSaved(tx: Transaction) {
    setTxs((prev) => [tx, ...prev])
  }

  // Stats
  const today       = toISODate()
  const totalToday  = txs.filter((t) => t.date === today).reduce((s, t) => s + t.amount, 0)
  const totalMonth  = txs.reduce((s, t) => s + t.amount, 0)
  const txCountToday = txs.filter((t) => t.date === today).length

  // Filter by kategori
  const filtered = filterCat === 'all'
    ? txs
    : txs.filter((t) => t.category === filterCat)

  const grouped = groupByDate(filtered)

  // Semua kategori yang pernah dipakai (dari data) + dari store
  const usedCats = Array.from(new Set(txs.map((t) => t.category)))
  const storeCatNames = expenseCategories.map((c) => c.name)
  const allCatNames = Array.from(new Set([...storeCatNames, ...usedCats]))

  const S = {
    page: {
      maxWidth: 680, margin: '0 auto',
      padding: '20px 16px 100px',
    } as React.CSSProperties,

    statsRow: {
      display: 'grid', gridTemplateColumns: '1fr 1fr',
      gap: 12, marginBottom: 20,
    } as React.CSSProperties,

    statCard: (accent?: boolean) => ({
      background: accent ? 'var(--accent)' : 'var(--bg-surface)',
      border: accent ? 'none' : '1px solid var(--border)',
      borderRadius: 16, padding: '16px 18px',
      color: accent ? 'white' : 'var(--text-primary)',
    } as React.CSSProperties),

    addBtn: {
      width: '100%', padding: '14px', borderRadius: 14,
      background: 'var(--accent)', color: 'white',
      border: 'none', fontSize: 15, fontWeight: 700,
      cursor: 'pointer', marginBottom: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      boxShadow: '0 4px 14px rgba(217,43,43,0.25)',
    } as React.CSSProperties,

    filterScroll: {
      display: 'flex', gap: 8, overflowX: 'auto' as const,
      paddingBottom: 4, marginBottom: 18,
      scrollbarWidth: 'none' as const,
    },

    chip: (active: boolean) => ({
      padding: '7px 15px', borderRadius: 99, fontSize: 13, fontWeight: 600,
      cursor: 'pointer', border: 'none', flexShrink: 0, whiteSpace: 'nowrap' as const,
      background: active ? 'var(--accent)' : 'var(--bg-elevated)',
      color: active ? 'white' : 'var(--text-secondary)',
    }),

    dateHeader: {
      fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
      textTransform: 'uppercase' as const, letterSpacing: '0.06em',
      padding: '16px 4px 8px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },

    card: {
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 16, overflow: 'hidden',
      marginBottom: 4,
    },

    row: (last: boolean) => ({
      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
      borderBottom: last ? 'none' : '1px solid var(--border)',
    } as React.CSSProperties),

    iconBox: (color: string) => ({
      width: 38, height: 38, borderRadius: 11, flexShrink: 0,
      background: color + '18',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 18,
    }),
  }

  // Ambil icon & color dari expenseCategories atau default
  function getCatMeta(catName: string) {
    const found = expenseCategories.find((c) => c.name === catName)
    return {
      icon:  found?.icon  ?? '💸',
      color: found?.color ?? '#DC2626',
    }
  }

  return (
    <div style={S.page}>

      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 11,
          background: 'var(--danger-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <TrendingDown size={18} color="var(--danger)" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
            Pengeluaran
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            Catat & pantau semua biaya operasional
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={S.statsRow}>
        {/* Hari ini */}
        <div style={S.statCard(true)}>
          <div style={{ fontSize: 11, opacity: 0.75, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
            Hari Ini
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Nunito, sans-serif', letterSpacing: '-0.5px', marginBottom: 2 }}>
            {formatRupiah(totalToday, true)}
          </div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>
            {txCountToday} pengeluaran
          </div>
        </div>

        {/* Bulan ini */}
        <div style={S.statCard()}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
            Bulan Ini
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Nunito, sans-serif', letterSpacing: '-0.5px', color: 'var(--danger)', marginBottom: 2 }}>
            {formatRupiah(totalMonth, true)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {txs.length} total transaksi
          </div>
        </div>
      </div>

      {/* Add button */}
      <button style={S.addBtn} onClick={() => setModalOpen(true)}>
        <Plus size={18} strokeWidth={2.5} />
        Catat Pengeluaran Baru
      </button>

      {/* Filter kategori */}
      {allCatNames.length > 0 && (
        <div style={S.filterScroll}>
          <button
            style={S.chip(filterCat === 'all')}
            onClick={() => setFilterCat('all')}
          >
            Semua
          </button>
          {allCatNames.map((name) => (
            <button
              key={name}
              style={S.chip(filterCat === name)}
              onClick={() => setFilterCat(filterCat === name ? 'all' : name)}
            >
              {expenseCategories.find((c) => c.name === name)?.icon ?? '📌'} {name}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
          <p style={{ fontSize: 14 }}>Memuat data...</p>
        </div>
      ) : grouped.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: 'var(--bg-surface)', borderRadius: 16,
          border: '1.5px dashed var(--border-strong)',
        }}>
          <div style={{ fontSize: 42, marginBottom: 10 }}>💸</div>
          <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15, margin: '0 0 4px' }}>
            {filterCat === 'all' ? 'Belum ada pengeluaran' : `Tidak ada pengeluaran "${filterCat}"`}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 16px' }}>
            {filterCat === 'all' ? 'Tap tombol di atas untuk mencatat' : 'Coba ganti filter kategori'}
          </p>
          {filterCat === 'all' && (
            <button
              onClick={() => setModalOpen(true)}
              style={{
                background: 'var(--accent)', color: 'white',
                border: 'none', borderRadius: 10, padding: '10px 20px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              + Catat Sekarang
            </button>
          )}
        </div>
      ) : (
        grouped.map(({ date, items }) => {
          const dayTotal = items.reduce((s, t) => s + t.amount, 0)
          return (
            <div key={date}>
              {/* Date header */}
              <div style={S.dateHeader}>
                <span>
                  {isToday(date) ? '🔴 Hari ini' : formatDate(date, 'long')}
                </span>
                <span style={{ fontFamily: 'Nunito, sans-serif', color: 'var(--danger)', fontSize: 13 }}>
                  -{formatRupiah(dayTotal, true)}
                </span>
              </div>

              {/* Cards */}
              <div style={S.card}>
                {items.map((tx, i) => {
                  const { icon, color } = getCatMeta(tx.category)
                  return (
                    <div key={tx.id} style={S.row(i === items.length - 1)}>
                      <div style={S.iconBox(color)}>
                        {icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: '0 0 2px', fontWeight: 600, fontSize: 14,
                          color: 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {tx.category}
                        </p>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                          {tx.note
                            ? tx.note.length > 36 ? tx.note.slice(0, 36) + '…' : tx.note
                            : new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                          }
                        </p>
                      </div>
                      <p style={{
                        margin: 0, fontFamily: 'Nunito, sans-serif',
                        fontWeight: 800, fontSize: 15,
                        color: 'var(--danger)', flexShrink: 0,
                      }}>
                        -{formatRupiah(tx.amount)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}

      {/* Modal */}
      <ExpenseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  )
}