'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, LineChart, Line, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store/appStore'
import { useToast } from '@/components/shared/Toast'
import { formatRupiah } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SaleRow {
  product_name: string | null
  category: string | null
  qty: number
  amount: number
  profit: number
  date: string
  created_at: string
}
interface ProductRow {
  id: string; name: string; price: number; hpp: number
  icon: string | null; photo_url: string | null
}
type PageMode = 'rekap' | 'compare'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
function getPrevMonth(m: string) {
  const p = m.split('-').map(Number)
  const d = new Date(p[0], p[1] - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function getMonthRange(month: string) {
  const p = month.split('-').map(Number)
  return {
    start: new Date(p[0], p[1] - 1, 1).toISOString().slice(0, 10),
    end:   new Date(p[0], p[1], 0).toISOString().slice(0, 10),
  }
}
function getLast6Months() {
  const res: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    res.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return res
}
function getLast12Months() {
  const res: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    res.push({ value, label })
  }
  return res
}
function monthLabel(m: string) {
  const p = m.split('-').map(Number)
  return new Date(p[0], p[1] - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}
function monthLabelShort(m: string) {
  const p = m.split('-').map(Number)
  return new Date(p[0], p[1] - 1).toLocaleDateString('id-ID', { month: 'short' })
}
function daysInMonth(m: string) {
  const p = m.split('-').map(Number)
  return new Date(p[0], p[1], 0).getDate()
}

// BUG FIX #4 — sanitize label untuk dipakai sebagai Recharts dataKey.
// Label yang mengandung spasi/karakter khusus (misal "September 2026") akan
// menyebabkan recharts gagal merender Line/Bar karena key tidak valid.
// Solusi: buat slug aman sebagai dataKey, lalu pakai `name` prop untuk display.
function safeKey(label: string): string {
  return label.replace(/[^a-zA-Z0-9_]/g, '_')
}

const RANK_COLORS  = ['#D92B2B','#F87171','#FBBF24','#A3A3A3','#BFDBFE']
const DONUT_COLORS = ['#D92B2B','#FBBF24']
const DAY_NAMES    = ['Min','Sen','Sel','Rab','Kam','Jum','Sab']

// ─── Aggregator ───────────────────────────────────────────────────────────────

interface MonthStats {
  omzet: number
  txCount: number
  avgPerDay: number
  bestDay: { label: string; amount: number }
  topProducts: { name: string; omzet: number; qty: number; delta?: number }[]
  kasir: number
  catering: number
}

function aggregateSales(sales: SaleRow[], month: string): MonthStats {
  const omzet    = sales.reduce((s, t) => s + t.amount, 0)
  const txCount  = sales.length
  const days     = daysInMonth(month)
  const avgPerDay = days > 0 ? omzet / days : 0

  // Best day
  const dayMap: Record<string, number> = {}
  sales.forEach(s => { dayMap[s.date] = (dayMap[s.date] ?? 0) + s.amount })
  const bestEntry = Object.entries(dayMap).sort((a, b) => b[1] - a[1])[0]
  const bestDay = bestEntry
    ? { label: new Date(bestEntry[0] + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }), amount: bestEntry[1] }
    : { label: '—', amount: 0 }

  // Top products
  const prodMap: Record<string, { omzet: number; qty: number }> = {}
  sales.forEach(s => {
    const n = s.product_name ?? '(Tanpa Nama)'
    if (!prodMap[n]) prodMap[n] = { omzet: 0, qty: 0 }
    prodMap[n].omzet += s.amount
    prodMap[n].qty   += s.qty ?? 0
  })
  const topProducts = Object.entries(prodMap)
    .sort((a, b) => b[1].omzet - a[1].omzet).slice(0, 5)
    .map(([name, v]) => ({ name, ...v }))

  // Kasir vs Catering
  let kasir = 0, catering = 0
  sales.forEach(s => { if (s.category === 'Catering') catering += s.amount; else kasir += s.amount })

  return { omzet, txCount, avgPerDay, bestDay, topProducts, kasir, catering }
}

// ─── Data hooks ───────────────────────────────────────────────────────────────

function useAnalyticsData(selectedMonth: string) {
  const currentStore = useAppStore((s) => s.currentStore)
  const [sales,    setSales]    = useState<SaleRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    if (!currentStore) { setLoading(false); return }
    setLoading(true); setError(null)
    const { start, end } = getMonthRange(selectedMonth)
    const sb = createClient()
    Promise.all([
      sb.from('sales').select('product_name,category,qty,amount,profit,date,created_at')
        .eq('store_id', currentStore.id).gte('date', start).lte('date', end),
      sb.from('products').select('id,name,price,hpp,icon,photo_url')
        .eq('store_id', currentStore.id),
    ]).then(([{ data: s, error: e1 }, { data: p, error: e2 }]) => {
      if (e1 || e2) setError((e1 || e2)!.message)
      else { setSales(s ?? []); setProducts(p ?? []) }
      setLoading(false)
    })
  }, [currentStore, selectedMonth])

  return { sales, products, loading, error }
}

function useTrendData() {
  const currentStore = useAppStore((s) => s.currentStore)
  const [data, setData] = useState<{ amount: number; date: string }[]>([])
  useEffect(() => {
    if (!currentStore) return
    const months = getLast6Months()
    const { start } = getMonthRange(months[0])
    const { end }   = getMonthRange(months[months.length - 1])
    createClient().from('sales').select('amount,date')
      .eq('store_id', currentStore.id).gte('date', start).lte('date', end)
      .then(({ data: d }) => setData(d ?? []))
  }, [currentStore])
  return data
}

function useCompareData(monthA: string, monthB: string) {
  const currentStore = useAppStore((s) => s.currentStore)
  const [salesA, setSalesA] = useState<SaleRow[]>([])
  const [salesB, setSalesB] = useState<SaleRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!currentStore) return
    setLoading(true)
    const sb = createClient()
    const { start: sA, end: eA } = getMonthRange(monthA)
    const { start: sB, end: eB } = getMonthRange(monthB)
    Promise.all([
      sb.from('sales').select('product_name,category,qty,amount,profit,date,created_at')
        .eq('store_id', currentStore.id).gte('date', sA).lte('date', eA),
      sb.from('sales').select('product_name,category,qty,amount,profit,date,created_at')
        .eq('store_id', currentStore.id).gte('date', sB).lte('date', eB),
    ]).then(([{ data: a }, { data: b }]) => {
      setSalesA(a ?? []); setSalesB(b ?? [])
      setLoading(false)
    })
  }, [currentStore, monthA, monthB])

  return { salesA, salesB, loading }
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Skel({ h = 14, w = '100%' }: { h?: number; w?: string | number }) {
  return <div style={{ height: h, width: w, borderRadius: 8, background: 'var(--border)', opacity: 0.5, animation: 'pulse 1.4s ease-in-out infinite' }} />
}

