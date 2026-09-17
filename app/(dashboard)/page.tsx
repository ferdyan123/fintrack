'use client'

import { useMemo, useState, useEffect } from 'react'
import { formatRupiah, formatDate, toISODate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store/appStore'
import { useRouter } from 'next/navigation'
import type { Transaction } from '@/types'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'

// ── FAKE DATA — hanya dipakai saat dummy/offline ─────────────────────────────
const TODAY = toISODate()

function makeTime(h: number, m: number) {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

const FAKE_TXS: Transaction[] = [
  { id:'1', store_id:'x', type:'income',  product_id:'p1', product_name:'Lele Goreng',  category:'Penjualan', qty:3, amount:75000,  profit:30000, date:TODAY, source:'kasir',  created_at: makeTime(9,15)  },
  { id:'2', store_id:'x', type:'income',  product_id:'p2', product_name:'Ayam Goreng',  category:'Penjualan', qty:2, amount:60000,  profit:24000, date:TODAY, source:'kasir',  created_at: makeTime(10,30) },
  { id:'3', store_id:'x', type:'expense', product_name:undefined, category:'Bahan Baku',  amount:200000, profit:0, date:TODAY, source:'manual', created_at: makeTime(11,0)  },
  { id:'4', store_id:'x', type:'income',  product_id:'p1', product_name:'Lele Goreng',  category:'Penjualan', qty:5, amount:125000, profit:50000, date:TODAY, source:'kasir',  created_at: makeTime(12,10) },
  { id:'5', store_id:'x', type:'income',  product_id:'p3', product_name:'Nasi Putih',   category:'Penjualan', qty:8, amount:40000,  profit:20000, date:TODAY, source:'kasir',  created_at: makeTime(12,25) },
  { id:'6', store_id:'x', type:'income',  product_id:'p2', product_name:'Ayam Goreng',  category:'Penjualan', qty:4, amount:120000, profit:48000, date:TODAY, source:'kasir',  created_at: makeTime(12,55) },
  { id:'7', store_id:'x', type:'income',  product_id:'p4', product_name:'Es Teh',       category:'Penjualan', qty:10,amount:50000,  profit:30000, date:TODAY, source:'kasir',  created_at: makeTime(13,20) },
  { id:'8', store_id:'x', type:'income',  product_id:'p1', product_name:'Lele Goreng',  category:'Penjualan', qty:4, amount:100000, profit:40000, date:TODAY, source:'kasir',  created_at: makeTime(14,5)  },
  { id:'9', store_id:'x', type:'expense', product_name:undefined, category:'Gas & Energi', amount:50000, profit:0, date:TODAY, source:'manual', created_at: makeTime(14,30) },
  { id:'10',store_id:'x', type:'income',  product_id:'p3', product_name:'Nasi Putih',   category:'Penjualan', qty:6, amount:30000,  profit:15000, date:TODAY, source:'kasir',  created_at: makeTime(15,45) },
]

const DONUT_COLORS = ['#D92B2B','#F87171','#FBBF24','#A3A3A3','#BFDBFE']

export default function DashboardPage() {
  const currentStore = useAppStore((s) => s.currentStore)
  const router       = useRouter()

  const isDummy    = !currentStore || currentStore.id === 'dummy-store-001'
  const isOffline  = typeof navigator !== 'undefined' && !navigator.onLine
  const skipSupabase = isDummy || isOffline

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading,      setLoading]      = useState(!skipSupabase)

  useEffect(() => {
    if (skipSupabase) {
      setTransactions(FAKE_TXS)
      setLoading(false)
      return
    }

    const load = async () => {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('store_id', currentStore!.id)
        .eq('date', toISODate())
        .order('created_at', { ascending: false })
        .limit(200)
      setTransactions((data as Transaction[]) ?? [])
      setLoading(false)
    }
    load()
  }, [currentStore?.id, skipSupabase]) // eslint-disable-line react-hooks/exhaustive-deps

  const income  = useMemo(() => transactions.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0), [transactions])
  const expense = useMemo(() => transactions.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0), [transactions])
  const profit  = income - expense
  const txCount = transactions.filter(t => t.type === 'income').length

  // Per-jam (income only)
  const hourlyData = useMemo(() => {
    const map: Record<number,number> = {}
    transactions.filter(t => t.type === 'income').forEach(t => {
      const h = new Date(t.created_at).getHours()
      map[h] = (map[h] ?? 0) + t.amount
    })
    return Array.from({length:14},(_,i)=>i+8).map(h=>({
      jam: `${String(h).padStart(2,'0')}.00`,
      omzet: map[h] ?? 0,
    }))
  }, [transactions])

  const peakHour = useMemo(() =>
    hourlyData.every(d=>d.omzet===0) ? null :
    hourlyData.reduce((a,b) => a.omzet>b.omzet ? a : b)
  ,[hourlyData])

  // Per-produk
  const productData = useMemo(() => {
    const map: Record<string,number> = {}
    transactions.filter(t => t.type==='income' && t.product_name).forEach(t => {
      map[t.product_name!] = (map[t.product_name!] ?? 0) + t.amount
    })
    return Object.entries(map)
      .sort((a,b)=>b[1]-a[1]).slice(0,5)
      .map(([name,total])=>({ name, total, pct: income > 0 ? Math.round((total/income)*100) : 0 }))
  }, [transactions, income])

  const recent = useMemo(() => [...transactions].slice(0, 5), [transactions])

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:12 }}>
        <div style={{ fontSize:36 }}>⏳</div>
        <p style={{ color:'#B08080', fontSize:14 }}>Memuat data hari ini...</p>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
    <div style={{
      maxWidth: 1100, margin: '0 auto',
      padding: '24px 24px 80px',
    }} className="dash-wrap">

      {/* Hero */}
      <div style={{
        background: '#D92B2B',
        borderRadius: 16, padding: '24px 28px',
        color: 'white', marginBottom: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 11, opacity: 0.75, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>Omzet Hari Ini</div>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily:'Nunito,sans-serif', letterSpacing:'-0.5px' }}>{formatRupiah(income)}</div>
          <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
            {txCount} transaksi · Laba {formatRupiah(profit)}
            {isDummy && <span style={{ marginLeft: 8, background:'rgba(255,255,255,0.2)', borderRadius:6, padding:'2px 7px', fontSize:11 }}>Demo</span>}
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>{formatDate(new Date(),'long')}</div>
          {peakHour && (
            <div style={{ background:'rgba(255,255,255,0.18)', borderRadius:8, padding:'6px 12px', fontSize:12, display:'inline-flex', alignItems:'center', gap:5 }}>
              ⚡ Ramai {peakHour.jam} · {formatRupiah(peakHour.omzet, true)}
            </div>
          )}
        </div>
      </div>

      {/* KPI 4 col */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }} className="kpi-4col">
        <KpiCard icon="💰" bg="#DCFCE7" label="Pemasukan"       value={formatRupiah(income,true)}  delta={`${txCount} transaksi`}             deltaColor="#16A34A" />
        <KpiCard icon="💸" bg="#FEE2E2" label="Pengeluaran"     value={formatRupiah(expense,true)} delta={`${transactions.filter(t=>t.type==='expense').length} pos biaya`} deltaColor="#DC2626"
          onClick={() => router.push('/pengeluaran')} />
        <KpiCard icon="📈" bg="#DBEAFE" label="Laba Bersih"     value={formatRupiah(profit,true)}  delta={income > 0 ? `Margin ${Math.round((profit/income)*100)}%` : '—'}  deltaColor="#2563EB" />
        <KpiCard icon="🛒" bg="#F3E8FF" label="Produk Terlaris" value={productData[0]?.name ?? '—'} delta={productData[0] ? formatRupiah(productData[0].total,true) : 'Belum ada'} deltaColor="#7C3AED" />
      </div>

      {/* Chart row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }} className="chart-2col">

        {/* Area chart per jam */}
        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, padding:20 }}>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', marginBottom:2 }}>Penjualan Per Jam</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:14 }}>Omzet masuk tiap jam</div>
          {peakHour && (
            <div style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#FEF3C7', color:'#92400E', fontSize:11, fontWeight:600, borderRadius:6, padding:'3px 8px', marginBottom:12 }}>
              ⚡ Jam ramai {peakHour.jam} · {formatRupiah(peakHour.omzet,true)}
            </div>
          )}
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={hourlyData} margin={{top:4,right:4,left:0,bottom:0}}>
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#D92B2B" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#D92B2B" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="jam" tick={{fontSize:9,fill:'#B08080'}} interval={2} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip
                contentStyle={{fontSize:12,borderRadius:8,border:'1px solid var(--border)'}}
                formatter={(v:unknown)=>[formatRupiah(v as number),'Omzet']}
                labelStyle={{color:'#B08080',fontSize:11}}
              />
              <Area type="monotone" dataKey="omzet" stroke="#D92B2B" strokeWidth={2} fill="url(#rg)"
                dot={{r:2,fill:'#D92B2B',strokeWidth:0}}
                activeDot={{r:4,fill:'#D92B2B',stroke:'white',strokeWidth:2}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Donut per produk */}
        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, padding:20 }}>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', marginBottom:2 }}>Kontribusi Per Produk</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:14 }}>Omzet per produk hari ini · {formatRupiah(income,true)}</div>
          {productData.length === 0 ? (
            <div style={{ height:140, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', fontSize:13 }}>Belum ada data penjualan</div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:20 }}>
              <PieChart width={120} height={140}>
                <Pie data={productData} dataKey="total" cx={55} cy={65}
                  innerRadius={34} outerRadius={54} paddingAngle={2} startAngle={90} endAngle={450}>
                  {productData.map((_,i) => <Cell key={i} fill={DONUT_COLORS[i%DONUT_COLORS.length]}/>)}
                </Pie>
                <Tooltip contentStyle={{fontSize:11,borderRadius:8}} formatter={(v:unknown)=>[formatRupiah(v as number),'Omzet']}/>
              </PieChart>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10 }}>
                {productData.map((p,i)=>(
                  <div key={p.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                      <div style={{ width:9, height:9, borderRadius:'50%', background:DONUT_COLORS[i%DONUT_COLORS.length], flexShrink:0 }}/>
                      <span style={{ fontSize:12, color:'var(--text-secondary)', maxWidth:90, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{p.pct}%</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)' }}>{formatRupiah(p.total,true)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transaksi terakhir */}
      <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ padding:'16px 20px 12px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--border)' }}>
          <span style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>Transaksi Hari Ini</span>
          <span
            style={{ fontSize:12, color:'var(--accent)', fontWeight:600, cursor:'pointer' }}
            onClick={() => router.push('/riwayat')}
          >
            Lihat semua
          </span>
        </div>
        {recent.length === 0 ? (
          <div style={{ padding:'32px 20px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
            Belum ada transaksi hari ini
          </div>
        ) : recent.map((t,i)=>(
          <div key={t.id} style={{
            display:'flex', alignItems:'center', gap:12, padding:'12px 20px',
            borderBottom: i < recent.length-1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ width:36, height:36, borderRadius:10, flexShrink:0, fontSize:16,
              background: t.type==='income' ? 'var(--success-bg)' : 'var(--danger-bg)',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              {t.type==='income' ? '🧾' : '💸'}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {t.product_name ?? t.category}
              </div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>
                {t.type==='expense' ? `💸 ${t.category}` : t.source==='kasir' ? 'Kasir' : t.source==='catering' ? '🍱 Catering' : 'Manual'}
                {' · '}{new Date(t.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}
                {t.qty && t.qty > 1 ? ` · ×${t.qty}` : ''}
              </div>
            </div>
            <div style={{ fontSize:14, fontWeight:600, fontFamily:'Nunito,sans-serif', flexShrink:0,
              color: t.type==='income' ? 'var(--success)' : 'var(--danger)' }}>
              {t.type==='income' ? '+' : '−'}{formatRupiah(t.amount,true)}
            </div>
          </div>
        ))}
      </div>

    </div>

    <style>{`
      @media (max-width: 767px) {
        .dash-wrap { padding: 16px 16px 90px !important; }
        .kpi-4col  { grid-template-columns: 1fr 1fr !important; }
        .chart-2col{ grid-template-columns: 1fr !important; }
      }
      @media (min-width: 768px) and (max-width: 1023px) {
        .kpi-4col { grid-template-columns: repeat(2,1fr) !important; }
      }
    `}</style>
    </div>
  )
}

function KpiCard({ icon, bg, label, value, delta, deltaColor, onClick }: {
  icon:string; bg:string; label:string; value:string; delta:string; deltaColor:string; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background:'var(--bg-surface)', border:'1px solid var(--border)',
        borderRadius:14, padding:16,
        cursor: onClick ? 'pointer' : 'default',
        transition: onClick ? 'transform 0.12s, box-shadow 0.12s' : undefined,
      }}
      onMouseEnter={(e) => { if (onClick) { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)' } }}
      onMouseLeave={(e) => { if (onClick) { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '' } }}
    >
      <div style={{ width:32, height:32, borderRadius:9, background:bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, marginBottom:12 }}>{icon}</div>
      <div style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', fontFamily:'Nunito,sans-serif', letterSpacing:'-0.3px', marginBottom:2 }}>{value}</div>
      <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:11, fontWeight:600, color:deltaColor }}>{delta}</div>
    </div>
  )
}