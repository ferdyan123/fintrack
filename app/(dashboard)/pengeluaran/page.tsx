'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, ChevronRight, Search, X, TrendingDown, CalendarDays, TrendingUp, Trophy, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store/appStore'
import { formatRupiah, formatDate, toISODate } from '@/lib/utils'
import { ExpenseModal } from '@/components/shared/ExpenseModal'
import type { Expense } from '@/types'

// ─── HELPERS ────────────────────────────────────────────────────────────────

function groupByDate(txs: Expense[]): { date: string; items: Expense[] }[] {
  const map = new Map<string, Expense[]>()
  for (const tx of txs) {
    if (!map.has(tx.date)) map.set(tx.date, [])
    map.get(tx.date)!.push(tx)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, items }))
}

function isToday(d: string) { return d === toISODate() }
function isYesterday(d: string) {
  const y = new Date(); y.setDate(y.getDate() - 1)
  return d === toISODate(y)
}
function getDayLabel(d: string) {
  if (isToday(d)) return 'Hari Ini'
  if (isYesterday(d)) return 'Kemarin'
  return formatDate(d, 'long')
}

function getMonthRange(offset = 0) {
  const now = new Date()
  const m = now.getMonth() + 1 + offset
  const y = now.getFullYear()
  const last = new Date(y, m, 0).getDate()
  return {
    start: `${y}-${String(m).padStart(2, '0')}-01`,
    end:   `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
  }
}

// ─── PAGE ────────────────────────────────────────────────────────────────────

export default function PengeluaranPage() {
  const currentStore      = useAppStore((s) => s.currentStore)
  const expenseCategories = useAppStore((s) => s.expenseCategories)

  const [txs,          setTxs]          = useState<Expense[]>([])
  const [lastMonthTxs, setLastMonthTxs] = useState<Expense[]>([])
  const [loading,      setLoading]      = useState(true)
  const [fetchError,   setFetchError]   = useState('')
  const [modalOpen,    setModalOpen]    = useState(false)
  const [filterCat,    setFilterCat]    = useState('all')
  const [searchQuery,  setSearchQuery]  = useState('')
  const [showSearch,   setShowSearch]   = useState(false)

  const isDummy      = !currentStore || currentStore.id === 'dummy-store-001'
  const isOffline    = typeof navigator !== 'undefined' && !navigator.onLine
  const skipSupabase = isDummy || isOffline

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError('')

    if (skipSupabase) {
      const thisMonth = getMonthRange(0)
      const pending = useAppStore.getState().pendingSync
        .filter((p) => p.table === 'expenses' && p.action === 'insert')
        .map((p) => p.payload as unknown as Expense)
        .filter((t) => t.date >= thisMonth.start && t.date <= thisMonth.end)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
      setTxs(pending)
      setLastMonthTxs([])
      setLoading(false)
      return
    }

    if (!currentStore) { setLoading(false); return }

    try {
      const supabase = createClient()
      const thisMonth = getMonthRange(0)
      const lastMonth = getMonthRange(-1)

      const [{ data: thisData, error: e1 }, { data: lastData }] = await Promise.all([
        supabase.from('expenses').select('*')
          .eq('store_id', currentStore.id)
          .gte('date', thisMonth.start).lte('date', thisMonth.end)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(300),
        supabase.from('expenses').select('amount')
          .eq('store_id', currentStore.id)
          .gte('date', lastMonth.start).lte('date', lastMonth.end),
      ])

      if (e1) throw e1
      setTxs((thisData as Expense[]) ?? [])
      setLastMonthTxs((lastData as Expense[]) ?? [])
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [currentStore, skipSupabase])

  useEffect(() => { load() }, [load])

  function handleSaved(tx: Expense) {
    setTxs((prev) => [tx, ...prev])
    setTimeout(() => load(), 800)
  }

  // ── STATS ─────────────────────────────────────────────────────────────────
  const now          = new Date()
  const today        = toISODate()
  const totalMonth   = txs.reduce((s, t) => s + t.amount, 0)
  const totalToday   = txs.filter((t) => t.date === today).reduce((s, t) => s + t.amount, 0)
  const txCountToday = txs.filter((t) => t.date === today).length
  const totalLast    = lastMonthTxs.reduce((s, t) => s + t.amount, 0)
  const pctChange    = totalLast > 0 ? Math.round(((totalMonth - totalLast) / totalLast) * 100) : null
  const biggestTx    = txs.length > 0 ? txs.reduce((a, b) => a.amount >= b.amount ? a : b) : null
  const lastDay      = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const rangeLabel   = `1–${lastDay} ${now.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}`

  // ── FILTER ────────────────────────────────────────────────────────────────
  const filtered = txs
    .filter((t) => filterCat === 'all' || t.category === filterCat)
    .filter((t) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return t.category.toLowerCase().includes(q) || (t.note ?? '').toLowerCase().includes(q)
    })
  const grouped = groupByDate(filtered)

  // ── KATEGORI ──────────────────────────────────────────────────────────────
  const usedCats    = Array.from(new Set(txs.map((t) => t.category)))
  const storeCats   = expenseCategories.map((c) => c.name)
  const allCatNames = Array.from(new Set([...storeCats, ...usedCats]))

  function getCatMeta(name: string) {
    const f = expenseCategories.find((c) => c.name === name)
    return { icon: f?.icon ?? '💸', color: f?.color ?? '#DC2626' }
  }

  return (
    <>
      <div style={{ background: 'var(--bg-base)', minHeight: '100dvh' }}>

        {/* ════════════ DESKTOP ════════════ */}
        <div className="pengeluaran-desktop-layout">
          {/*
           * FIX PADDING: samain ke Journalyze — 20px kiri-kanan (dari 32px)
           * max-width tetap 1100px konsisten dengan dashboard & riwayat
           */}
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 56px' }}>

            {/* ── PAGE HEADER ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--danger-bg)', borderRadius: 99, padding: '4px 12px', marginBottom: 8 }}>
                  <TrendingDown size={12} color="var(--danger)" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pengeluaran</span>
                </div>
                <h1 style={{ margin: '0 0 3px', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                  Catat &amp; Pantau Biaya Operasional
                </h1>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                  Kelola pengeluaran, jaga keuntungan {currentStore?.name ?? 'warung'} Anda.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(217,43,43,0.28)', transition: 'transform 0.15s, box-shadow 0.15s', flexShrink: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(217,43,43,0.38)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(217,43,43,0.28)' }}
              >
                <Plus size={15} strokeWidth={2.5} />
                + Catat Pengeluaran
              </button>
            </div>

            {/* Error banner */}
            {fetchError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                ⚠️ {fetchError}
                <button onClick={load} style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', textDecoration: 'underline' }}>Coba lagi</button>
              </div>
            )}

            {/* ── 4 STAT CARDS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>

              {/* Total bulan ini */}
              <div style={{ background: 'var(--accent)', borderRadius: 16, padding: '18px 20px', boxShadow: '0 4px 16px rgba(217,43,43,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Wallet size={14} color="white" />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em' }}>Total Pengeluaran</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>Bulan Ini</div>
                  </div>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'white', letterSpacing: '-0.5px', lineHeight: 1, marginBottom: 8 }}>
                  {loading ? '—' : formatRupiah(totalMonth)}
                </div>
                {pctChange !== null ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 99, padding: '3px 9px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                    {pctChange > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {pctChange > 0 ? '+' : ''}{pctChange}% dari bulan lalu
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{rangeLabel}</span>
                )}
              </div>

              {/* Hari ini */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CalendarDays size={12} color="var(--danger)" />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Hari Ini</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--danger)', letterSpacing: '-0.3px', marginBottom: 2 }}>
                  {loading ? '—' : formatRupiah(totalToday)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{txCountToday} transaksi</div>
              </div>

              {/* Terbesar */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: '#FEF9C3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trophy size={12} color="#CA8A04" />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Terbesar</span>
                </div>
                {biggestTx ? (
                  <>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px', marginBottom: 2 }}>
                      {formatRupiah(biggestTx.amount)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {biggestTx.category}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{loading ? '—' : 'Belum ada'}</div>
                )}
              </div>

              {/* Total transaksi */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                    📋
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Transaksi</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: 2 }}>
                  {txs.length}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rangeLabel}</div>
              </div>
            </div>

            {/* ── 2-COL: SIDEBAR + TABEL ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 20, alignItems: 'start' }}>

              {/* SIDEBAR */}
              <div style={{ position: 'sticky', top: 76 }}>

                {/* Filter kategori dengan breakdown */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Filter Kategori</span>
                    {filterCat !== 'all' && (
                      <button onClick={() => setFilterCat('all')} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Reset</button>
                    )}
                  </div>

                  <button
                    onClick={() => setFilterCat('all')}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: 'none', cursor: 'pointer', background: filterCat === 'all' ? 'var(--accent-subtle)' : 'transparent', borderBottom: '1px solid var(--border)', textAlign: 'left' }}
                  >
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: filterCat === 'all' ? 'var(--accent)' : 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>📊</div>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: filterCat === 'all' ? 700 : 500, color: filterCat === 'all' ? 'var(--accent)' : 'var(--text-primary)' }}>Semua</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '1px 7px', borderRadius: 99 }}>{txs.length}</span>
                  </button>

                  {allCatNames.length === 0 && !loading && (
                    <div style={{ padding: '16px 14px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>Belum ada kategori</div>
                  )}

                  {allCatNames.map((name, idx) => {
                    const { icon, color } = getCatMeta(name)
                    const catTxs   = txs.filter((t) => t.category === name)
                    const catTotal = catTxs.reduce((s, t) => s + t.amount, 0)
                    const pct      = totalMonth > 0 ? Math.round((catTotal / totalMonth) * 100) : 0
                    const isActive = filterCat === name
                    const isLast   = idx === allCatNames.length - 1
                    return (
                      <button
                        key={name}
                        onClick={() => setFilterCat(isActive ? 'all' : name)}
                        style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 5, padding: '10px 14px', border: 'none', cursor: 'pointer', background: isActive ? 'var(--accent-subtle)' : 'transparent', borderBottom: isLast ? 'none' : '1px solid var(--border)', textAlign: 'left' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 24, height: 24, borderRadius: 6, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>{icon}</div>
                          <span style={{ flex: 1, fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--accent)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }}>{pct}%</span>
                        </div>
                        <div style={{ height: 2, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden', marginLeft: 31 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: isActive ? 'var(--accent)' : color, borderRadius: 99 }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 31 }}>{formatRupiah(catTotal)} · {catTxs.length} trx</div>
                      </button>
                    )
                  })}
                </div>

                {/* Ringkasan */}
                {txs.length > 0 && (
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px', marginTop: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Ringkasan</div>
                    {[
                      { label: 'Rata-rata/transaksi', value: formatRupiah(Math.round(totalMonth / txs.length)) },
                      { label: 'Hari ini', value: `${txCountToday} transaksi` },
                      { label: 'Kategori', value: `${allCatNames.length} aktif` },
                    ].map(({ label, value }, i, arr) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* TABEL RIWAYAT */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Riwayat Pengeluaran</h2>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                      {filterCat === 'all' ? `${filtered.length} transaksi ditampilkan` : `${filterCat} · ${filtered.length} transaksi`}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {showSearch && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg-surface)', border: '1.5px solid var(--accent-border)', borderRadius: 10, padding: '7px 12px', width: 200 }}>
                        <Search size={13} color="var(--text-muted)" />
                        <input autoFocus placeholder="Cari..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text-primary)', flex: 1 }} />
                        {searchQuery && <button onClick={() => setSearchQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}><X size={11} color="var(--text-muted)" /></button>}
                      </div>
                    )}
                    <button
                      onClick={() => { setShowSearch((v) => !v); if (showSearch) setSearchQuery('') }}
                      style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border)', background: showSearch ? 'var(--accent-subtle)' : 'var(--bg-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {showSearch ? <X size={13} color="var(--accent)" /> : <Search size={13} color="var(--text-muted)" />}
                    </button>
                  </div>
                </div>

                <DesktopTable loading={loading} grouped={grouped} getCatMeta={getCatMeta} filterCat={filterCat} onAdd={() => setModalOpen(true)} />
              </div>
            </div>
          </div>
        </div>

        {/* ════════════ MOBILE ════════════ */}
        <div className="pengeluaran-mobile-layout">

          {/* ── HERO — true full-bleed via negative margin ── */}
          <div className="pengeluaran-hero" style={{ background: 'var(--accent)', padding: '16px 20px 28px' }}>

            {/* Baris atas: store + tombol */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏪</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>{currentStore?.name ?? 'Toko'}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>Pengeluaran</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 7 }}>
                <button
                  onClick={() => { setShowSearch((v) => !v); if (showSearch) setSearchQuery('') }}
                  style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Search size={15} color="white" />
                </button>
                <button
                  onClick={() => setModalOpen(true)}
                  style={{ height: 34, padding: '0 13px', background: 'white', color: 'var(--accent)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  <Plus size={13} strokeWidth={2.5} />
                  Catat
                </button>
              </div>
            </div>

            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              Total pengeluaran bulan ini
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'white', letterSpacing: '-0.5px', lineHeight: 1, marginBottom: 10 }}>
              {loading ? '—' : formatRupiah(totalMonth)}
            </div>
            {pctChange !== null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                {pctChange > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {pctChange > 0 ? '+' : ''}{pctChange}% dari bulan lalu
              </span>
            )}
          </div>

          {/* ── STAT CARDS overlap ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 16px', marginTop: -16, marginBottom: 18, position: 'relative', zIndex: 1 }}>

            <div style={{ background: 'var(--bg-surface)', borderRadius: 14, padding: '14px', boxShadow: '0 2px 12px rgba(0,0,0,0.09)', border: '0.5px solid rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CalendarDays size={13} color="var(--danger)" />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Hari ini</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--danger)', letterSpacing: '-0.3px', marginBottom: 2 }}>
                {loading ? '—' : formatRupiah(totalToday)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{txCountToday} transaksi</div>
            </div>

            <div style={{ background: 'var(--bg-surface)', borderRadius: 14, padding: '14px', boxShadow: '0 2px 12px rgba(0,0,0,0.09)', border: '0.5px solid rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: '#FEF9C3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trophy size={13} color="#CA8A04" />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Terbesar</span>
              </div>
              {biggestTx ? (
                <>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px', marginBottom: 2 }}>
                    {formatRupiah(biggestTx.amount)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {biggestTx.category}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{loading ? '—' : 'Belum ada'}</div>
              )}
            </div>
          </div>

          {/* ── Konten bawah ── */}
          <div style={{ padding: '0 16px' }}>

            {fetchError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                ⚠️ {fetchError}
                <button onClick={load} style={{ marginLeft: 'auto', fontSize: 11, color: '#DC2626', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Coba lagi</button>
              </div>
            )}

            {showSearch && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-surface)', border: '1.5px solid var(--accent-border)', borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>
                <Search size={14} color="var(--text-muted)" />
                <input autoFocus placeholder="Cari kategori atau catatan..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: 'var(--text-primary)', flex: 1 }} />
                {searchQuery && <button onClick={() => setSearchQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}><X size={13} color="var(--text-muted)" /></button>}
              </div>
            )}

            {allCatNames.length > 0 && (
              <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4, marginBottom: 14, scrollbarWidth: 'none' }}>
                <button onClick={() => setFilterCat('all')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 99, cursor: 'pointer', flexShrink: 0, background: filterCat === 'all' ? 'var(--accent)' : 'var(--bg-surface)', color: filterCat === 'all' ? 'white' : 'var(--text-secondary)', fontWeight: 600, fontSize: 12, border: filterCat === 'all' ? 'none' : '1px solid var(--border)' }}>Semua</button>
                {allCatNames.map((name) => {
                  const { icon, color } = getCatMeta(name)
                  const isActive = filterCat === name
                  return (
                    <button key={name} onClick={() => setFilterCat(isActive ? 'all' : name)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 99, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' as const, background: isActive ? color : 'var(--bg-surface)', color: isActive ? 'white' : 'var(--text-secondary)', fontWeight: 600, fontSize: 12, border: isActive ? 'none' : '1px solid var(--border)' }}>
                      <span>{icon}</span>{name}
                    </button>
                  )
                })}
              </div>
            )}

            <button
              onClick={() => setModalOpen(true)}
              style={{ width: '100%', padding: '13px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 13, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 14px rgba(217,43,43,0.28)' }}
            >
              <Plus size={16} strokeWidth={2.5} />
              Tambah pengeluaran
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Riwayat pengeluaran</span>
              {filtered.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '3px 9px', borderRadius: 99 }}>
                  {filtered.length} transaksi
                </span>
              )}
            </div>

            {loading ? <LoadingState /> : grouped.length === 0 ? (
              <EmptyState filterCat={filterCat} onAdd={() => setModalOpen(true)} hasSearch={!!searchQuery} onClearSearch={() => setSearchQuery('')} />
            ) : (
              grouped.map(({ date, items }) => {
                const dayTotal = items.reduce((s, t) => s + t.amount, 0)
                return (
                  <div key={date} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '0 2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isToday(date) && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0, animation: 'pulseDot 1.5s infinite' }} />}
                        <span style={{ fontSize: 11, fontWeight: 700, color: isToday(date) ? 'var(--danger)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                          {getDayLabel(date)}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>-{formatRupiah(dayTotal)}</span>
                    </div>

                    <div style={{ background: 'var(--bg-surface)', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                      {items.map((tx, i) => {
                        const { icon, color } = getCatMeta(tx.category)
                        const isLast  = i === items.length - 1
                        const timeStr = tx.created_at ? new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''
                        return (
                          <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', borderBottom: isLast ? 'none' : '0.5px solid rgba(0,0,0,0.06)' }}>
                            <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>{icon}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {tx.note || tx.category}
                              </p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontSize: 10, fontWeight: 500, color, background: color + '12', padding: '1px 6px', borderRadius: 99 }}>{tx.category}</span>
                                {timeStr && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>· {timeStr}</span>}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)', letterSpacing: '-0.2px' }}>-{formatRupiah(tx.amount)}</span>
                              <ChevronRight size={12} color="var(--text-muted)" />
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

      <ExpenseModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={handleSaved} />

      <style>{`
        .pengeluaran-desktop-layout { display: none !important; }
        .pengeluaran-mobile-layout  { display: block !important; }
        @media (min-width: 768px) {
          .pengeluaran-desktop-layout { display: block !important; }
          .pengeluaran-mobile-layout  { display: none !important; }
        }
        @media (max-width: 767px) {
          .pengeluaran-mobile-layout {
            padding-left: 0 !important;
            padding-right: 0 !important;
            padding-top: 0 !important;
          }
          .pengeluaran-hero {
            margin-left: calc(-1 * var(--layout-padding-x, 0px));
            margin-right: calc(-1 * var(--layout-padding-x, 0px));
          }
        }
      `}</style>
    </>
  )
}

// ─── DESKTOP TABLE ───────────────────────────────────────────────────────────

function DesktopTable({ loading, grouped, getCatMeta, filterCat, onAdd }: {
  loading: boolean
  grouped: { date: string; items: Expense[] }[]
  getCatMeta: (n: string) => { icon: string; color: string }
  filterCat: string
  onAdd: () => void
}) {
  if (loading) return <LoadingState />
  if (grouped.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 32px', background: 'var(--bg-surface)', border: '1.5px dashed var(--border-strong)', borderRadius: 16 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>💸</div>
        <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15, margin: '0 0 6px' }}>
          {filterCat === 'all' ? 'Belum ada pengeluaran' : `Tidak ada pengeluaran "${filterCat}"`}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 18px' }}>
          {filterCat === 'all' ? 'Catat pengeluaran pertama untuk mulai memantau biaya operasional warung.' : 'Coba pilih kategori lain.'}
        </p>
        {filterCat === 'all' && (
          <button onClick={onAdd} style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 11, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            + Catat Pengeluaran
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 150px', padding: '11px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
        {['Tanggal', 'Keterangan / Kategori', 'Jumlah'].map((col, i) => (
          <div key={i} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: i === 2 ? 'right' : 'left' }}>{col}</div>
        ))}
      </div>
      {grouped.map(({ date, items }) => (
        <div key={date}>
          <div style={{ padding: '7px 16px', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: isToday(date) ? 'var(--danger)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 5 }}>
              {isToday(date) && <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'var(--danger)' }} />}
              {getDayLabel(date)}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)' }}>-{formatRupiah(items.reduce((s, t) => s + t.amount, 0))}</span>
          </div>
          {items.map((tx, i) => {
            const { icon, color } = getCatMeta(tx.category)
            const isLast = i === items.length - 1
            return (
              <div
                key={tx.id}
                style={{ display: 'grid', gridTemplateColumns: '110px 1fr 150px', padding: '12px 16px', borderBottom: isLast ? 'none' : '1px solid var(--border)', alignItems: 'center', transition: 'background 0.1s', cursor: 'default' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-muted)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{formatDate(tx.date, 'short')}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: color + '15', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{icon}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.note || tx.category}</div>
                    <span style={{ fontSize: 10, fontWeight: 500, color, background: color + '12', padding: '1px 6px', borderRadius: 99, display: 'inline-block' }}>{tx.category}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--danger)', letterSpacing: '-0.3px' }}>-{formatRupiah(tx.amount)}</span>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ─── LOADING ─────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3].map((n) => (
        <div key={n} style={{ background: 'var(--bg-surface)', border: '0.5px solid rgba(0,0,0,0.06)', borderRadius: 12, padding: '13px', display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'var(--bg-elevated)', opacity: 0.5 }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 11, width: '55%', borderRadius: 5, background: 'var(--bg-elevated)', marginBottom: 7, opacity: 0.5 }} />
            <div style={{ height: 9, width: '38%', borderRadius: 4, background: 'var(--bg-elevated)', opacity: 0.5 }} />
          </div>
          <div style={{ height: 12, width: 70, borderRadius: 5, background: 'var(--bg-elevated)', opacity: 0.5 }} />
        </div>
      ))}
    </div>
  )
}

// ─── EMPTY ───────────────────────────────────────────────────────────────────

function EmptyState({ filterCat, onAdd, hasSearch, onClearSearch }: { filterCat: string; onAdd: () => void; hasSearch: boolean; onClearSearch: () => void }) {
  if (hasSearch) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--bg-surface)', border: '1.5px dashed var(--border-strong)', borderRadius: 14 }}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>🔍</div>
        <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 13, margin: '0 0 4px' }}>Tidak ada hasil</p>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 14px' }}>Coba kata kunci yang berbeda</p>
        <button onClick={onClearSearch} style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Hapus Pencarian
        </button>
      </div>
    )
  }
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--bg-surface)', border: '1.5px dashed var(--border-strong)', borderRadius: 14 }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 12px' }}>💸</div>
      <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 13, margin: '0 0 4px' }}>
        {filterCat === 'all' ? 'Belum ada pengeluaran' : `Tidak ada data "${filterCat}"`}
      </p>
      <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 16px', lineHeight: 1.5 }}>
        {filterCat === 'all' ? 'Catat pengeluaran pertama untuk mulai memantau biaya operasional.' : 'Coba pilih kategori lain.'}
      </p>
      {filterCat === 'all' && (
        <button onClick={onAdd} style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(217,43,43,0.22)' }}>
          + Catat Pengeluaran Pertama
        </button>
      )}
    </div>
  )
}