function DeltaBadge({ a, b, prefix = '' }: { a: number; b: number; prefix?: string }) {
  if (b === 0 && a === 0) return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
  if (b === 0) return <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A' }}>Baru</span>
  const pct = ((a - b) / b * 100)
  const up  = pct >= 0
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: up ? '#16A34A' : '#DC2626', background: up ? '#DCFCE7' : '#FEE2E2', padding: '2px 7px', borderRadius: 5 }}>
      {up ? '↑' : '↓'} {prefix}{Math.abs(pct).toFixed(1)}%
    </span>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function AnalitikHero({ sales, products, selectedMonth, loading, prevSales }: {
  sales: SaleRow[]; products: ProductRow[]; selectedMonth: string; loading: boolean; prevSales: SaleRow[]
}) {
  const omzet      = sales.reduce((s, t) => s + t.amount, 0)
  const prevOmzet  = prevSales.reduce((s, t) => s + t.amount, 0)
  const growth     = prevOmzet > 0 ? ((omzet - prevOmzet) / prevOmzet * 100) : null

  const topProd = useMemo(() => {
    const map: Record<string, number> = {}
    sales.forEach(s => { if (s.product_name) map[s.product_name] = (map[s.product_name] ?? 0) + s.amount })
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  }, [sales])

  const avgMargin = useMemo(() => {
    const valid = products.filter(p => p.price > 0)
    if (!valid.length) return 0
    return valid.reduce((s, p) => s + ((p.price - p.hpp) / p.price * 100), 0) / valid.length
  }, [products])

  const statusBadge = useMemo(() => {
    if (growth === null) return null
    if (growth >= 10)  return { label: '🟢 Tumbuh', color: '#16A34A', bg: 'rgba(22,163,74,0.15)' }
    if (growth >= -5)  return { label: '🟡 Stabil',  color: '#D97706', bg: 'rgba(217,119,6,0.15)' }
    return               { label: '🔴 Perlu Perhatian', color: '#DC2626', bg: 'rgba(220,38,38,0.15)' }
  }, [growth])

  const narasi = useMemo(() => {
    if (loading) return 'Memuat data analitik...'
    if (omzet === 0) return `Belum ada transaksi di ${monthLabel(selectedMonth)}. Yuk mulai catat penjualan!`
    const parts: string[] = [`Omzet ${monthLabel(selectedMonth)} mencapai ${formatRupiah(omzet, true)}`]
    if (growth !== null) parts.push(growth >= 0 ? `naik ${growth.toFixed(1)}% dari bulan lalu 📈` : `turun ${Math.abs(growth).toFixed(1)}% dari bulan lalu ⚠️`)
    if (topProd) parts.push(`${topProd} jadi produk terlaris`)
    if (avgMargin > 0) parts.push(`rata-rata margin toko ${avgMargin.toFixed(1)}%`)
    return parts.join(' · ')
  }, [loading, omzet, growth, topProd, avgMargin, selectedMonth])

  return (
    <div style={{ background: '#D92B2B', borderRadius: 16, color: 'white', marginBottom: 20, overflow: 'hidden' }}>
      {/* Mobile */}
      <div className="hero-mobile" style={{ padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📈</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Analitik Produk</div>
              <div style={{ fontSize: 11, opacity: 0.75 }}>{monthLabel(selectedMonth)}</div>
            </div>
          </div>
          {statusBadge && <span style={{ fontSize: 10, fontWeight: 700, background: statusBadge.bg, color: 'white', padding: '3px 9px', borderRadius: 99, border: '1px solid rgba(255,255,255,0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}>{statusBadge.label}</span>}
        </div>
        <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px', fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>{narasi}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'Omzet',  val: loading ? '—' : formatRupiah(omzet, true) },
            { label: 'Margin', val: loading ? '—' : `${avgMargin.toFixed(1)}%` },
            { label: 'SKU',    val: `${products.length}` },
          ].map(item => (
            <div key={item.label} style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{item.val}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Desktop */}
      <div className="hero-desktop" style={{ padding: '24px 28px', alignItems: 'flex-start', gap: 28 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📈</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>Analitik Produk — {monthLabel(selectedMonth)}</div>
              {statusBadge && <span style={{ fontSize: 11, fontWeight: 700, background: statusBadge.bg, color: 'white', padding: '3px 10px', borderRadius: 99, border: '1px solid rgba(255,255,255,0.25)' }}>{statusBadge.label}</span>}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '12px 16px', fontSize: 13, lineHeight: 1.65 }}>{narasi}</div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.18)', alignSelf: 'stretch', flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, minWidth: 200, flexShrink: 0 }}>
          <div style={{ fontSize: 10, opacity: 0.65, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Omzet Bulan Ini</div>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.1 }}>{loading ? '—' : formatRupiah(omzet)}</div>
          {growth !== null && (
            <div style={{ fontSize: 12, opacity: 0.85, background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: 99 }}>
              {growth >= 0 ? '↑' : '↓'} {Math.abs(growth).toFixed(1)}% dari bulan lalu
            </div>
          )}
          <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, opacity: 0.6 }}>Avg Margin</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{avgMargin.toFixed(1)}%</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, opacity: 0.6 }}>SKU Aktif</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{products.length} produk</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────
// TASK 1 FIX: Mobile layout diubah ke 2 kolom, card ketiga span full width.
// Padding & font dikecilkan untuk tampilan compact di HP.

function KpiCards({ sales, prevSales, products, loading }: { sales: SaleRow[]; prevSales: SaleRow[]; products: ProductRow[]; loading: boolean }) {
  const bestDay = useMemo(() => {
    const map: Record<string, number> = {}
    sales.forEach(s => { map[s.date] = (map[s.date] ?? 0) + s.amount })
    const best = Object.entries(map).sort((a, b) => b[1] - a[1])[0]
    if (!best) return { label: '—', amount: 0 }
    return { label: new Date(best[0] + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }), amount: best[1] }
  }, [sales])

  const totalQty     = sales.reduce((s, t) => s + (t.qty ?? 0), 0)

  const cards = [
    { icon: '📦', bg: '#DBEAFE', label: 'Total SKU Aktif',  value: `${products.length} produk`,  sub: 'Terdaftar di toko',                subColor: '#2563EB', delta: null,                               fullWidth: false },
    { icon: '🧾', bg: '#DCFCE7', label: 'Total Transaksi',  value: `${sales.length} trx`,         sub: `${totalQty} item terjual`,         subColor: '#16A34A', delta: { a: sales.length, b: prevSales.length }, fullWidth: false },
    { icon: '🏆', bg: '#FEF3C7', label: 'Hari Terbaik',     value: bestDay.label,                 sub: bestDay.amount ? formatRupiah(bestDay.amount, true) : 'Belum ada', subColor: '#D97706', delta: null, fullWidth: true  },
  ]

  return (
    // grid-template-columns diatur via CSS class; di mobile jadi "1fr 1fr" dengan
    // card ke-3 span 2 kolom. Di desktop tetap "repeat(3, 1fr)".
    <div style={{ display: 'grid', gap: 12, marginBottom: 20 }} className="kpi-3col">
      {cards.map(c => (
        <div
          key={c.label}
          className={c.fullWidth ? 'kpi-full' : ''}
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 14 }}
        >
          <div style={{ width: 28, height: 28, borderRadius: 8, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, marginBottom: 10 }}>{c.icon}</div>
          {loading ? <Skel h={18} w="60%" /> : <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px', marginBottom: 2 }}>{c.value}</div>}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{c.label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {loading ? <Skel h={10} w="45%" /> : <div style={{ fontSize: 10, fontWeight: 600, color: c.subColor }}>{c.sub}</div>}
            {!loading && c.delta && <DeltaBadge a={c.delta.a} b={c.delta.b} />}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Trend Chart ──────────────────────────────────────────────────────────────

function TrendChart({ trendSales }: { trendSales: { amount: number; date: string }[] }) {
  const months = getLast6Months()
  const data = months.map(m => {
    const { start, end } = getMonthRange(m)
    const omzet = trendSales.filter(s => s.date >= start && s.date <= end).reduce((s, t) => s + t.amount, 0)
    return { label: monthLabelShort(m), omzet, month: m }
  })
  const maxOmzet = Math.max(...data.map(d => d.omzet))
  const growthLast = data.length >= 2 && data[data.length - 2].omzet > 0
    ? ((data[data.length - 1].omzet - data[data.length - 2].omzet) / data[data.length - 2].omzet * 100)
    : null

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Tren Omzet 6 Bulan</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total penjualan per bulan</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {maxOmzet > 0 && <div style={{ fontSize: 11, fontWeight: 600, color: '#16A34A', background: '#DCFCE7', padding: '3px 9px', borderRadius: 6 }}>Peak: {formatRupiah(maxOmzet, true)}</div>}
          {growthLast !== null && (
            <div style={{ fontSize: 11, fontWeight: 600, color: growthLast >= 0 ? '#16A34A' : '#DC2626', background: growthLast >= 0 ? '#DCFCE7' : '#FEE2E2', padding: '3px 9px', borderRadius: 6 }}>
              {growthLast >= 0 ? '↑' : '↓'} {Math.abs(growthLast).toFixed(1)}% dari bulan lalu
            </div>
          )}
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#D92B2B" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#D92B2B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
              formatter={(v: unknown) => [formatRupiah(v as number), 'Omzet']}
            />
            <Area type="monotone" dataKey="omzet" stroke="#D92B2B" strokeWidth={2} fill="url(#trendGrad)"
              dot={{ r: 3, fill: '#D92B2B', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#D92B2B', stroke: 'white', strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Top Products ─────────────────────────────────────────────────────────────

function TopProductsSection({ sales, products, loading }: { sales: SaleRow[]; products: ProductRow[]; loading: boolean }) {
  const topProducts = useMemo(() => {
    const map: Record<string, { qty: number; omzet: number; profit: number }> = {}
    sales.forEach(s => {
      const n = s.product_name ?? '(Tanpa Nama)'
      if (!map[n]) map[n] = { qty: 0, omzet: 0, profit: 0 }
      map[n].qty    += s.qty ?? 0
      map[n].omzet  += s.amount
      map[n].profit += s.profit
    })
    const prodLookup: Record<string, ProductRow> = {}
    products.forEach(p => { prodLookup[p.name] = p })
    return Object.entries(map)
      .sort((a, b) => b[1].omzet - a[1].omzet).slice(0, 5)
      .map(([name, agg], i) => {
        const p = prodLookup[name]
        const margin = p && p.price > 0 ? (p.price - p.hpp) / p.price * 100 : agg.omzet > 0 ? agg.profit / agg.omzet * 100 : 0
        return { rank: i + 1, name, ...agg, margin, icon: p?.icon ?? null, photo_url: p?.photo_url ?? null }
      })
  }, [sales, products])

  const maxOmzet = topProducts[0]?.omzet ?? 1

  if (loading) return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <Skel h={16} w="40%" />
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2,3].map(i => <Skel key={i} h={48} />)}</div>
    </div>
  )

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>🏅 Top 5 Produk</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Berdasarkan total omzet bulan ini</div>
      </div>
      {topProducts.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Belum ada data penjualan bulan ini</div>
        </div>
      ) : topProducts.map((p, i) => (
        <div key={p.name} style={{ padding: '14px 20px', borderBottom: i < topProducts.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 22, fontSize: 12, fontWeight: 700, color: RANK_COLORS[i], flexShrink: 0, textAlign: 'center' }}>#{p.rank}</div>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--bg-base)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, overflow: 'hidden' }}>
              {p.photo_url ? <img src={p.photo_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.icon ?? '🍽️')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.qty} terjual</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>·</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{formatRupiah(p.omzet, true)}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>·</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: p.margin >= 30 ? '#16A34A' : p.margin >= 15 ? '#D97706' : '#DC2626' }}>Margin {p.margin.toFixed(1)}%</span>
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>{Math.round(p.omzet / maxOmzet * 100)}%</div>
          </div>
          <div style={{ marginLeft: 68, height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${p.omzet / maxOmzet * 100}%`, background: RANK_COLORS[i] ?? '#D92B2B', borderRadius: 99 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Margin Chart ─────────────────────────────────────────────────────────────

function MarginChart({ sales, products, loading }: { sales: SaleRow[]; products: ProductRow[]; loading: boolean }) {
  const data = useMemo(() => {
    const prodLookup: Record<string, ProductRow> = {}
    products.forEach(p => { prodLookup[p.name] = p })

    const map: Record<string, { omzet: number; profit: number }> = {}
    sales.forEach(s => {
      const n = s.product_name ?? '(Tanpa Nama)'
      if (!map[n]) map[n] = { omzet: 0, profit: 0 }
      map[n].omzet  += s.amount
      map[n].profit += s.profit
    })

    return Object.entries(map)
      .map(([name, agg]) => {
        const p = prodLookup[name]
        const margin = p && p.price > 0
          ? (p.price - p.hpp) / p.price * 100
          : agg.omzet > 0 ? agg.profit / agg.omzet * 100 : 0
        return { name: name.length > 14 ? name.slice(0, 13) + '…' : name, margin: Math.round(margin * 10) / 10, omzet: agg.omzet }
      })
      .filter(d => d.omzet > 0)
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 6)
  }, [sales, products])

  const getBarColor = (margin: number) =>
    margin >= 40 ? '#16A34A' : margin >= 25 ? '#65A30D' : margin >= 15 ? '#D97706' : '#DC2626'

  if (loading) return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <div style={{ height: 16, width: '45%', borderRadius: 8, background: 'var(--border)', opacity: 0.5, marginBottom: 16 }} />
      <div style={{ height: 180, borderRadius: 8, background: 'var(--border)', opacity: 0.3 }} />
    </div>
  )

  if (data.length === 0) return null

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2, gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>💹 Margin Per Produk</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Produk paling menguntungkan bulan ini</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {[{ label: '≥40% Bagus', color: '#16A34A' }, { label: '25–40% Oke', color: '#65A30D' }, { label: '<25% Perhatian', color: '#DC2626' }].map(l => (
            <span key={l.label} style={{ fontSize: 10, fontWeight: 600, color: l.color, background: l.color + '15', padding: '2px 7px', borderRadius: 5 }}>{l.label}</span>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <ResponsiveContainer width="100%" height={data.length * 44 + 16}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 52, left: 0, bottom: 0 }} barSize={20}>
            <XAxis type="number" hide domain={[0, 100]} />
            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: 'var(--text-secondary)', fontWeight: 600 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
              formatter={(v: unknown) => [`${v}%`, 'Margin']}
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            />
            <Bar dataKey="margin" radius={[0, 6, 6, 0]}>
              {data.map((d, i) => <Cell key={i} fill={getBarColor(d.margin)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-base)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        💡 <strong style={{ color: 'var(--text-primary)' }}>{data[0]?.name}</strong> margin tertinggi ({data[0]?.margin}%).
        {data.find(d => d.margin < 15) && ` Produk dengan margin di bawah 15% perlu evaluasi harga atau HPP.`}
      </div>
    </div>
  )
}

// ─── Day Heatmap ──────────────────────────────────────────────────────────────

function DayHeatmap({ sales, loading }: { sales: SaleRow[]; loading: boolean }) {
  const data = useMemo(() => {
    const map: Record<number, { omzet: number; count: number }> = {}
    for (let i = 0; i < 7; i++) map[i] = { omzet: 0, count: 0 }
    sales.forEach(s => {
      // date adalah "YYYY-MM-DD", append T00:00:00 agar getDay() pakai local time
      const dow = new Date(s.date + 'T00:00:00').getDay()
      map[dow].omzet += s.amount
      map[dow].count++
    })
    return Array.from({ length: 7 }, (_, i) => ({ day: DAY_NAMES[i], ...map[i] }))
  }, [sales])
  const maxOmzet = Math.max(...data.map(d => d.omzet), 1)
  const hotDay   = data.reduce((a, b) => a.omzet > b.omzet ? a : b)

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>📅 Pola Hari Terlaris</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Distribusi omzet per hari dalam minggu</div>
        </div>
        {hotDay.omzet > 0 && <div style={{ fontSize: 11, fontWeight: 600, color: '#D97706', background: '#FEF3C7', padding: '3px 9px', borderRadius: 6, flexShrink: 0 }}>🔥 {hotDay.day} paling ramai</div>}
      </div>
      <div style={{ marginTop: 16 }}>
        {loading ? <Skel h={80} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {data.map(d => {
              const pct = d.omzet / maxOmzet
              const bg  = pct > 0.7 ? '#D92B2B' : pct > 0.3 ? '#F87171' : pct > 0 ? '#FECACA' : 'var(--border)'
              return (
                <div key={d.day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', height: 48, borderRadius: 8, background: bg, opacity: pct > 0 ? 0.35 + pct * 0.65 : 0.2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {pct > 0.5 && <span style={{ fontSize: 14 }}>🔥</span>}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>{d.day}</div>
                  {d.omzet > 0 && <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>{formatRupiah(d.omzet, true)}</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Hour Heatmap ─────────────────────────────────────────────────────────────
// BUG FIX #5 — `new Date(s.created_at)` tanpa handling timezone bisa salah
// jam di device berbeda. created_at dari Supabase biasanya ISO 8601 UTC
// (e.g. "2026-09-26T03:30:00+00:00"). new Date() akan parse sebagai UTC lalu
// getHours() mengembalikan jam LOCAL — ini sudah benar di semua device karena
// getHours() selalu pakai timezone device. Yang bermasalah adalah jika
// created_at tidak punya timezone suffix (plain "2026-09-26 03:30:00") —
// browser memparsing ini sebagai UTC, sehingga getHours() tetap benar untuk
// WIB (UTC+7) asalkan server menyimpan waktu UTC. Tidak ada perubahan perilaku
// yang diperlukan KECUALI kita ingin force-parse sebagai UTC lalu convert ke
// WIB. Fix preventif: pastikan kita selalu memanggil getHours() pada Date yang
// sudah di-parse dengan benar, dan tambahkan fallback untuk format non-standar.

function HourHeatmap({ sales, loading }: { sales: SaleRow[]; loading: boolean }) {
  const data = useMemo(() => {
    const map: Record<number, number> = {}
    sales.forEach(s => {
      // BUG FIX #5: Supabase timestamps berformat ISO 8601 dengan timezone offset.
      // new Date(isoString).getHours() sudah mengkonversi ke local time — benar.
      // Guard: jika string tidak valid, skip row daripada crash.
      if (!s.created_at) return
      const d = new Date(s.created_at)
      if (isNaN(d.getTime())) return
      const h = d.getHours()
      map[h] = (map[h] ?? 0) + s.amount
    })
    return Array.from({ length: 14 }, (_, i) => {
      const h = i + 7
      return { label: `${String(h).padStart(2,'0')}:00`, omzet: map[h] ?? 0, h }
    })
  }, [sales])
  const maxOmzet = Math.max(...data.map(d => d.omzet), 1)
  const peakHour = data.reduce((a, b) => a.omzet > b.omzet ? a : b)

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>⚡ Jam Tersibuk</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Distribusi omzet per jam (07:00–20:00)</div>
        </div>
        {peakHour.omzet > 0 && <div style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED', background: '#F3E8FF', padding: '3px 9px', borderRadius: 6, flexShrink: 0 }}>⚡ {peakHour.label} paling sibuk</div>}
      </div>
      <div style={{ marginTop: 16 }}>
        {loading ? <Skel h={64} /> : (
          <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 64 }}>
            {data.map(d => {
              const pct = d.omzet / maxOmzet
              const bg  = pct > 0.7 ? '#7C3AED' : pct > 0.3 ? '#A78BFA' : pct > 0 ? '#DDD6FE' : 'var(--border)'
              return (
                <div key={d.h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div title={`${d.label}: ${formatRupiah(d.omzet, true)}`} style={{ width: '100%', height: `${Math.max(pct * 52, pct > 0 ? 6 : 3)}px`, background: bg, borderRadius: '3px 3px 0 0', transition: 'height 0.4s ease', cursor: d.omzet > 0 ? 'pointer' : 'default' }} />
                </div>
              )
            })}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          {['07:00','10:00','13:00','16:00','19:00'].map(l => (
            <span key={l} style={{ fontSize: 9, color: 'var(--text-muted)' }}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Breakdown Donut ──────────────────────────────────────────────────────────

function BreakdownSection({ sales, loading }: { sales: SaleRow[]; loading: boolean }) {
  const data = useMemo(() => {
    let kasir = 0, catering = 0
    sales.forEach(s => { if (s.category === 'Catering') catering += s.amount; else kasir += s.amount })
    const total = kasir + catering
    return [
      { name: 'Kasir',    value: kasir,    pct: total > 0 ? Math.round(kasir / total * 100) : 0 },
      { name: 'Catering', value: catering, pct: total > 0 ? Math.round(catering / total * 100) : 0 },
    ]
  }, [sales])
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Sumber Penjualan</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Kasir vs Catering bulan ini</div>
      {loading ? <Skel h={130} /> : total === 0 ? (
        <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Belum ada data</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <PieChart width={120} height={120}>
              <Pie data={data} dataKey="value" cx={55} cy={55} innerRadius={32} outerRadius={52} paddingAngle={2} startAngle={90} endAngle={450}>
                {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--border)' }} formatter={(v: unknown) => [formatRupiah(v as number), 'Total']} />
            </PieChart>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.map((d, i) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: DONUT_COLORS[i], flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{i === 0 ? '🛒' : '🍱'} {d.name}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{d.pct}%</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
            {data.map((d, i) => (
              <div key={d.name} style={{ background: 'var(--bg-base)', border: `1px solid ${DONUT_COLORS[i]}30`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{i === 0 ? '🛒' : '🍱'} {d.name}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{formatRupiah(d.value, true)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Compare Charts ───────────────────────────────────────────────────────────

// BUG FIX #4 — labelA/labelB (contoh: "September 2026") dipakai langsung
// sebagai `dataKey` di <Line> dan <Bar>. Recharts memetakan dataKey ke property
// object data — jika nama mengandung spasi, browser akan error atau chart kosong
// karena `data[0]["September 2026"]` memang valid di JS, tapi beberapa versi
// recharts gagal memproses nama dengan karakter non-alphanumeric.
// Solusi: gunakan `safeKey()` sebagai dataKey, set `name` prop untuk label
// di Legend & Tooltip, dan build data array dengan key yang sudah di-sanitize.

function CompareDailyTrendChart({ salesA, salesB, monthA, monthB, labelA, labelB, keyA, keyB }: {
  salesA: SaleRow[]; salesB: SaleRow[]
  monthA: string; monthB: string
  labelA: string; labelB: string
  keyA: string; keyB: string  // safe dataKeys
}) {
  const data = useMemo(() => {
    const daysA = new Date(parseInt(monthA.split('-')[0]), parseInt(monthA.split('-')[1]), 0).getDate()
    const daysB = new Date(parseInt(monthB.split('-')[0]), parseInt(monthB.split('-')[1]), 0).getDate()
    const maxDays = Math.max(daysA, daysB)

    const mapA: Record<number, number> = {}
    const mapB: Record<number, number> = {}
    salesA.forEach(s => { const d = parseInt(s.date.split('-')[2]); mapA[d] = (mapA[d] ?? 0) + s.amount })
    salesB.forEach(s => { const d = parseInt(s.date.split('-')[2]); mapB[d] = (mapB[d] ?? 0) + s.amount })

    return Array.from({ length: maxDays }, (_, i) => ({
      hari: i + 1,
      [keyA]: mapA[i + 1] ?? 0,
      [keyB]: mapB[i + 1] ?? 0,
    }))
  }, [salesA, salesB, monthA, monthB, keyA, keyB])

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>📆 Omzet Harian — Overlay</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Pola penjualan per hari dalam bulan · lihat hari mana yang konsisten ramai</div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <XAxis dataKey="hari" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
            tickFormatter={v => v % 5 === 0 || v === 1 ? String(v) : ''} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
            formatter={(v: unknown, key: string) => [formatRupiah(v as number), key === keyA ? labelA : labelB]}
            labelFormatter={v => `Tanggal ${v}`}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(key: string) => key === keyA ? labelA : labelB}
          />
          <Line type="monotone" dataKey={keyA} name={keyA} stroke="#3B82F6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey={keyB} name={keyB} stroke="#F59E0B" strokeWidth={2} dot={false} activeDot={{ r: 4 }} strokeDasharray="4 2" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function CompareRadarChart({ statsA, statsB, labelA, labelB, keyA, keyB }: {
  statsA: { omzet: number; txCount: number; avgPerDay: number; kasir: number; catering: number }
  statsB: { omzet: number; txCount: number; avgPerDay: number; kasir: number; catering: number }
  labelA: string; labelB: string
  keyA: string; keyB: string
}) {
  const data = useMemo(() => {
    const normalize = (a: number, b: number) => {
      const max = Math.max(a, b, 1)
      return { a: Math.round(a / max * 100), b: Math.round(b / max * 100) }
    }
    const omzet    = normalize(statsA.omzet,    statsB.omzet)
    const tx       = normalize(statsA.txCount,   statsB.txCount)
    const avg      = normalize(statsA.avgPerDay, statsB.avgPerDay)
    const kasir    = normalize(statsA.kasir,     statsB.kasir)
    const catering = normalize(statsA.catering,  statsB.catering)
    return [
      { metric: 'Omzet',     [keyA]: omzet.a,    [keyB]: omzet.b },
      { metric: 'Transaksi', [keyA]: tx.a,        [keyB]: tx.b },
      { metric: 'Avg/Hari',  [keyA]: avg.a,       [keyB]: avg.b },
      { metric: 'Kasir',     [keyA]: kasir.a,     [keyB]: kasir.b },
      { metric: 'Catering',  [keyA]: catering.a,  [keyB]: catering.b },
    ]
  }, [statsA, statsB, keyA, keyB])

  if (statsA.omzet === 0 && statsB.omzet === 0) return null

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>🕸️ Performa Multi-Dimensi</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Perbandingan 5 metrik sekaligus — makin luar = makin baik</div>
      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={data}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
          <Radar name={labelA} dataKey={keyA} stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.15} strokeWidth={2} />
          <Radar name={labelB} dataKey={keyB} stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.15} strokeWidth={2} strokeDasharray="4 2" />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--border)' }}
            formatter={(v: unknown, key: string) => [`${v}/100`, key === keyA ? labelA : labelB]} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

function CompareQtyChart({ salesA, salesB, labelA, labelB, keyA, keyB }: {
  salesA: SaleRow[]; salesB: SaleRow[]
  labelA: string; labelB: string
  keyA: string; keyB: string
}) {
  const data = useMemo(() => {
    const mapA: Record<string, number> = {}
    const mapB: Record<string, number> = {}
    salesA.forEach(s => { if (s.product_name) mapA[s.product_name] = (mapA[s.product_name] ?? 0) + (s.qty ?? 0) })
    salesB.forEach(s => { if (s.product_name) mapB[s.product_name] = (mapB[s.product_name] ?? 0) + (s.qty ?? 0) })

    const allNames = Array.from(new Set([...Object.keys(mapA), ...Object.keys(mapB)]))
    return allNames
      .map(name => ({
        name: name.length > 12 ? name.slice(0, 11) + '…' : name,
        [keyA]: mapA[name] ?? 0,
        [keyB]: mapB[name] ?? 0,
      }))
      .filter(d => (d[keyA] as number) + (d[keyB] as number) > 0)
      .sort((a, b) => ((b[keyA] as number) + (b[keyB] as number)) - ((a[keyA] as number) + (a[keyB] as number)))
      .slice(0, 6)
  }, [salesA, salesB, keyA, keyB])

  if (data.length === 0) return null

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>📦 Volume Terjual Per Produk</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Jumlah item terjual — lihat tren permintaan terlepas dari harga</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={3}>
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
            formatter={(v: unknown, key: string) => [`${v} item`, key === keyA ? labelA : labelB]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(key: string) => key === keyA ? labelA : labelB}
          />
          <Bar dataKey={keyA} name={keyA} fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={32} />
          <Bar dataKey={keyB} name={keyB} fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={32} opacity={0.7} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function CompareSourceChart({ statsA, statsB, labelA, labelB }: {
  statsA: { omzet: number; kasir: number; catering: number }
  statsB: { omzet: number; kasir: number; catering: number }
  labelA: string; labelB: string
}) {
  if (statsA.omzet === 0 && statsB.omzet === 0) return null

  const renderDonut = (stats: typeof statsA, label: string, color: string) => {
    const total = stats.kasir + stats.catering
    const donutData = [
      { name: 'Kasir',    value: stats.kasir,    pct: total > 0 ? Math.round(stats.kasir / total * 100) : 0 },
      { name: 'Catering', value: stats.catering, pct: total > 0 ? Math.round(stats.catering / total * 100) : 0 },
    ]
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'white', background: color, padding: '3px 12px', borderRadius: 99, marginBottom: 8 }}>{label}</div>
        {total === 0 ? (
          <div style={{ height: 100, display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Tidak ada data</div>
        ) : (
          <PieChart width={130} height={100}>
            <Pie data={donutData} dataKey="value" cx={60} cy={48} innerRadius={28} outerRadius={44} paddingAngle={2} startAngle={90} endAngle={450}>
              <Cell fill="#D92B2B" />
              <Cell fill="#FBBF24" />
            </Pie>
            <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6 }} formatter={(v: unknown) => [formatRupiah(v as number), '']} />
          </PieChart>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', padding: '0 8px' }}>
          {donutData.map((d, i) => (
            <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: i === 0 ? '#D92B2B' : '#FBBF24' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.name}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>🍩 Sumber Pendapatan — Pergeseran</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Proporsi Kasir vs Catering di kedua bulan</div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'space-around' }}>
        {renderDonut(statsA, labelA, '#3B82F6')}
        <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch' }} />
        {renderDonut(statsB, labelB, '#F59E0B')}
      </div>
    </div>
  )
}

// ─── Compare Section ──────────────────────────────────────────────────────────

function CompareSection({ months }: { months: { value: string; label: string }[] }) {
  const now  = getCurrentMonth()
  const prev = getPrevMonth(now)
  const [monthA, setMonthA] = useState(now)
  const [monthB, setMonthB] = useState(prev)
  const { salesA, salesB, loading } = useCompareData(monthA, monthB)

  const statsA = useMemo(() => aggregateSales(salesA, monthA), [salesA, monthA])
  const statsB = useMemo(() => aggregateSales(salesB, monthB), [salesB, monthB])

  const labelA = months.find(m => m.value === monthA)?.label ?? monthA
  const labelB = months.find(m => m.value === monthB)?.label ?? monthB

  // BUG FIX #4 — safe dataKeys untuk Recharts
  const keyA = safeKey(labelA)
  const keyB = safeKey(labelB)

  // Product delta table
  const productDelta = useMemo(() => {
    const mapA: Record<string, number> = {}
    const mapB: Record<string, number> = {}
    salesA.forEach(s => { if (s.product_name) mapA[s.product_name] = (mapA[s.product_name] ?? 0) + s.amount })
    salesB.forEach(s => { if (s.product_name) mapB[s.product_name] = (mapB[s.product_name] ?? 0) + s.amount })
    const allNames = Array.from(new Set([...Object.keys(mapA), ...Object.keys(mapB)]))
    return allNames
      .map(name => ({ name, omzetA: mapA[name] ?? 0, omzetB: mapB[name] ?? 0, delta: (mapA[name] ?? 0) - (mapB[name] ?? 0) }))
      .filter(p => p.omzetA > 0 || p.omzetB > 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  }, [salesA, salesB])

  // Auto insights
  const insights = useMemo(() => {
    const res: { type: 'good' | 'warn' | 'info'; msg: string }[] = []
    if (statsA.omzet > 0 && statsB.omzet > 0) {
      const pct = (statsA.omzet - statsB.omzet) / statsB.omzet * 100
      if (pct >= 10)  res.push({ type: 'good', msg: `🚀 Omzet naik ${pct.toFixed(1)}% dari ${labelB}. Pertahankan!` })
      else if (pct < -10) res.push({ type: 'warn', msg: `⚠️ Omzet turun ${Math.abs(pct).toFixed(1)}% dari ${labelB}. Perlu evaluasi strategi.` })
      else res.push({ type: 'info', msg: `📊 Omzet relatif stabil (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%). Cari peluang untuk tumbuh lebih.` })
    }
    const bigWinner = productDelta.find(p => p.omzetB > 0 && (p.omzetA - p.omzetB) / p.omzetB > 0.3)
    if (bigWinner) res.push({ type: 'good', msg: `🌟 ${bigWinner.name} naik ${(((bigWinner.omzetA - bigWinner.omzetB) / bigWinner.omzetB) * 100).toFixed(0)}% — produk bintang bulan ini!` })
    const bigLoser  = productDelta.find(p => p.omzetB > 0 && (p.omzetA - p.omzetB) / p.omzetB < -0.3)
    if (bigLoser)  res.push({ type: 'warn', msg: `📉 ${bigLoser.name} turun ${(Math.abs((bigLoser.omzetA - bigLoser.omzetB) / bigLoser.omzetB) * 100).toFixed(0)}% — perlu perhatian atau evaluasi harga.` })
    if (statsA.txCount > statsB.txCount) res.push({ type: 'good', msg: `✅ Jumlah transaksi lebih banyak (${statsA.txCount} vs ${statsB.txCount}). Pelanggan makin aktif!` })
    if (statsA.txCount < statsB.txCount) res.push({ type: 'warn', msg: `⚠️ Jumlah transaksi lebih sedikit (${statsA.txCount} vs ${statsB.txCount}). Coba promo untuk tarik pelanggan.` })
    return res
  }, [statsA, statsB, productDelta, labelB])

  const selStyle: React.CSSProperties = {
    padding: '7px 12px', borderRadius: 10, border: '1px solid var(--border)',
    background: 'var(--bg-surface)', color: 'var(--text-primary)',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none',
  }

  const metricRows = [
    { label: 'Total Omzet',    a: formatRupiah(statsA.omzet, true),          b: formatRupiah(statsB.omzet, true),          numA: statsA.omzet,     numB: statsB.omzet },
    { label: 'Transaksi',      a: `${statsA.txCount} trx`,                   b: `${statsB.txCount} trx`,                   numA: statsA.txCount,   numB: statsB.txCount },
    { label: 'Rata-rata/Hari', a: formatRupiah(statsA.avgPerDay, true),       b: formatRupiah(statsB.avgPerDay, true),       numA: statsA.avgPerDay, numB: statsB.avgPerDay },
    { label: 'Kasir',          a: formatRupiah(statsA.kasir, true),           b: formatRupiah(statsB.kasir, true),           numA: statsA.kasir,     numB: statsB.kasir },
    { label: 'Catering',       a: formatRupiah(statsA.catering, true),        b: formatRupiah(statsB.catering, true),        numA: statsA.catering,  numB: statsB.catering },
    { label: 'Hari Terbaik',   a: statsA.bestDay.label,                       b: statsB.bestDay.label,                       numA: statsA.bestDay.amount, numB: statsB.bestDay.amount },
  ]

  return (
    <div>
      {/* Dropdown pilih bulan */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>⚖️ Bandingkan Bulan</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Pilih dua bulan untuk dibandingkan secara detail</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#3B82F6', flexShrink: 0 }} />
            <select value={monthA} onChange={e => setMonthA(e.target.value)} style={selStyle}>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <span style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 700 }}>vs</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
            <select value={monthB} onChange={e => setMonthB(e.target.value)} style={selStyle}>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Insight cards */}
      {!loading && insights.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {insights.map((ins, i) => (
            <div key={i} style={{
              padding: '12px 16px', borderRadius: 12, fontSize: 13, lineHeight: 1.6, fontWeight: 500,
              background: ins.type === 'good' ? '#DCFCE7' : ins.type === 'warn' ? '#FEF3C7' : '#DBEAFE',
              color:      ins.type === 'good' ? '#14532D' : ins.type === 'warn' ? '#78350F'  : '#1E3A8A',
              border: `1px solid ${ins.type === 'good' ? '#BBF7D0' : ins.type === 'warn' ? '#FDE68A' : '#BFDBFE'}`,
            }}>
              {ins.msg}
            </div>
          ))}
        </div>
      )}

      {/* ── 4 Diagram Compare ── */}
      {!loading && (salesA.length > 0 || salesB.length > 0) && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 0 }} className="compare-chart-2col">
            <CompareDailyTrendChart salesA={salesA} salesB={salesB} monthA={monthA} monthB={monthB} labelA={labelA} labelB={labelB} keyA={keyA} keyB={keyB} />
            <CompareRadarChart statsA={statsA} statsB={statsB} labelA={labelA} labelB={labelB} keyA={keyA} keyB={keyB} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 0 }} className="compare-chart-2col">
            <CompareQtyChart salesA={salesA} salesB={salesB} labelA={labelA} labelB={labelB} keyA={keyA} keyB={keyB} />
            <CompareSourceChart statsA={statsA} statsB={statsB} labelA={labelA} labelB={labelB} />
          </div>
        </>
      )}

      {/* 2 kolom rekap */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }} className="compare-cols">
        {[{ label: labelA, stats: statsA, color: '#3B82F6', loading }, { label: labelB, stats: statsB, color: '#F59E0B', loading }].map(({ label, stats, color, loading: ld }) => (
          <div key={label} style={{ background: 'var(--bg-surface)', border: `2px solid ${color}30`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ background: color, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{label}</span>
              {ld ? null : <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.18)', padding: '2px 9px', borderRadius: 99 }}>
                {formatRupiah(stats.omzet, true)}
              </span>}
            </div>
            <div style={{ padding: '8px 0' }}>
              {ld ? (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[1,2,3,4].map(i => <Skel key={i} h={14} />)}
                </div>
              ) : [
                { label: 'Transaksi',     val: `${stats.txCount} trx` },
                { label: 'Rata-rata/Hari',val: formatRupiah(stats.avgPerDay, true) },
                { label: 'Hari Terbaik',  val: stats.bestDay.label },
                { label: 'Omzet Terbaik', val: stats.bestDay.amount ? formatRupiah(stats.bestDay.amount, true) : '—' },
                { label: 'Kasir',         val: formatRupiah(stats.kasir, true) },
                { label: 'Catering',      val: formatRupiah(stats.catering, true) },
              ].map((row, i, arr) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{row.val}</span>
                </div>
              ))}
            </div>
            {!ld && stats.topProducts.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Top Produk</div>
                {stats.topProducts.slice(0, 3).map((p, i) => (
                  <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i < 2 ? 6 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: RANK_COLORS[i], flexShrink: 0 }}>#{i+1}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>{formatRupiah(p.omzet, true)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tabel perubahan per produk */}
      {!loading && productDelta.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>📊 Perubahan Per Produk</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{labelA} vs {labelB}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px', padding: '8px 20px', background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
            {['Produk', labelA, labelB, 'Perubahan'].map((h, i) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>
          {productDelta.map((p, i) => {
            const pct = p.omzetB > 0 ? ((p.omzetA - p.omzetB) / p.omzetB * 100) : null
            const up  = (pct ?? 0) >= 0
            return (
              <div key={p.name} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px', padding: '11px 20px', borderBottom: i < productDelta.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'transparent' : 'var(--bg-base)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', textAlign: 'right', fontWeight: p.omzetA > 0 ? 600 : 400 }}>{p.omzetA > 0 ? formatRupiah(p.omzetA, true) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right' }}>{p.omzetB > 0 ? formatRupiah(p.omzetB, true) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</div>
                <div style={{ textAlign: 'right' }}>
                  {pct !== null ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: up ? '#16A34A' : '#DC2626', background: up ? '#DCFCE7' : '#FEE2E2', padding: '2px 7px', borderRadius: 5 }}>
                      {up ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', background: '#F3E8FF', padding: '2px 7px', borderRadius: 5 }}>Baru</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Metrik summary table — delta */}
      {!loading && statsA.omzet > 0 && statsB.omzet > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>📋 Ringkasan Delta</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Selisih metrik utama antara dua bulan</div>
          </div>
          {metricRows.map((row, i) => (
            <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px', padding: '11px 20px', borderBottom: i < metricRows.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'transparent' : 'var(--bg-base)', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{row.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#3B82F6', textAlign: 'right' }}>{row.a}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right' }}>{row.b}</div>
              <div style={{ textAlign: 'right' }}><DeltaBadge a={row.numA} b={row.numB} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function AnalitikContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { toast }    = useToast()
  const [mode, setMode] = useState<PageMode>('rekap')

  const months        = getLast12Months()
  const selectedMonth = searchParams.get('month') ?? getCurrentMonth()
  const prevMonth     = getPrevMonth(selectedMonth)
  const trendSales    = useTrendData()
  const { sales, products, loading, error } = useAnalyticsData(selectedMonth)

  // BUG FIX #2 — useEffect untuk prevSales sebelumnya hanya punya [currentStore]
  // sebagai dependency. Tapi `prevMonth` dihitung dari `selectedMonth` (URL param)
  // yang bisa berubah saat user ganti bulan via dropdown. Tanpa `prevMonth` di
  // deps, hero delta tidak terupdate saat bulan diganti.
  const currentStore = useAppStore((s) => s.currentStore)
  const [prevSales, setPrevSales] = useState<SaleRow[]>([])
  useEffect(() => {
    if (!currentStore) return
    const { start, end } = getMonthRange(prevMonth)
    createClient().from('sales').select('amount').eq('store_id', currentStore.id).gte('date', start).lte('date', end)
      .then(({ data }) => setPrevSales((data ?? []) as SaleRow[]))
  }, [currentStore, prevMonth]) // ← prevMonth ditambahkan ke deps

  useEffect(() => { if (error) toast(error, 'error') }, [error, toast])

  function handleMonthChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', value)
    router.push(`/analitik?${params.toString()}`)
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 80px' }} className="analitik-wrap">

        {/* Header bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 10, padding: 3, gap: 2 }}>
            {([['rekap', '📊 Rekap'], ['compare', '⚖️ Bandingkan']] as [PageMode, string][]).map(([val, label]) => (
              <button key={val} onClick={() => setMode(val)} style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                background: mode === val ? '#D92B2B' : 'transparent',
                color:      mode === val ? 'white'   : 'var(--text-muted)',
              }}>{label}</button>
            ))}
          </div>
          <select value={selectedMonth} onChange={e => handleMonthChange(e.target.value)} style={{
            padding: '7px 12px', borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--bg-surface)', color: 'var(--text-primary)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none',
          }}>
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        {/* Hero */}
        <AnalitikHero sales={sales} products={products} selectedMonth={selectedMonth} loading={loading} prevSales={prevSales} />

        {/* KPI */}
        <KpiCards sales={sales} prevSales={prevSales} products={products} loading={loading} />

        {mode === 'rekap' ? (
          <>
            <TrendChart trendSales={trendSales} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="chart-2col">
              <div>
                <TopProductsSection sales={sales} products={products} loading={loading} />
                <MarginChart sales={sales} products={products} loading={loading} />
              </div>
              <div>
                <DayHeatmap sales={sales} loading={loading} />
                <HourHeatmap sales={sales} loading={loading} />
                <BreakdownSection sales={sales} loading={loading} />
              </div>
            </div>
            {!loading && sales.length === 0 && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 24px', textAlign: 'center', marginTop: 16 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Belum cukup data.</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Tidak ada transaksi bulan ini.</div>
                <button onClick={() => router.push('/kasir')} style={{ background: '#D92B2B', color: 'white', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Buka Kasir →</button>
              </div>
            )}
          </>
        ) : (
          <CompareSection months={months} />
        )}

      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .hero-mobile  { display: block; }
        .hero-desktop { display: none; }
        @media (min-width: 768px) {
          .hero-mobile  { display: none; }
          .hero-desktop { display: flex; }
        }

        /* ── TASK 1: KPI Cards Mobile Layout ───────────────────────────────────
           Desktop: 3 kolom sejajar (repeat(3, 1fr))
           Mobile:  2 kolom, card ke-3 (Hari Terbaik) span full width
           Ini mirip pola dashboard card 2+1. ─────────────────────────────── */
        .kpi-3col {
          grid-template-columns: repeat(3, 1fr);
        }
        .kpi-full {
          /* default: tidak full width di desktop */
        }

        @media (max-width: 767px) {
          .analitik-wrap      { padding: 16px 16px 90px !important; }
          .kpi-3col           { grid-template-columns: 1fr 1fr !important; }
          .kpi-full           { grid-column: 1 / -1; }
          .chart-2col         { grid-template-columns: 1fr !important; }
          .compare-cols       { grid-template-columns: 1fr !important; }
          .compare-chart-2col { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .kpi-3col { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}

export default function AnalitikPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 36 }}>⏳</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Memuat analitik...</p>
      </div>
    }>
      <AnalitikContent />
    </Suspense>
  )
}