'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAppStore } from '@/lib/store/appStore'
import { createClient } from '@/lib/supabase/client'
import { pullFromSupabase } from '@/lib/supabase/sync'
import { formatRupiah, formatDate, toISODate } from '@/lib/utils'
import type { Transaction } from '@/types'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Area, AreaChart, Cell, PieChart, Pie
} from 'recharts'

export default function DashboardPage() {
  const currentStore = useAppStore((s) => s.currentStore)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const today = toISODate()

  useEffect(() => {
    if (!currentStore) return
    const load = async () => {
      setLoading(true)
      await pullFromSupabase(currentStore.id)
      const supabase = createClient()
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('store_id', currentStore.id)
        .eq('date', today)
        .order('created_at', { ascending: true })
      setTransactions((data as Transaction[]) ?? [])
      setLoading(false)
    }
    load()
  }, [currentStore?.id])

  // KPI
  const income  = useMemo(() => transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [transactions])
  const expense = useMemo(() => transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [transactions])
  const profit  = income - expense
  const txCount = transactions.filter(t => t.type === 'income').length

  // Grafik per jam — akumulasi omzet tiap jam
  const hourlyData = useMemo(() => {
    const map: Record<number, number> = {}
    transactions
      .filter(t => t.type === 'income')
      .forEach(t => {
        const h = new Date(t.created_at).getHours()
        map[h] = (map[h] ?? 0) + t.amount
      })
    const hours = Array.from({ length: 24 }, (_, i) => i)
      .filter(h => h >= 7 && h <= 21)
    return hours.map(h => ({
      jam: `${String(h).padStart(2, '0')}.00`,
      omzet: map[h] ?? 0,
    }))
  }, [transactions])

  const peakHour = useMemo(() => {
    if (hourlyData.every(d => d.omzet === 0)) return null
    return hourlyData.reduce((a, b) => a.omzet > b.omzet ? a : b)
  }, [hourlyData])

  // Donut per produk
  const productData = useMemo(() => {
    const map: Record<string, { name: string; total: number }> = {}
    transactions
      .filter(t => t.type === 'income' && t.product_name)
      .forEach(t => {
        const key = t.product_name!
        if (!map[key]) map[key] = { name: key, total: 0 }
        map[key].total += t.amount
      })
    const arr = Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5)
    return arr.map(p => ({ ...p, pct: income > 0 ? Math.round((p.total / income) * 100) : 0 }))
  }, [transactions, income])

  const DONUT_COLORS = ['#D92B2B', '#F87171', '#FBBF24', '#A3A3A3', '#BFDBFE']

  // Transaksi terakhir (5 terbaru)
  const recent = useMemo(() =>
    [...transactions].reverse().slice(0, 5),
    [transactions]
  )

  return (
    <div className="page-container">

      {/* Header */}
      <div style={{ padding: '20px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            {currentStore?.name ?? 'FinTrack'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {formatDate(new Date(), 'long')}
          </div>
        </div>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', background: '#D92B2B',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 13, fontWeight: 600,
        }}>
          {currentStore?.name?.[0]?.toUpperCase() ?? 'F'}
        </div>
      </div>

      {/* Hero card */}
      <div style={{
        margin: '16px 16px 0',
        background: 'linear-gradient(135deg, #D92B2B 0%, #B71C1C 100%)',
        borderRadius: 16, padding: '20px', color: 'white',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      }}>
        <div>
          <div style={{ fontSize: 11, opacity: 0.75, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
            Omzet Hari Ini
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.5px', fontFamily: 'Nunito, sans-serif' }}>
            {formatRupiah(income)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            {txCount} transaksi · Est. laba {formatRupiah(profit)}
          </div>
        </div>
        {peakHour && peakHour.omzet > 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.15)', borderRadius: 8,
            padding: '6px 10px', fontSize: 11, color: 'white',
            display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
          }}>
            <span style={{ color: '#86efac' }}>⚡</span> Ramai {peakHour.jam}
          </div>
        )}
      </div>

      {/* KPI 2x2 */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
          Ringkasan
        </div>
        <div className="kpi-grid">
          <KpiCard icon="💸" label="Pengeluaran" value={formatRupiah(expense, true)} color="#FEE2E2" />
          <KpiCard icon="💰" label="Laba Bersih"  value={formatRupiah(profit, true)}  color="#DCFCE7" />
          <KpiCard
            icon="🔥" label="Produk Terlaris"
            value={productData[0]?.name ?? '—'}
            sub={productData[0] ? `${Math.round(productData[0].total / (transactions.find(t => t.product_name === productData[0].name)?.amount ?? 1) || 1)} porsi` : ''}
            color="#FEF3C7"
          />
          <KpiCard icon="🛒" label="Total Transaksi" value={`${txCount} trx`} color="#EDE9FE" />
        </div>
      </div>

      {/* Grafik per jam */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
          Penjualan Per Jam
        </div>
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Omzet masuk per jam</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, marginTop: 2 }}>
            Kumulatif dari setiap transaksi kasir
          </div>
          {peakHour && peakHour.omzet > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: '#FEF3C7', color: '#92400E',
              fontSize: 10, fontWeight: 600, borderRadius: 6, padding: '3px 8px', marginBottom: 12,
            }}>
              ⚡ Jam ramai {peakHour.jam} · {formatRupiah(peakHour.omzet, true)}
            </div>
          )}
          {hourlyData.every(d => d.omzet === 0) ? (
            <EmptyChart label="Belum ada transaksi hari ini" />
          ) : (
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={hourlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#D92B2B" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#D92B2B" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <XAxis dataKey="jam" tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                  interval={2} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                  formatter={(v: unknown) => [formatRupiah(v as number), 'Omzet']}
                  labelStyle={{ color: 'var(--text-muted)', fontSize: 11 }}
                />
                <Area type="monotone" dataKey="omzet" stroke="#D92B2B" strokeWidth={2}
                  fill="url(#redGrad)" dot={{ r: 2, fill: '#D92B2B', strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: '#D92B2B', stroke: 'white', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Donut per produk */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
          Kontribusi Per Produk
        </div>
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Omzet per produk hari ini</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, marginTop: 2 }}>
            Total {formatRupiah(income)}
          </div>
          {productData.length === 0 ? (
            <EmptyChart label="Belum ada data produk" />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flexShrink: 0 }}>
                <PieChart width={110} height={110}>
                  <Pie data={productData} dataKey="total" cx={50} cy={50}
                    innerRadius={30} outerRadius={50} paddingAngle={2} startAngle={90} endAngle={450}>
                    {productData.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--border)' }}
                    formatter={(v: unknown) => [formatRupiah(v as number), 'Omzet']}
                  />
                </PieChart>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {productData.map((p, i) => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
                        {p.name}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{p.pct}%</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatRupiah(p.total, true)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transaksi terakhir */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
          Transaksi Terakhir
        </div>
        {recent.length === 0 ? (
          <div style={{
            background: 'var(--bg-surface)', border: '1px dashed var(--border-strong)',
            borderRadius: 16, padding: '40px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Belum ada transaksi hari ini</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '4px 0 0' }}>Tap + di bawah untuk mulai catat via Kasir</p>
          </div>
        ) : (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            {recent.map((t, i) => (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderBottom: i < recent.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: t.type === 'income' ? '#DCFCE7' : '#FEE2E2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}>
                  {t.type === 'income' ? '🧾' : '💸'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.product_name ?? t.category}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {t.source === 'kasir' ? 'Kasir' : t.source === 'catering' ? '🍱 Catering' : 'Manual'} · {new Date(t.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.type === 'income' ? '#16A34A' : '#DC2626', fontFamily: 'Nunito, sans-serif' }}>
                    {t.type === 'income' ? '+' : '−'}{formatRupiah(t.amount, true)}
                  </div>
                  {t.qty && t.qty > 1 && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>×{t.qty}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string; sub?: string; color: string
}) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: 14,
    }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, marginBottom: 10 }}>
        {icon}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)',
        fontFamily: 'Nunito, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-muted)', fontSize: 13, borderRadius: 10,
      border: '1px dashed var(--border-strong)', background: 'var(--bg-elevated)' }}>
      {label}
    </div>
  )
}