'use client'

import { useMemo, useState } from 'react'
import { formatRupiah, toISODate } from '@/lib/utils'
import type { Transaction } from '@/types'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'

const TODAY = toISODate()
function makeTime(h: number, m: number) {
  const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString()
}

const FAKE_TXS: Transaction[] = [
  { id:'1',  store_id:'x', type:'income',  product_id:'p1', product_name:'Lele Goreng',  category:'Penjualan',    qty:3,  amount:75000,  profit:30000, date:TODAY, source:'kasir',  created_at:makeTime(9,15)  },
  { id:'2',  store_id:'x', type:'income',  product_id:'p2', product_name:'Ayam Goreng',  category:'Penjualan',    qty:2,  amount:60000,  profit:24000, date:TODAY, source:'kasir',  created_at:makeTime(10,30) },
  { id:'3',  store_id:'x', type:'expense', product_id:undefined, product_name:undefined, category:'Bahan Baku',   qty:1,  amount:200000, profit:0,     date:TODAY, source:'manual', created_at:makeTime(11,0)  },
  { id:'4',  store_id:'x', type:'income',  product_id:'p1', product_name:'Lele Goreng',  category:'Penjualan',    qty:5,  amount:125000, profit:50000, date:TODAY, source:'kasir',  created_at:makeTime(12,10) },
  { id:'5',  store_id:'x', type:'income',  product_id:'p3', product_name:'Nasi Putih',   category:'Penjualan',    qty:8,  amount:40000,  profit:20000, date:TODAY, source:'kasir',  created_at:makeTime(12,25) },
  { id:'6',  store_id:'x', type:'income',  product_id:'p2', product_name:'Ayam Goreng',  category:'Penjualan',    qty:4,  amount:120000, profit:48000, date:TODAY, source:'kasir',  created_at:makeTime(12,55) },
  { id:'7',  store_id:'x', type:'income',  product_id:'p4', product_name:'Es Teh',       category:'Penjualan',    qty:10, amount:50000,  profit:30000, date:TODAY, source:'kasir',  created_at:makeTime(13,20) },
  { id:'8',  store_id:'x', type:'income',  product_id:'p1', product_name:'Lele Goreng',  category:'Penjualan',    qty:4,  amount:100000, profit:40000, date:TODAY, source:'kasir',  created_at:makeTime(14,5)  },
  { id:'9',  store_id:'x', type:'expense', product_id:undefined, product_name:undefined, category:'Gas & Energi', qty:1,  amount:50000,  profit:0,     date:TODAY, source:'manual', created_at:makeTime(14,30) },
  { id:'10', store_id:'x', type:'income',  product_id:'p3', product_name:'Nasi Putih',   category:'Penjualan',    qty:6,  amount:30000,  profit:15000, date:TODAY, source:'kasir',  created_at:makeTime(15,45) },
]

const PAYMENT_DATA = [
  { method: 'Tunai / Cash', jumlah: 24 },
  { method: 'QRIS',         jumlah: 8  },
]

const DONUT_COLORS = ['#D92B2B','#F87171','#FBBF24','#A3A3A3','#BFDBFE']
const STORE_NAME = 'Lesehan Nong Ena'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
}

function getNarasi(income: number, expense: number, txCount: number, topProduct?: string): { text: string; emoji: string } {
  const profit = income - expense
  if (income === 0) return { emoji: '💪', text: 'Belum ada transaksi tercatat hari ini. Yuk mulai catat penjualan pertama!' }
  if (profit < 0) return { emoji: '📊', text: `Pemasukan hari ini sudah ${formatRupiah(income, true)}, tapi pengeluaran masih lebih besar. Pantau terus ya!` }
  if (txCount >= 8) return { emoji: '🚀', text: `Luar biasa! Sudah ${txCount} transaksi hari ini dengan omzet ${formatRupiah(income, true)} dan laba bersih ${formatRupiah(profit, true)}.${topProduct ? ` ${topProduct} jadi bintangnya!` : ''}` }
  return { emoji: '🎉', text: `Omzet hari ini ${formatRupiah(income, true)} dengan laba bersih ${formatRupiah(profit, true)}. ${topProduct ? `Produk terlaris: ${topProduct}.` : ''} Pertahankan!` }
}

