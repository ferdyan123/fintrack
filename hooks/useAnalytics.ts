'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store/appStore'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SaleRow {
  id: string
  product_id: string | null
  product_name: string | null
  category: string | null
  qty: number
  amount: number
  profit: number
  date: string
  created_at: string
  source: string | null
}

export interface ProductRow {
  id: string
  name: string
  price: number
  hpp: number
  icon: string | null
  photo_url: string | null
}

export interface TopProduct {
  rank: number
  product_name: string
  product_id: string | null
  total_qty: number
  total_omzet: number
  margin_pct: number
  photo_url: string | null
  icon: string | null
  badges: Badge[]
  sparkline: number[] // qty per hari, 7 hari terakhir bulan terpilih
}

export type Badge = '🔥 Hot' | '📉 Turun' | '⭐ Paling Laba'

export interface BreakdownData {
  kasir_total: number
  catering_total: number
  kasir_pct: number
  catering_pct: number
}

export interface SummaryData {
  total_sku: number
  avg_margin_pct: number
  best_day: string | null // format: "Senin, 15 Sep"
  best_day_amount: number
}

export interface AnalyticsData {
  summary: SummaryData
  top_products: TopProduct[]
  breakdown: BreakdownData
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonthRange(month: string): { start: string; end: string } {
  const [year, mon] = month.split('-').map(Number)
  const start = new Date(year, mon - 1, 1)
  const end   = new Date(year, mon, 0) // last day of month
  return {
    start: start.toISOString().slice(0, 10),
    end:   end.toISOString().slice(0, 10),
  }
}

function getWeekIndex(dateStr: string, monthStart: string): number {
  const date  = new Date(dateStr)
  const start = new Date(monthStart)
  const diff  = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.floor(diff / 7)
}

function getLast7DaysOfMonth(month: string): string[] {
  const { end } = getMonthRange(month)
  const endDate = new Date(end)
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(endDate)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

function formatBestDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })
}

// ─── Badge Logic ──────────────────────────────────────────────────────────────
//
// 🔥 Hot   → qty minggu ini > rata-rata qty mingguan bulan ini
// 📉 Turun → qty minggu ini < qty minggu lalu lebih dari 20%
// ⭐ Paling Laba → margin % tertinggi di antara 5 produk (hanya 1 produk)

