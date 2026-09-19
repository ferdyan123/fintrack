'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, ChevronRight, Search, X, TrendingDown, CalendarDays, TrendingUp, Receipt, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store/appStore'
import { formatRupiah, formatDate, toISODate } from '@/lib/utils'
import { ExpenseModal } from '@/components/shared/ExpenseModal'
import type { Transaction } from '@/types'

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

function isToday(dateStr: string) { return dateStr === toISODate() }

function isYesterday(dateStr: string) {
  const y = new Date(); y.setDate(y.getDate() - 1)
  return dateStr === toISODate(y)
}

function getDayLabel(dateStr: string): string {
  if (isToday(dateStr)) return 'Hari Ini'
  if (isYesterday(dateStr)) return 'Kemarin'
  return formatDate(dateStr, 'long')
}

function getMonthRange(offsetMonth = 0) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 + offsetMonth
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export default function PengeluaranPage() {
  const currentStore = useAppStore((s) => s.currentStore)
  const expenseCategories = useAppStore((s) => s.expenseCategories)

  const [txs, setTxs] = useState<Transaction[]>([])
  const [lastMonthTxs, setLastMonthTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [filterCat, setFilterCat] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const isDummy = currentStore?.id === 'dummy-store-001'
  const skipSupabase = isDummy

  const load = useCallback(async () => {
    if (!currentStore) return
    setLoading(true)
    if (skipSupabase) { setTxs([]); setLastMonthTxs([]); setLoading(false); return }

    const supabase = createClient()
    const thisMonth = getMonthRange(0)
    const lastMonth = getMonthRange(-1)

    const { data: thisData } = await supabase
      .from('transactions').select('*')
      .eq('store_id', currentStore.id).eq('type', 'expense')
      .gte('date', thisMonth.start).lte('date', thisMonth.end)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300)

    const { data: lastData } = await supabase
      .from('transactions').select('amount')
      .eq('store_id', currentStore.id).eq('type', 'expense')
      .gte('date', lastMonth.start).lte('date', lastMonth.end)

    setTxs((thisData as Transaction[]) ?? [])
    setLastMonthTxs((lastData as Transaction[]) ?? [])
    setLoading(false)
  }, [currentStore, skipSupabase])

  useEffect(() => { load() }, [load])

  function handleSaved(tx: Transaction) { setTxs((prev) => [tx, ...prev]) }

  const now = new Date()
  const today = toISODate()
  const totalToday = txs.filter((t) => t.date === today).reduce((s, t) => s + t.amount, 0)
  const totalMonth = txs.reduce((s, t) => s + t.amount, 0)
  const txCountToday = txs.filter((t) => t.date === today).length
  const totalLastMonth = lastMonthTxs.reduce((s, t) => s + t.amount, 0)

  const pctChange = totalLastMonth > 0
    ? Math.round(((totalMonth - totalLastMonth) / totalLastMonth) * 100)
    : null

  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const rangeLabel = `1–${lastDayOfMonth} ${now.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}`

  const filtered = txs
    .filter((t) => filterCat === 'all' || t.category === filterCat)
    .filter((t) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return t.category.toLowerCase().includes(q) || (t.note ?? '').toLowerCase().includes(q)
    })

  const grouped = groupByDate(filtered)

  const usedCats = Array.from(new Set(txs.map((t) => t.category)))
  const storeCatNames = expenseCategories.map((c) => c.name)
  const allCatNames = Array.from(new Set([...storeCatNames, ...usedCats]))

  function getCatMeta(catName: string) {
    const found = expenseCategories.find((c) => c.name === catName)
    return { icon: found?.icon ?? '💸', color: found?.color ?? '#DC2626' }
  }

  const PctBadge = ({ white = false }: { white?: boolean }) => {
    if (pctChange === null) return null
    const textColor = white ? 'rgba(255,255,255,0.9)' : (pctChange > 0 ? '#DC2626' : '#16a34a')
    const bg = white ? 'rgba(255,255,255,0.15)' : (pctChange > 0 ? '#FEE2E2' : '#DCFCE7')
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: bg, borderRadius: 99, padding: '4px 10px',
        fontSize: 12, fontWeight: 600, color: textColor,
      }}>
        {pctChange > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {pctChange > 0 ? '+' : ''}{pctChange}% dari bulan lalu
      </span>
    )
  }

  return (
    <>
      <div style={{ background: 'var(--bg-base)', minHeight: '100dvh' }}>

        {/* ═══ DESKTOP (≥768px) ═══ */}
        <div className="pengeluaran-desktop-layout">
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px 56px' }}>

            {/* Title */}
            <div style={{ marginBottom: 28 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'var(--danger-bg)', borderRadius: 12, padding: '7px 14px', marginBottom: 10,
              }}>
                <TrendingDown size={15} color="var(--danger)" />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Pengeluaran
                </span>
              </div>
              <h1 style={{ margin: '0 0 4px', fontSize: 30, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                Catat &amp; Pantau Biaya Operasional
              </h1>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>
                Kelola pengeluaran, jaga keuntungan warung Anda.
              </p>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 28 }}>

              {/* Card total */}
              <div style={{
                background: 'var(--accent)', borderRadius: 20, padding: '24px',
                boxShadow: '0 6px 24px rgba(217,43,43,0.22)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Wallet size={17} color="white" />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Total Pengeluaran
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Bulan Ini</div>
                  </div>
                </div>
                <div style={{ fontSize: 34, fontWeight: 800, color: 'white', letterSpacing: '-1px', marginBottom: 10 }}>
                  {loading ? '—' : formatRupiah(totalMonth)}
                </div>
                <PctBadge white />
              </div>

              {/* Card transaksi */}
              <div style={{
                background: 'var(--bg-surface)', border: '1.5px solid var(--border)',
                borderRadius: 20, padding: '24px', boxShadow: 'var(--shadow-sm)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 9,
                    background: 'var(--danger-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Receipt size={14} color="var(--danger)" />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Transaksi
                  </span>
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-1px', marginBottom: 4 }}>
                  {txs.length}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rangeLabel}</div>
              </div>

              {/* Card hari ini */}
              <div style={{
                background: 'var(--bg-surface)', border: '1.5px solid var(--border)',
                borderRadius: 20, padding: '24px', boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 9,
                    background: 'var(--danger-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CalendarDays size={14} color="var(--danger)" />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Hari Ini
                  </span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--danger)', letterSpacing: '-0.5px', marginBottom: 4 }}>
                  {loading ? '—' : formatRupiah(totalToday)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{txCountToday} transaksi hari ini</div>
              </div>
            </div>

            {/* 2-col: sidebar + tabel */}
            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24, alignItems: 'start' }}>

              {/* Sidebar */}
              <div style={{ position: 'sticky', top: 76 }}>
                <button
                  onClick={() => setModalOpen(true)}
                  style={{
                    width: '100%', padding: '14px',
                    background: 'var(--accent)', color: 'white',
                    border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700,
                    cursor: 'pointer', marginBottom: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 16px rgba(217,43,43,0.28)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(217,43,43,0.36)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(217,43,43,0.28)' }}
                >
                  <Plus size={17} strokeWidth={2.5} />
                  + Tambah Pengeluaran
                </button>

                <div style={{
                  background: 'var(--bg-surface)', border: '1.5px solid var(--border)',
                  borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
                }}>
                  <div style={{
                    padding: '12px 14px', borderBottom: '1px solid var(--border)',
                    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    Filter Kategori
                  </div>
                  <button
                    onClick={() => setFilterCat('all')}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px', border: 'none', cursor: 'pointer',
                      background: filterCat === 'all' ? 'var(--accent-subtle)' : 'transparent',
                      borderBottom: '1px solid var(--border)', textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: filterCat === 'all' ? 'var(--accent)' : 'var(--bg-elevated)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                    }}>📊</div>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: filterCat === 'all' ? 700 : 500, color: filterCat === 'all' ? 'var(--accent)' : 'var(--text-primary)' }}>
                      Semua
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '1px 7px', borderRadius: 99 }}>
                      {txs.length}
                    </span>
                  </button>
                  {allCatNames.map((name, idx) => {
                    const { icon, color } = getCatMeta(name)
                    const count = txs.filter((t) => t.category === name).length
                    const isActive = filterCat === name
                    const isLast = idx === allCatNames.length - 1
                    return (
                      <button
                        key={name}
                        onClick={() => setFilterCat(isActive ? 'all' : name)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          padding: '10px 14px', border: 'none', cursor: 'pointer',
                          background: isActive ? 'var(--accent-subtle)' : 'transparent',
                          borderBottom: isLast ? 'none' : '1px solid var(--border)',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                          background: color + '18',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                        }}>
                          {icon}
                        </div>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}>
                          {name}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '1px 7px', borderRadius: 99 }}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Right: riwayat */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 10,
                      background: 'var(--danger-bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                    }}>📋</div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
                        Riwayat Pengeluaran
                      </h2>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                        {filtered.length} transaksi ditampilkan
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {showSearch && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: 'var(--bg-surface)', border: '1.5px solid var(--accent-border)',
                        borderRadius: 12, padding: '8px 14px', width: 220,
                      }}>
                        <Search size={14} color="var(--text-muted)" />
                        <input
                          autoFocus
                          placeholder="Cari..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: 'var(--text-primary)', flex: 1 }}
                        />
                        {searchQuery && (
                          <button onClick={() => setSearchQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                            <X size={13} color="var(--text-muted)" />
                          </button>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => { setShowSearch((v) => !v); if (showSearch) setSearchQuery('') }}
                      style={{
                        width: 36, height: 36, borderRadius: 10, border: '1.5px solid var(--border)',
                        background: showSearch ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {showSearch ? <X size={14} color="var(--accent)" /> : <Search size={14} color="var(--text-muted)" />}
                    </button>
                  </div>
                </div>

                <DesktopTableView
                  loading={loading}
                  grouped={grouped}
                  filterCat={filterCat}
                  getCatMeta={getCatMeta}
                  onAdd={() => setModalOpen(true)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ═══ MOBILE (<768px) ═══ */}
        <div className="pengeluaran-mobile-layout" style={{ paddingBottom: 100 }}>

          {/* Hero merah */}
          <div style={{ background: 'var(--accent)', padding: '52px 20px 34px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>🏪</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>
                    {currentStore?.name ?? 'Toko'}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>Pengeluaran</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setShowSearch((v) => !v); if (showSearch) setSearchQuery('') }}
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'rgba(255,255,255,0.15)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Search size={16} color="white" />
                </button>
                <button
                  onClick={() => setModalOpen(true)}
                  style={{
                    height: 36, padding: '0 14px',
                    background: 'white', color: 'var(--accent)',
                    border: 'none', borderRadius: 10,
                    fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Catat
                </button>
              </div>
            </div>

            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              Total pengeluaran bulan ini
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, color: 'white', letterSpacing: '-1px', lineHeight: 1, marginBottom: 12 }}>
              {loading ? '—' : formatRupiah(totalMonth)}
            </div>
            <PctBadge white />
          </div>

          {/* Stat cards overlap */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 10, padding: '0 16px',
            marginTop: -18, marginBottom: 20, position: 'relative', zIndex: 1,
          }}>
            {/* Hari ini */}
            <div style={{
              background: 'var(--bg-surface)', borderRadius: 16, padding: '16px 14px',
              boxShadow: '0 2px 14px rgba(0,0,0,0.09)',
              border: '0.5px solid rgba(0,0,0,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'var(--danger-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CalendarDays size={14} color="var(--danger)" />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Hari ini</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger)', letterSpacing: '-0.5px', marginBottom: 4 }}>
                {loading ? '—' : formatRupiah(totalToday)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{txCountToday} transaksi</div>
            </div>

            {/* Total transaksi — rata tengah */}
            <div style={{
              background: 'var(--bg-surface)', borderRadius: 16, padding: '16px 14px',
              boxShadow: '0 2px 14px rgba(0,0,0,0.09)',
              border: '0.5px solid rgba(0,0,0,0.06)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                Transaksi bulan ini
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-1px', lineHeight: 1, marginBottom: 6 }}>
                {txs.length}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rangeLabel}</div>
            </div>
          </div>

          {/* Konten bawah */}
          <div style={{ padding: '0 16px' }}>

            {/* Search bar */}
            {showSearch && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--bg-surface)', border: '1.5px solid var(--accent-border)',
                borderRadius: 14, padding: '11px 16px', marginBottom: 14,
              }}>
                <Search size={15} color="var(--text-muted)" />
                <input
                  autoFocus
                  placeholder="Cari kategori atau catatan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 14, color: 'var(--text-primary)', flex: 1 }}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                    <X size={14} color="var(--text-muted)" />
                  </button>
                )}
              </div>
            )}

            {/* Filter chips */}
            {allCatNames.length > 0 && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 16, scrollbarWidth: 'none' }}>
                <button
                  onClick={() => setFilterCat('all')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 99, cursor: 'pointer', flexShrink: 0,
                    background: filterCat === 'all' ? 'var(--accent)' : 'var(--bg-surface)',
                    color: filterCat === 'all' ? 'white' : 'var(--text-secondary)',
                    fontWeight: 600, fontSize: 13,
                    border: filterCat === 'all' ? 'none' : '1px solid var(--border)',
                  }}
                >Semua</button>
                {allCatNames.map((name) => {
                  const { icon, color } = getCatMeta(name)
                  const isActive = filterCat === name
                  return (
                    <button
                      key={name}
                      onClick={() => setFilterCat(isActive ? 'all' : name)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '7px 14px', borderRadius: 99, cursor: 'pointer',
                        flexShrink: 0, whiteSpace: 'nowrap' as const,
                        background: isActive ? color : 'var(--bg-surface)',
                        color: isActive ? 'white' : 'var(--text-secondary)',
                        fontWeight: 600, fontSize: 13,
                        border: isActive ? 'none' : '1px solid var(--border)',
                      }}
                    >
                      <span>{icon}</span>{name}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Tombol tambah */}
            <button
              onClick={() => setModalOpen(true)}
              style={{
                width: '100%', padding: '14px',
                background: 'var(--accent)', color: 'white',
                border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700,
                cursor: 'pointer', marginBottom: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 14px rgba(217,43,43,0.28)',
              }}
            >
              <Plus size={17} strokeWidth={2.5} />
              Tambah pengeluaran
            </button>

            {/* Riwayat header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Riwayat pengeluaran</span>
              {filtered.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '3px 10px', borderRadius: 99 }}>
                  {filtered.length} transaksi
                </span>
              )}
            </div>

            {/* List */}
            {loading ? (
              <LoadingState />
            ) : grouped.length === 0 ? (
              <EmptyState filterCat={filterCat} onAdd={() => setModalOpen(true)} hasSearch={!!searchQuery} onClearSearch={() => setSearchQuery('')} />
            ) : (
              grouped.map(({ date, items }) => {
                const dayTotal = items.reduce((s, t) => s + t.amount, 0)
                return (
                  <div key={date} style={{ marginBottom: 22 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '0 2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isToday(date) && (
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0, animation: 'pulseDot 1.5s infinite' }} />
                        )}
                        <span style={{ fontSize: 11, fontWeight: 700, color: isToday(date) ? 'var(--danger)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                          {getDayLabel(date)}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>
                        -{formatRupiah(dayTotal)}
                      </span>
                    </div>

                    <div style={{ background: 'var(--bg-surface)', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                      {items.map((tx, i) => {
                        const { icon, color } = getCatMeta(tx.category)
                        const isLast = i === items.length - 1
                        const timeStr = tx.created_at
                          ? new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                          : ''
                        return (
                          <div
                            key={tx.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '14px 14px',
                              borderBottom: isLast ? 'none' : '0.5px solid rgba(0,0,0,0.06)',
                            }}
                          >
                            <div style={{
                              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                              background: color + '15',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
                            }}>
                              {icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: '0 0 3px', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {tx.note || tx.category}
                              </p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontSize: 11, fontWeight: 500, color, background: color + '12', padding: '2px 7px', borderRadius: 99 }}>
                                  {tx.category}
                                </span>
                                {timeStr && (
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {timeStr}</span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)', letterSpacing: '-0.3px' }}>
                                -{formatRupiah(tx.amount)}
                              </span>
                              <ChevronRight size={13} color="var(--text-muted)" />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}

          </div>
        </div>
      </div>

      <ExpenseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      <style>{`
        .pengeluaran-desktop-layout { display: none !important; }
        .pengeluaran-mobile-layout  { display: block !important; }
        @media (min-width: 768px) {
          .pengeluaran-desktop-layout { display: block !important; }
          .pengeluaran-mobile-layout  { display: none !important; }
        }
      `}</style>
    </>
  )
}

// ─── DESKTOP TABLE ──────────────────────────────────────────────────────────

function DesktopTableView({
  loading, grouped, filterCat, getCatMeta, onAdd,
}: {
  loading: boolean
  grouped: { date: string; items: Transaction[] }[]
  filterCat: string
  getCatMeta: (name: string) => { icon: string; color: string }
  onAdd: () => void
}) {
  if (loading) return <LoadingState />

  if (grouped.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '72px 32px', background: 'var(--bg-surface)', border: '1.5px dashed var(--border-strong)', borderRadius: 18 }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>💸</div>
        <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16, margin: '0 0 6px' }}>
          {filterCat === 'all' ? 'Belum ada pengeluaran' : `Tidak ada pengeluaran "${filterCat}"`}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 20px' }}>
          {filterCat === 'all'
            ? 'Catat pengeluaran pertama untuk mulai memantau biaya operasional warung.'
            : 'Coba pilih kategori lain atau tambah pengeluaran baru.'}
        </p>
        {filterCat === 'all' && (
          <button
            onClick={onAdd}
            style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 12, padding: '11px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            + Catat Pengeluaran
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 170px', padding: '12px 18px', background: 'var(--bg-elevated)', borderBottom: '1.5px solid var(--border)' }}>
        {['Tanggal', 'Keterangan / Kategori', 'Jumlah'].map((col, i) => (
          <div key={i} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: i === 2 ? 'right' : 'left' }}>
            {col}
          </div>
        ))}
      </div>

      {grouped.map(({ date, items }) => (
        <div key={date}>
          <div style={{ padding: '8px 18px', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: isToday(date) ? 'var(--danger)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 5 }}>
              {isToday(date) && (
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)', animation: 'pulseDot 1.5s infinite' }} />
              )}
              {getDayLabel(date)}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>
              -{formatRupiah(items.reduce((s, t) => s + t.amount, 0))}
            </span>
          </div>

          {items.map((tx, i) => {
            const { icon, color } = getCatMeta(tx.category)
            const isLast = i === items.length - 1
            return (
              <div
                key={tx.id}
                style={{ display: 'grid', gridTemplateColumns: '120px 1fr 170px', padding: '13px 18px', borderBottom: isLast ? '1.5px solid var(--border)' : '1px solid var(--border)', alignItems: 'center', transition: 'background 0.12s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-muted)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formatDate(tx.date, 'short')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: color + '15', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                    {icon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.note || tx.category}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 500, color, background: color + '12', padding: '1px 7px', borderRadius: 99, display: 'inline-block' }}>
                      {tx.category}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--danger)', letterSpacing: '-0.3px' }}>
                    -{formatRupiah(tx.amount)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ─── LOADING ────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          style={{ background: 'var(--bg-surface)', border: '0.5px solid rgba(0,0,0,0.06)', borderRadius: 16, padding: '14px', display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: 'var(--bg-elevated)', opacity: 0.5 }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 13, width: '60%', borderRadius: 6, background: 'var(--bg-elevated)', marginBottom: 8, opacity: 0.5 }} />
            <div style={{ height: 10, width: '40%', borderRadius: 5, background: 'var(--bg-elevated)', opacity: 0.5 }} />
          </div>
          <div style={{ height: 14, width: 80, borderRadius: 7, background: 'var(--bg-elevated)', opacity: 0.5 }} />
        </div>
      ))}
    </div>
  )
}

// ─── EMPTY ──────────────────────────────────────────────────────────────────

function EmptyState({
  filterCat, onAdd, hasSearch, onClearSearch,
}: {
  filterCat: string
  onAdd: () => void
  hasSearch: boolean
  onClearSearch: () => void
}) {
  if (hasSearch) {
    return (
      <div style={{ textAlign: 'center', padding: '52px 20px', background: 'var(--bg-surface)', border: '1.5px dashed var(--border-strong)', borderRadius: 18 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15, margin: '0 0 6px' }}>
          Tidak ada hasil
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 16px' }}>
          Coba kata kunci yang berbeda
        </p>
        <button
          onClick={onClearSearch}
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Hapus Pencarian
        </button>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center', padding: '52px 20px', background: 'var(--bg-surface)', border: '1.5px dashed var(--border-strong)', borderRadius: 18 }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto 14px' }}>
        💸
      </div>
      <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15, margin: '0 0 6px' }}>
        {filterCat === 'all' ? 'Belum ada pengeluaran' : `Tidak ada data "${filterCat}"`}
      </p>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 20px', lineHeight: 1.5 }}>
        {filterCat === 'all'
          ? 'Catat pengeluaran pertama untuk mulai memantau biaya operasional warung.'
          : 'Coba pilih kategori lain atau tambah pengeluaran baru.'}
      </p>
      {filterCat === 'all' && (
        <button
          onClick={onAdd}
          style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(217,43,43,0.25)' }}
        >
          + Catat Pengeluaran Pertama
        </button>
      )}
    </div>
  )
}