export default function DashboardPage() {
  const transactions = FAKE_TXS
  const [showAll, setShowAll] = useState(false)

  const income  = useMemo(() => transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0), [transactions])
  const expense = useMemo(() => transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0), [transactions])
  const profit  = income - expense
  const txCount = transactions.filter(t=>t.type==='income').length

  const hourlyData = useMemo(()=>{
    const map: Record<number,number> = {}
    transactions.filter(t=>t.type==='income').forEach(t=>{
      const h = new Date(t.created_at).getHours()
      map[h] = (map[h]??0)+t.amount
    })
    return Array.from({length:14},(_,i)=>i+8).map(h=>({
      jam:`${String(h).padStart(2,'0')}.00`, omzet:map[h]??0,
    }))
  },[transactions])

  const peakHour = useMemo(()=>
    hourlyData.every(d=>d.omzet===0) ? null :
    hourlyData.reduce((a,b)=>a.omzet>b.omzet?a:b)
  ,[hourlyData])

  const productData = useMemo(()=>{
    const map: Record<string,number> = {}
    transactions.filter(t=>t.type==='income'&&t.product_name).forEach(t=>{
      map[t.product_name!]=(map[t.product_name!]??0)+t.amount
    })
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5)
      .map(([name,total])=>({ name, total, pct:Math.round((total/income)*100) }))
  },[transactions,income])

  const displayedTx = showAll ? [...transactions].reverse() : [...transactions].reverse().slice(0,5)
  const narasi = getNarasi(income, expense, txCount, productData[0]?.name)

  const now = new Date()
  const dateLabel = now.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
  const monthLabel = now.toLocaleDateString('id-ID',{month:'long',year:'numeric'})

  return (
    <div style={{background:'#FAFAFA',minHeight:'100vh'}}>
    <div style={{maxWidth:1100,margin:'0 auto',padding:'24px 24px 80px'}} className="dash-wrap">

      {/* ── HERO CARD ── */}
      <div style={{
        background:'linear-gradient(135deg,#D92B2B 0%,#B71C1C 100%)',
        borderRadius:20,padding:'22px 26px',color:'white',
        marginBottom:20,position:'relative',overflow:'hidden',
        boxShadow:'0 4px 24px rgba(217,43,43,0.25)',
      }}>
        {/* Dekorasi lingkaran */}
        <div style={{position:'absolute',top:-45,right:-45,width:190,height:190,borderRadius:'50%',background:'rgba(255,255,255,0.07)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',bottom:-65,left:20,width:160,height:160,borderRadius:'50%',background:'rgba(255,255,255,0.05)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',top:30,right:200,width:70,height:70,borderRadius:'50%',background:'rgba(255,255,255,0.04)',pointerEvents:'none'}}/>

        <div style={{position:'relative',zIndex:1}}>
          {/* Row 1: nama toko + badge */}
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:36,height:36,borderRadius:10,background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>🍽️</div>
              <div>
                <div style={{fontSize:16,fontWeight:800,letterSpacing:'-0.2px'}}>{STORE_NAME}</div>
                <div style={{fontSize:11,opacity:0.75,marginTop:2}}>{dateLabel}</div>
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6}}>
              {/* Desktop: bulan saja di kanan */}
              <div className="badge-desktop-only" style={{background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:999,padding:'4px 12px',fontSize:12,fontWeight:600}}>{monthLabel}</div>
              {peakHour && peakHour.omzet>0 && (
                <div className="badge-desktop-only" style={{background:'rgba(255,255,255,0.15)',borderRadius:8,padding:'4px 10px',fontSize:11,display:'flex',alignItems:'center',gap:4}}>
                  ⚡ Ramai {peakHour.jam} · {formatRupiah(peakHour.omzet,true)}
                </div>
              )}
            </div>
          </div>

          {/* Mobile only: ramai kiri + bulan kanan — row terpisah */}
          <div className="badge-mobile-row" style={{alignItems:'center',gap:8,marginBottom:12}}>
            {peakHour && peakHour.omzet>0 && (
              <div style={{background:'rgba(255,255,255,0.18)',borderRadius:8,padding:'4px 10px',fontSize:11,display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                ⚡ Ramai {peakHour.jam} · {formatRupiah(peakHour.omzet,true)}
              </div>
            )}
            <div style={{marginLeft:'auto',background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:999,padding:'4px 12px',fontSize:11,fontWeight:600,flexShrink:0,whiteSpace:'nowrap'}}>{monthLabel}</div>
          </div>

          {/* Row 2: narasi kiri + omzet kanan — DESKTOP hanya */}
          <div className="hero-row-desktop" style={{display:'flex',alignItems:'center',gap:16}}>
            <div style={{
              flex:1,background:'rgba(255,255,255,0.12)',
              border:'1px solid rgba(255,255,255,0.15)',
              borderRadius:12,padding:'12px 16px',
              fontSize:13,lineHeight:1.6,color:'rgba(255,255,255,0.92)',
            }}>
              {narasi.emoji} {narasi.text}
            </div>
            <div style={{
              flexShrink:0,width:220,
              display:'flex',flexDirection:'column',
              alignItems:'center',justifyContent:'center',
              textAlign:'center',
              borderLeft:'1px solid rgba(255,255,255,0.15)',
              paddingLeft:20,
            }}>
              <div style={{fontSize:10,opacity:0.65,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>Omzet Hari Ini</div>
              <div style={{fontSize:30,fontWeight:800,fontFamily:'Nunito,sans-serif',letterSpacing:'-0.5px',lineHeight:1.1}}>{formatRupiah(income)}</div>
              <div style={{fontSize:11,opacity:0.7,marginTop:8}}>{txCount} trx · laba {formatRupiah(profit)}</div>
            </div>
          </div>

          {/* Row 2 MOBILE: hanya narasi, tanpa omzet */}
          <div className="hero-row-mobile">
            <div style={{
              background:'rgba(255,255,255,0.12)',
              border:'1px solid rgba(255,255,255,0.15)',
              borderRadius:12,padding:'11px 14px',
              fontSize:12,lineHeight:1.6,color:'rgba(255,255,255,0.92)',
            }}>
              {narasi.emoji} {narasi.text}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI 4 COL ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}} className="kpi-4col">
        <KpiCard icon="💰" bg="#DCFCE7" label="Pemasukan"       value={formatRupiah(income,true)}  delta="+12% vs kemarin" dc="#16A34A" accent="#34d399"/>
        <KpiCard icon="💸" bg="#FEE2E2" label="Pengeluaran"     value={formatRupiah(expense,true)} delta="+8% vs kemarin"  dc="#DC2626" accent="#f87171"/>
        <KpiCard icon="📈" bg="#DBEAFE" label="Laba Bersih"     value={formatRupiah(profit,true)}  delta="+18% vs kemarin" dc="#2563EB" accent="#60a5fa"/>
        <KpiCard icon="🛒" bg="#F3E8FF" label="Total Transaksi" value={`${txCount} trx`} delta={productData[0]?.name?`🔥 ${productData[0].name}`:'—'} dc="#7C3AED" accent="#a78bfa"/>
      </div>

      {/* ── ROW 1: Area chart + Donut — side by side ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}} className="chart-2col chart-consistent">

        {/* Area chart per jam */}
        <div style={{background:'#fff',border:'1px solid #F0E0E0',borderRadius:14,padding:20,boxSizing:'border-box'}} className="chart-card-mobile">
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16}}>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:'#1A0A0A',marginBottom:2}}>Penjualan Per Jam</div>
              <div style={{fontSize:12,color:'#B08080'}}>Omzet masuk tiap jam</div>
            </div>
            {peakHour && peakHour.omzet>0 && (
              <div style={{background:'#FEF3C7',color:'#92400E',fontSize:11,fontWeight:600,borderRadius:8,padding:'5px 10px',whiteSpace:'nowrap',flexShrink:0}}>
                ⚡ {peakHour.jam} · {formatRupiah(peakHour.omzet,true)}
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={155}>
            <AreaChart data={hourlyData} margin={{top:4,right:4,left:0,bottom:0}}>
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#D92B2B" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#D92B2B" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="jam" tick={{fontSize:9,fill:'#B08080'}} interval={2} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip contentStyle={{fontSize:12,borderRadius:8,border:'1px solid #F0E0E0',background:'#fff'}}
                formatter={(v:unknown)=>[formatRupiah(v as number),'Omzet']} labelStyle={{color:'#B08080',fontSize:11}}/>
              <Area type="monotone" dataKey="omzet" stroke="#D92B2B" strokeWidth={2} fill="url(#rg)"
                dot={{r:2,fill:'#D92B2B',strokeWidth:0}} activeDot={{r:4,fill:'#D92B2B',stroke:'white',strokeWidth:2}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Donut per produk */}
        <div style={{background:'#fff',border:'1px solid #F0E0E0',borderRadius:14,padding:20,boxSizing:'border-box'}} className="chart-card-mobile">
          <div style={{fontSize:14,fontWeight:700,color:'#1A0A0A',marginBottom:2}}>Kontribusi Per Produk</div>
          <div style={{fontSize:12,color:'#B08080',marginBottom:16}}>Omzet per produk · {formatRupiah(income,true)}</div>
          {productData.length===0 ? (
            <div style={{height:155,display:'flex',alignItems:'center',justifyContent:'center',color:'#B08080',fontSize:13}}>Belum ada data</div>
          ):(
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:12,marginTop:18}}>
              <div style={{flexShrink:0}}>
                <PieChart width={140} height={150}>
                  <Pie data={productData} dataKey="total" cx={65} cy={70}
                    innerRadius={36} outerRadius={58} paddingAngle={2} startAngle={90} endAngle={450}>
                    {productData.map((_,i)=><Cell key={i} fill={DONUT_COLORS[i%DONUT_COLORS.length]}/>)}
                  </Pie>
                  <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #F0E0E0'}} formatter={(v:unknown)=>[formatRupiah(v as number),'Omzet']}/>
                </PieChart>
              </div>
              <div style={{display:'flex',flexDirection:'column',justifyContent:'center',gap:7,paddingRight:12}}>
                {productData.map((p,i)=>(
                  <div key={p.name} style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:9,height:9,borderRadius:'50%',background:DONUT_COLORS[i%DONUT_COLORS.length],flexShrink:0}}/>
                    <span style={{fontSize:11,color:'#1A0A0A',whiteSpace:'nowrap'}}>{p.name}</span>
                    <span style={{fontSize:11,color:'#B08080',whiteSpace:'nowrap'}}>— {formatRupiah(p.total,true)}</span>
                    <span style={{fontSize:11,fontWeight:700,color:'#D92B2B',whiteSpace:'nowrap'}}>{p.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 2: Bar chart metode pembayaran ── */}
      <div style={{background:'#fff',border:'1px solid #F0E0E0',borderRadius:14,padding:20,marginBottom:20}}>
        <div style={{fontSize:14,fontWeight:700,color:'#1A0A0A',marginBottom:2}}>Metode Pembayaran</div>
        <div style={{fontSize:12,color:'#B08080',marginBottom:16}}>Jumlah transaksi per metode hari ini</div>
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {PAYMENT_DATA.map((item,i)=>{
            const maxVal = Math.max(...PAYMENT_DATA.map(d=>d.jumlah))
            const pct = (item.jumlah/maxVal)*100
            const opacity = 1 - i*0.18
            return (
              <div key={item.method}>
                <div style={{fontSize:12,fontWeight:500,color:'#6B3030',marginBottom:6}}>{item.method}</div>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div style={{flex:1,height:18,background:'#FEF2F2',borderRadius:'0 6px 6px 0',overflow:'hidden'}}>
                    <div style={{width:`${pct}%`,height:'100%',background:`rgba(217,43,43,${opacity})`,borderRadius:'0 6px 6px 0',transition:'width 0.3s'}}/>
                  </div>
                  <div style={{fontSize:12,fontWeight:700,color:'#1A0A0A',whiteSpace:'nowrap',minWidth:40}}>{item.jumlah} trx</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── TRANSAKSI ── */}
      <div style={{background:'#fff',border:'1px solid #F0E0E0',borderRadius:14,overflow:'hidden'}}>
        <div style={{padding:'16px 20px 12px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #F9F0F0'}}>
          <span style={{fontSize:14,fontWeight:700,color:'#1A0A0A'}}>Transaksi Terakhir</span>
          <button onClick={()=>setShowAll(v=>!v)} style={{fontSize:12,color:'#D92B2B',fontWeight:600,background:'none',border:'none',cursor:'pointer'}}>
            {showAll?'Sembunyikan ↑':`Lihat semua (${transactions.length}) →`}
          </button>
        </div>
        {displayedTx.map((t,i)=>(
          <div key={t.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 20px',borderBottom:i<displayedTx.length-1?'1px solid #F9F0F0':'none'}}>
            <div style={{width:38,height:38,borderRadius:11,flexShrink:0,fontSize:16,
              background:t.type==='income'?'#DCFCE7':'#FEE2E2',
              display:'flex',alignItems:'center',justifyContent:'center'}}>
              {t.type==='income'?'🧾':'💸'}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:'#1A0A0A',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {t.product_name??t.category}
              </div>
              <div style={{fontSize:11,color:'#B08080',marginTop:1}}>
                {t.source==='kasir'?'Kasir':t.source==='catering'?'🍱 Catering':'Manual'} · {new Date(t.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}
                {t.qty&&t.qty>1?` · ×${t.qty}`:''}
              </div>
            </div>
            <div style={{fontSize:14,fontWeight:700,fontFamily:'Nunito,sans-serif',flexShrink:0,color:t.type==='income'?'#16A34A':'#DC2626'}}>
              {t.type==='income'?'+':'−'}{formatRupiah(t.amount,true)}
            </div>
          </div>
        ))}
      </div>

    </div>

    <style>{`
      /* ── DESKTOP ── */
      .hero-row-desktop  { display:flex; }
      .hero-row-mobile   { display:none; }
      .badge-desktop-only{ display:block; }
      .badge-mobile-row  { display:none; }

      /* ── MOBILE ── */
      @media (max-width:767px) {
        .dash-wrap         { padding:16px 16px 90px !important; }
        .kpi-4col          { grid-template-columns:1fr 1fr !important; }
        .chart-2col        { grid-template-columns:1fr !important; }
        .hero-row-desktop  { display:none !important; }
        .hero-row-mobile   { display:block !important; }
        .badge-desktop-only{ display:none !important; }
        .badge-mobile-row  { display:flex !important; }
        /* Mobile: samakan tinggi chart card dengan metode pembayaran */
        .chart-card-mobile {
          height: 230px !important;
          overflow: hidden;
        }
      }
      @media (min-width:768px) and (max-width:1023px) {
        .kpi-4col { grid-template-columns:repeat(2,1fr) !important; }
      }
    `}</style>
    </div>
  )
}

function KpiCard({icon,bg,label,value,delta,dc,accent}:{icon:string;bg:string;label:string;value:string;delta:string;dc:string;accent:string}) {
  return (
    <div style={{background:'#fff',border:'1px solid #F0E0E0',borderRadius:14,padding:16,position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',bottom:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${accent},${accent}88)`}}/>
      <div style={{width:32,height:32,borderRadius:9,background:bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,marginBottom:12}}>{icon}</div>
      <div style={{fontSize:18,fontWeight:700,color:'#1A0A0A',fontFamily:'Nunito,sans-serif',letterSpacing:'-0.3px',marginBottom:2}}>{value}</div>
      <div style={{fontSize:11,color:'#B08080',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</div>
      <div style={{fontSize:11,fontWeight:600,color:dc}}>{delta}</div>
    </div>
  )
}