function computeBadges(
  products: Array<{ product_name: string; margin_pct: number }>,
  weeklyQtyMap: Record<string, number[]>, // product_name → qty per minggu
  currentWeekIdx: number,
): Record<string, Badge[]> {
  const result: Record<string, Badge[]> = {}

  // Temukan margin tertinggi
  const maxMargin = Math.max(...products.map((p) => p.margin_pct))

  for (const p of products) {
    const badges: Badge[] = []
    const weeklyQtys = weeklyQtyMap[p.product_name] ?? []
    const qtyMingguIni  = weeklyQtys[currentWeekIdx]  ?? 0
    const qtyMingguLalu = weeklyQtys[currentWeekIdx - 1] ?? 0

    const totalWeeks   = weeklyQtys.filter((q) => q > 0).length || 1
    const totalQty     = weeklyQtys.reduce((s, q) => s + q, 0)
    const avgMingguan  = totalQty / totalWeeks

    // 🔥 Hot
    if (qtyMingguIni > avgMingguan) badges.push('🔥 Hot')

    // 📉 Turun
    if (
      currentWeekIdx > 0 &&
      qtyMingguLalu > 0 &&
      (qtyMingguLalu - qtyMingguIni) / qtyMingguLalu > 0.2
    ) {
      badges.push('📉 Turun')
    }

    // ⭐ Paling Laba (hanya 1 produk)
    if (p.margin_pct === maxMargin && maxMargin > 0) {
      badges.push('⭐ Paling Laba')
    }

    result[p.product_name] = badges
  }

  return result
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAnalytics(selectedMonth: string) {
  const currentStore = useAppStore((s) => s.currentStore)

  const [data,    setData]    = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!currentStore) { setLoading(false); return }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { start, end } = getMonthRange(selectedMonth)

      // ── Query 1: semua sales bulan terpilih ──────────────────────────────
      const { data: salesData, error: salesErr } = await supabase
        .from('sales')
        .select('id, product_id, product_name, category, qty, amount, profit, date, created_at, source')
        .eq('store_id', currentStore.id)
        .gte('date', start)
        .lte('date', end)

      if (salesErr) throw new Error(salesErr.message)
      const sales: SaleRow[] = salesData ?? []

      // ── Query 2: semua produk (untuk SKU count + hpp/margin) ─────────────
      const { data: productsData, error: productsErr } = await supabase
        .from('products')
        .select('id, name, price, hpp, icon, photo_url')
        .eq('store_id', currentStore.id)

      if (productsErr) throw new Error(productsErr.message)
      const products: ProductRow[] = productsData ?? []

      // ── Aggregate: Top 5 produk ───────────────────────────────────────────
      const productMap: Record<string, {
        product_id: string | null
        total_qty: number
        total_omzet: number
        total_profit: number
        total_amount_for_margin: number
      }> = {}

      for (const s of sales) {
        const name = s.product_name ?? '(Tanpa Nama)'
        if (!productMap[name]) {
          productMap[name] = {
            product_id: s.product_id,
            total_qty: 0, total_omzet: 0,
            total_profit: 0, total_amount_for_margin: 0,
          }
        }
        productMap[name].total_qty    += s.qty ?? 0
        productMap[name].total_omzet  += s.amount ?? 0
        productMap[name].total_profit += s.profit ?? 0
        productMap[name].total_amount_for_margin += s.amount ?? 0
      }

      // Product lookup map untuk foto + hpp
      const productLookup: Record<string, ProductRow> = {}
      for (const p of products) productLookup[p.id] = p

      // Sort by omzet DESC, ambil top 5
      const sorted = Object.entries(productMap)
        .sort((a, b) => b[1].total_omzet - a[1].total_omzet)
        .slice(0, 5)

      // ── Weekly qty per produk (untuk badge) ───────────────────────────────
      const weeklyQtyMap: Record<string, number[]> = {}
      for (const [name] of sorted) weeklyQtyMap[name] = [0, 0, 0, 0, 0]

      for (const s of sales) {
        const name = s.product_name ?? '(Tanpa Nama)'
        if (!weeklyQtyMap[name]) continue
        const wIdx = getWeekIndex(s.date, start)
        if (wIdx >= 0 && wIdx < 5) weeklyQtyMap[name][wIdx] += s.qty ?? 0
      }

      // Current week index
      const today = new Date()
      const monthStart = new Date(start)
      const currentWeekIdx = Math.min(
        Math.floor((today.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24 * 7)),
        4,
      )

      // ── Sparkline: qty per hari, 7 hari terakhir bulan terpilih ─────────
      const last7Days = getLast7DaysOfMonth(selectedMonth)
      const sparklineMap: Record<string, number[]> = {}
      for (const [name] of sorted) sparklineMap[name] = [0, 0, 0, 0, 0, 0, 0]

      for (const s of sales) {
        const name = s.product_name ?? '(Tanpa Nama)'
        if (!sparklineMap[name]) continue
        const dayIdx = last7Days.indexOf(s.date)
        if (dayIdx !== -1) sparklineMap[name][dayIdx] += s.qty ?? 0
      }

      // ── Margin per produk ─────────────────────────────────────────────────
      const topWithMargin = sorted.map(([name, agg]) => {
        const productId   = agg.product_id
        const productInfo = productId ? productLookup[productId] : null

        let margin_pct = 0
        if (productInfo && productInfo.price > 0) {
          margin_pct = ((productInfo.price - productInfo.hpp) / productInfo.price) * 100
        } else if (agg.total_amount_for_margin > 0) {
          // fallback: avg profit / amount
          margin_pct = (agg.total_profit / agg.total_amount_for_margin) * 100
        }

        return {
          product_name: name,
          product_id:   productId,
          total_qty:    agg.total_qty,
          total_omzet:  agg.total_omzet,
          margin_pct,
          photo_url:    productInfo?.photo_url ?? null,
          icon:         productInfo?.icon ?? null,
        }
      })

      // Badge computation
      const badgesMap = computeBadges(topWithMargin, weeklyQtyMap, currentWeekIdx)

      const top_products: TopProduct[] = topWithMargin.map((p, i) => ({
        rank:         i + 1,
        product_name: p.product_name,
        product_id:   p.product_id,
        total_qty:    p.total_qty,
        total_omzet:  p.total_omzet,
        margin_pct:   Math.round(p.margin_pct * 10) / 10,
        photo_url:    p.photo_url,
        icon:         p.icon,
        badges:       badgesMap[p.product_name] ?? [],
        sparkline:    sparklineMap[p.product_name] ?? [0, 0, 0, 0, 0, 0, 0],
      }))

      // ── Summary: SKU count ────────────────────────────────────────────────
      const total_sku = products.length

      // ── Summary: Avg margin toko ──────────────────────────────────────────
      const validMargins = products
        .filter((p) => p.price > 0)
        .map((p) => ((p.price - p.hpp) / p.price) * 100)
      const avg_margin_pct = validMargins.length > 0
        ? validMargins.reduce((s, m) => s + m, 0) / validMargins.length
        : 0

      // ── Summary: Hari terbaik ─────────────────────────────────────────────
      const dayMap: Record<string, number> = {}
      for (const s of sales) {
        dayMap[s.date] = (dayMap[s.date] ?? 0) + s.amount
      }
      const bestDayEntry = Object.entries(dayMap).sort((a, b) => b[1] - a[1])[0]
      const best_day        = bestDayEntry ? formatBestDay(bestDayEntry[0]) : null
      const best_day_amount = bestDayEntry ? bestDayEntry[1] : 0

      // ── Breakdown Kasir vs Catering ───────────────────────────────────────
      let kasir_total = 0
      let catering_total = 0
      for (const s of sales) {
        if (s.category === 'Catering') catering_total += s.amount
        else kasir_total += s.amount
      }
      const total_income = kasir_total + catering_total
      const kasir_pct    = total_income > 0 ? Math.round((kasir_total / total_income) * 100) : 0
      const catering_pct = total_income > 0 ? Math.round((catering_total / total_income) * 100) : 0

      setData({
        summary: { total_sku, avg_margin_pct: Math.round(avg_margin_pct * 10) / 10, best_day, best_day_amount },
        top_products,
        breakdown: { kasir_total, catering_total, kasir_pct, catering_pct },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data analitik')
    } finally {
      setLoading(false)
    }
  }, [currentStore, selectedMonth])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
}
