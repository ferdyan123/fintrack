'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store/appStore'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthSummary {
  month: string       // format: "YYYY-MM"
  label: string       // format: "Sep 2026"
  omzet: number
  pengeluaran: number
  laba: number
}

export interface CompareData {
  monthA: MonthSummary
  monthB: MonthSummary
  delta: {
    omzet: number
    pengeluaran: number
    laba: number
  }
}

export interface TrendData {
  months: MonthSummary[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonthRange(month: string): { start: string; end: string } {
  const [year, mon] = month.split('-').map(Number)
  const start = new Date(year, mon - 1, 1)
  const end   = new Date(year, mon, 0)
  return {
    start: start.toISOString().slice(0, 10),
    end:   end.toISOString().slice(0, 10),
  }
}

function getMonthLabel(month: string): string {
  const [year, mon] = month.split('-').map(Number)
  const d = new Date(year, mon - 1, 1)
  return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
}

function getLast6Months(): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    months.push(`${y}-${m}`)
  }
  return months
}

// ─── Fetch single month summary ───────────────────────────────────────────────

async function fetchMonthSummary(
  storeId: string,
  month: string,
): Promise<MonthSummary> {
  const supabase = createClient()
  const { start, end } = getMonthRange(month)

  const [{ data: salesData }, { data: expData }] = await Promise.all([
    supabase
      .from('sales')
      .select('amount')
      .eq('store_id', storeId)
      .gte('date', start)
      .lte('date', end),
    supabase
      .from('expenses')
      .select('amount')
      .eq('store_id', storeId)
      .gte('date', start)
      .lte('date', end),
  ])

  const omzet       = (salesData ?? []).reduce((s: number, r: { amount: number }) => s + r.amount, 0)
  const pengeluaran = (expData   ?? []).reduce((s: number, r: { amount: number }) => s + r.amount, 0)
  const laba        = omzet - pengeluaran

  return { month, label: getMonthLabel(month), omzet, pengeluaran, laba }
}

// ─── Hook: Compare 2 Bulan ────────────────────────────────────────────────────

export function useCompareData(monthA: string, monthB: string) {
  const currentStore = useAppStore((s) => s.currentStore)

  const [data,    setData]    = useState<CompareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!currentStore) { setLoading(false); return }
    setLoading(true)
    setError(null)

    try {
      const [a, b] = await Promise.all([
        fetchMonthSummary(currentStore.id, monthA),
        fetchMonthSummary(currentStore.id, monthB),
      ])

      setData({
        monthA: a,
        monthB: b,
        delta: {
          omzet:       a.omzet - b.omzet,
          pengeluaran: a.pengeluaran - b.pengeluaran,
          laba:        a.laba - b.laba,
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data perbandingan')
    } finally {
      setLoading(false)
    }
  }, [currentStore, monthA, monthB])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
}

// ─── Hook: Trend 6 Bulan ─────────────────────────────────────────────────────

export function useTrendData() {
  const currentStore = useAppStore((s) => s.currentStore)

  const [data,    setData]    = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!currentStore) { setLoading(false); return }
    setLoading(true)
    setError(null)

    try {
      const months = getLast6Months()

      // Single query: ambil range 6 bulan sekaligus, aggregate di client
      const { start } = getMonthRange(months[0])
      const { end }   = getMonthRange(months[months.length - 1])
      const supabase  = createClient()

      const [{ data: salesData }, { data: expData }] = await Promise.all([
        supabase
          .from('sales')
          .select('amount, date')
          .eq('store_id', currentStore.id)
          .gte('date', start)
          .lte('date', end),
        supabase
          .from('expenses')
          .select('amount, date')
          .eq('store_id', currentStore.id)
          .gte('date', start)
          .lte('date', end),
      ])

      // Aggregate per bulan di client
      const salesMap: Record<string, number>   = {}
      const expMap:   Record<string, number>   = {}

      for (const row of (salesData ?? [])) {
        const month = (row.date as string).slice(0, 7)
        salesMap[month] = (salesMap[month] ?? 0) + row.amount
      }
      for (const row of (expData ?? [])) {
        const month = (row.date as string).slice(0, 7)
        expMap[month] = (expMap[month] ?? 0) + row.amount
      }

      const result: MonthSummary[] = months.map((m) => {
        const omzet       = salesMap[m] ?? 0
        const pengeluaran = expMap[m]   ?? 0
        return { month: m, label: getMonthLabel(m), omzet, pengeluaran, laba: omzet - pengeluaran }
      })

      setData({ months: result })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data tren')
    } finally {
      setLoading(false)
    }
  }, [currentStore])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
}

// ─── getCurrentMonth helper ───────────────────────────────────────────────────

export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function getPrevMonth(month: string): string {
  const [year, mon] = month.split('-').map(Number)
  const d = new Date(year, mon - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
