'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Search, X, ChevronDown, Trash2, RotateCcw,
  TrendingUp, TrendingDown, Wallet, Hash,
  Clock, Tag, FileText, CreditCard, ShoppingBag, Package, Calendar,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store/appStore'
import { formatRupiah, formatDate, toISODate } from '@/lib/utils'
import type { Transaction } from '@/types'

// ─── FAKE DATA ────────────────────────────────────────────────────────────────
function makeISO(daysAgo: number, h: number, m: number) {
  const d = new Date(); d.setDate(d.getDate()-daysAgo); d.setHours(h,m,0,0); return d.toISOString()
}
function makeDate(daysAgo: number) {
  const d = new Date(); d.setDate(d.getDate()-daysAgo); return toISODate(d)
}
const FAKE_DATA: Transaction[] = [
  { id:'f01', store_id:'x', type:'income',  category:'Penjualan',   product_id:'p1', product_name:'Lele Goreng',       qty:3,  amount:75000,   profit:30000,  note:'', date:makeDate(0), source:'kasir',   payment_method:'cash', created_at:makeISO(0,9,10)  },
  { id:'f02', store_id:'x', type:'income',  category:'Penjualan',   product_id:'p2', product_name:'Ayam Goreng',       qty:2,  amount:60000,   profit:24000,  note:'', date:makeDate(0), source:'kasir',   payment_method:'qris', created_at:makeISO(0,10,5)  },
  { id:'f03', store_id:'x', type:'expense', category:'Bahan Baku',  product_name:undefined, qty:undefined, amount:200000, profit:undefined, note:'Belanja bulanan', date:makeDate(0), source:'manual', payment_method:undefined, created_at:makeISO(0,11,0)  },
  { id:'f04', store_id:'x', type:'income',  category:'Penjualan',   product_id:'p1', product_name:'Lele Goreng',       qty:5,  amount:125000,  profit:50000,  note:'', date:makeDate(0), source:'kasir',   payment_method:'cash', created_at:makeISO(0,12,10) },
  { id:'f05', store_id:'x', type:'income',  category:'Catering',    product_id:'p5', product_name:'Paket Nasi Box 20', qty:20, amount:600000,  profit:200000, note:'Acara kantor', date:makeDate(1), source:'catering', payment_method:'qris', created_at:makeISO(1,8,0)   },
  { id:'f06', store_id:'x', type:'income',  category:'Penjualan',   product_id:'p3', product_name:'Es Teh Manis',      qty:5,  amount:25000,   profit:15000,  note:'', date:makeDate(1), source:'kasir',   payment_method:'cash', created_at:makeISO(1,9,30)  },
  { id:'f07', store_id:'x', type:'expense', category:'Operasional', product_name:undefined, qty:undefined, amount:50000,  profit:undefined, note:'Token listrik', date:makeDate(1), source:'manual', payment_method:undefined, created_at:makeISO(1,14,0)  },
  { id:'f08', store_id:'x', type:'income',  category:'Penjualan',   product_id:'p4', product_name:'Nasi Goreng',       qty:4,  amount:80000,   profit:32000,  note:'', date:makeDate(2), source:'kasir',   payment_method:'qris', created_at:makeISO(2,10,20) },
  { id:'f09', store_id:'x', type:'income',  category:'Penjualan',   product_id:'p2', product_name:'Ayam Goreng',       qty:3,  amount:90000,   profit:36000,  note:'', date:makeDate(2), source:'kasir',   payment_method:'cash', created_at:makeISO(2,12,45) },
  { id:'f10', store_id:'x', type:'expense', category:'Bahan Baku',  product_name:undefined, qty:undefined, amount:85000,  profit:undefined, note:'Sayuran', date:makeDate(2), source:'manual', payment_method:undefined, created_at:makeISO(2,7,30)  },
  { id:'f11', store_id:'x', type:'income',  category:'Catering',    product_id:'p6', product_name:'Paket Prasmanan',   qty:1,  amount:1500000, profit:500000, note:'Pernikahan Bu Sari', date:makeDate(3), source:'catering', payment_method:'qris', created_at:makeISO(3,9,0)   },
  { id:'f12', store_id:'x', type:'expense', category:'Gaji',        product_name:undefined, qty:undefined, amount:300000, profit:undefined, note:'Gaji karyawan', date:makeDate(3), source:'manual', payment_method:undefined, created_at:makeISO(3,10,0)  },
  { id:'f13', store_id:'x', type:'income',  category:'Penjualan',   product_id:'p1', product_name:'Lele Goreng',       qty:6,  amount:150000,  profit:60000,  note:'', date:makeDate(4), source:'kasir',   payment_method:'cash', created_at:makeISO(4,11,30) },
  { id:'f14', store_id:'x', type:'income',  category:'Penjualan',   product_id:'p3', product_name:'Es Teh Manis',      qty:8,  amount:40000,   profit:24000,  note:'', date:makeDate(4), source:'kasir',   payment_method:'qris', created_at:makeISO(4,13,0)  },
  { id:'f15', store_id:'x', type:'expense', category:'Operasional', product_name:undefined, qty:undefined, amount:30000,  profit:undefined, note:'Kemasan box', date:makeDate(5), source:'manual', payment_method:undefined, created_at:makeISO(5,8,0)   },
  { id:'f16', store_id:'x', type:'income',  category:'Penjualan',   product_id:'p4', product_name:'Nasi Goreng',       qty:2,  amount:40000,   profit:16000,  note:'', date:makeDate(6), source:'kasir',   payment_method:'cash', created_at:makeISO(6,13,20) },
  { id:'f17', store_id:'x', type:'expense', category:'Bahan Baku',  product_name:undefined, qty:undefined, amount:200000, profit:undefined, note:'Stok ayam', date:makeDate(6), source:'manual', payment_method:undefined, created_at:makeISO(6,7,0)   },
]

// ─── TYPES ────────────────────────────────────────────────────────────────────
type DateRange  = '1' | '7' | '30' | 'month' | 'custom'
type TipeFilter = 'all' | 'income' | 'expense'
type PayFilter  = 'all' | 'cash' | 'qris'
interface Filters {
  search: string; tipe: TipeFilter; dateRange: DateRange
  dateFrom: string; dateTo: string; payMethod: PayFilter; category: string
}
const DEFAULT_FILTERS: Filters = {
  search:'', tipe:'all', dateRange:'7', dateFrom:'', dateTo:'', payMethod:'all', category:'all',
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function formatDateHeader(dateStr: string) {
  const today = new Date(); today.setHours(0,0,0,0)
  const yday  = new Date(today); yday.setDate(today.getDate()-1)
  const d = new Date(dateStr+'T00:00:00')
  if (d.getTime()===today.getTime()) return 'Hari ini'
  if (d.getTime()===yday.getTime())  return 'Kemarin'
  return d.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'short',year:'numeric'})
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})
}
function getDateBounds(range: DateRange, from: string, to: string) {
  const end   = new Date(); end.setHours(23,59,59,999)
  const start = new Date(); start.setHours(0,0,0,0)
  if      (range==='7')     { start.setDate(start.getDate()-6) }
  else if (range==='30')    { start.setDate(start.getDate()-29) }
  else if (range==='month') { start.setDate(1) }
  else if (range==='custom') {
    return { start: from?new Date(from+'T00:00:00'):new Date(0), end: to?new Date(to+'T23:59:59'):end }
  }
  return { start, end }
}

// ─── SKELETON ─────────────────────────────────────────────────────────────────
function Skel({ w='100%', h=14, r=7 }: { w?: string|number; h?: number; r?: number }) {
  return <div style={{ width:w, height:h, borderRadius:r, background:'var(--bg-elevated)', animation:'skelpulse 1.4s ease-in-out infinite' }}/>
}

// ─── DROPDOWN ─────────────────────────────────────────────────────────────────
function FilterSelect({ label, value, options, onChange }: {
  label: string; value: string
  options: {label:string; value:string}[]
  onChange: (v:string)=>void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o=>o.value===value)
  const isActive = value !== options[0]?.value

  useEffect(()=>{
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return ()=>document.removeEventListener('mousedown', h)
  },[])

  return (
    <div ref={ref} style={{ position:'relative', flex:1, minWidth:0 }}>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.07em', marginBottom:5, color:'rgba(255,255,255,0.6)', textTransform:'uppercase' }}>
        {label}
      </div>
      <button onClick={()=>setOpen(v=>!v)} style={{
        width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:4,
        padding:'8px 10px', borderRadius:9,
        border:`1px solid ${isActive ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)'}`,
        background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)',
        color:'#fff', fontSize:12, fontWeight: isActive ? 700 : 400,
        cursor:'pointer', textAlign:'left',
      }}>
        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {selected?.label ?? label}
        </span>
        <ChevronDown size={13} style={{ flexShrink:0, opacity:0.6, transform:open?'rotate(180deg)':'none', transition:'transform .15s' }}/>
      </button>
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:50,
          background:'var(--bg-surface)', border:'1px solid var(--border)',
          borderRadius:10, boxShadow:'var(--shadow-md)', overflow:'hidden', padding:'4px 0',
        }}>
          {options.map(o=>(
            <button key={o.value} onClick={()=>{ onChange(o.value); setOpen(false) }} style={{
              width:'100%', textAlign:'left', padding:'9px 12px', border:'none', cursor:'pointer',
              background: value===o.value ? 'var(--accent-subtle)' : 'none',
              color: value===o.value ? 'var(--accent)' : 'var(--text-primary)',
              fontSize:13, fontWeight: value===o.value ? 700 : 400,
            }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── HERO CARD — hanya nama toko + filter, tidak ada summary ─────────────────
function HeroCard({ filters, categories, storeName, onChange, onReset, hasActive }: {
  filters: Filters; categories: string[]; storeName: string
  onChange: (f:Partial<Filters>)=>void; onReset:()=>void; hasActive:boolean
}) {
  const tipeOpts  = [{ label:'Semua Tipe', value:'all' },{ label:'↑ Pemasukan', value:'income' },{ label:'↓ Pengeluaran', value:'expense' }]
  const rangeOpts = [{ label:'Hari Ini', value:'1' },{ label:'7 Hari', value:'7' },{ label:'30 Hari', value:'30' },{ label:'Bulan Ini', value:'month' },{ label:'Custom', value:'custom' }]
  const catOpts   = [{ label:'Semua Kategori', value:'all' },...categories.map(c=>({ label:c, value:c }))]

  return (
    /* Card merah dengan borderRadius 16 — persis kayak hero dashboard */
    <div style={{
      background:'#D92B2B', borderRadius:16, color:'#fff',
    }}>
      {/* ── Header: nama toko + tanggal — sama persis kayak dashboard ── */}
      <div style={{ padding:'20px 20px 20px' }}>
        {/* Nama toko + tanggal + reset di pojok kanan */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <div style={{
            width:40, height:40, borderRadius:12, flexShrink:0,
            background:'rgba(255,255,255,0.2)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:20,
          }}>🍽️</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:16, fontWeight:700, lineHeight:1.3 }}>{storeName}</div>
            <div style={{ fontSize:12, opacity:0.75, marginTop:1 }}>{formatDate(new Date(), 'long')}</div>
          </div>
          {hasActive && (
            <button onClick={onReset} style={{
              display:'flex', alignItems:'center', gap:4, flexShrink:0,
              padding:'6px 12px', borderRadius:20,
              border:'1px solid rgba(255,255,255,0.35)',
              background:'rgba(255,255,255,0.15)', color:'#fff',
              fontSize:12, fontWeight:600, cursor:'pointer',
            }}>
              <RotateCcw size={11}/> Reset
            </button>
          )}
        </div>

        {/* Search */}
        <div style={{ position:'relative', marginBottom:16 }}>
          <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.55)', pointerEvents:'none' }}/>
          <input
            type="text"
            placeholder="Cari produk, kategori, catatan..."
            value={filters.search}
            onChange={e=>onChange({search:e.target.value})}
            style={{
              width:'100%', boxSizing:'border-box',
              padding:'10px 34px 10px 34px', borderRadius:10,
              border:'1px solid rgba(255,255,255,0.25)',
              background:'rgba(255,255,255,0.12)', color:'#fff',
              fontSize:13, outline:'none', fontFamily:'Plus Jakarta Sans, sans-serif',
            }}
          />
          {filters.search && (
            <button onClick={()=>onChange({search:''})} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.7)', display:'flex', padding:2 }}>
              <X size={13}/>
            </button>
          )}
        </div>

        {/* 3 Dropdown */}
        <div style={{ display:'flex', gap:10, marginBottom:14 }}>
          <FilterSelect label="Tipe"     value={filters.tipe}     options={tipeOpts}  onChange={v=>onChange({tipe:v as TipeFilter})}/>
          <FilterSelect label="Periode"  value={filters.dateRange} options={rangeOpts} onChange={v=>onChange({dateRange:v as DateRange})}/>
          <FilterSelect label="Kategori" value={filters.category}  options={catOpts}   onChange={v=>onChange({category:v})}/>
        </div>

        {/* Custom date */}
        {filters.dateRange==='custom' && (
          <div style={{
            marginBottom:14,
            background:'rgba(255,255,255,0.10)', borderRadius:10,
            padding:'14px', border:'1px solid rgba(255,255,255,0.2)',
            animation:'fadeIn .2s ease',
          }}>
            <div style={{ fontSize:10, fontWeight:700, opacity:0.65, marginBottom:10, display:'flex', alignItems:'center', gap:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>
              <Calendar size={11}/> Rentang Tanggal
            </div>
            <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, opacity:0.6, marginBottom:5, fontWeight:600 }}>DARI</div>
                <input type="date" value={filters.dateFrom} onChange={e=>onChange({dateFrom:e.target.value})}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.25)', background:'rgba(255,255,255,0.12)', color:'#fff', fontSize:12, boxSizing:'border-box', outline:'none' }}/>
              </div>
              <div style={{ color:'rgba(255,255,255,0.4)', fontSize:14, paddingBottom:9 }}>→</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, opacity:0.6, marginBottom:5, fontWeight:600 }}>SAMPAI</div>
                <input type="date" value={filters.dateTo} onChange={e=>onChange({dateTo:e.target.value})}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.25)', background:'rgba(255,255,255,0.12)', color:'#fff', fontSize:12, boxSizing:'border-box', outline:'none' }}/>
              </div>
            </div>
          </div>
        )}

        {/* Chip metode bayar */}
        <div style={{ display:'flex', gap:7, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:10, opacity:0.6, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>BAYAR</span>
          {(['all','cash','qris'] as const).map(p=>(
            <button key={p} onClick={()=>onChange({payMethod:p})} style={{
              padding:'5px 13px', borderRadius:20, cursor:'pointer', fontSize:12,
              fontWeight: filters.payMethod===p ? 700 : 500,
              border: filters.payMethod===p ? 'none' : '1px solid rgba(255,255,255,0.3)',
              background: filters.payMethod===p ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.12)',
              color:       filters.payMethod===p ? '#D92B2B'                : '#fff',
              transition:'all .15s',
            }}>
              {p==='all' ? 'Semua' : p==='cash' ? '💵 Cash' : '📱 QRIS'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── KPI CARDS — persis kayak dashboard ───────────────────────────────────────
function KpiCards({ income, expense, count, loading }: { income:number; expense:number; count:number; loading:boolean }) {
  const profit = income - expense
  const cards = [
    { icon:'💰', bg:'#DCFCE7', label:'Pemasukan',   value:formatRupiah(income),  delta:`${count} transaksi`,   deltaColor:'#16A34A' },
    { icon:'💸', bg:'#FEE2E2', label:'Pengeluaran', value:formatRupiah(expense), delta:`${count} pos biaya`,   deltaColor:'#DC2626' },
    { icon:'📈', bg:'#DBEAFE', label:'Laba Bersih', value:formatRupiah(profit),  delta: income>0 ? `Margin ${Math.round((profit/income)*100)}%` : '—', deltaColor:'#2563EB' },
    { icon:'🧾', bg:'#F3E8FF', label:'Transaksi',   value:`${count}`,            delta:'total dicatat',        deltaColor:'#7C3AED' },
  ]
  return (
    <div className="kpi-4col" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
      {cards.map((c,i)=>(
        <div key={i} style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, padding:14 }}>
          {loading ? (
            <>
              <Skel h={28} w={28} r={8}/>
              <div style={{marginTop:10}}><Skel h={16} w="80%"/></div>
              <div style={{marginTop:6}}><Skel h={10} w="55%"/></div>
            </>
          ) : (
            <>
              <div style={{ width:30, height:30, borderRadius:9, background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, marginBottom:10 }}>{c.icon}</div>
              <div style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', fontFamily:'Nunito,sans-serif', letterSpacing:'-0.3px', marginBottom:2 }}>{c.value}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>{c.label}</div>
              <div style={{ fontSize:11, fontWeight:600, color:c.deltaColor }}>{c.delta}</div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── TRANSACTION ITEM ─────────────────────────────────────────────────────────
function TransactionItem({ tx, onClick }: { tx:Transaction; onClick:(tx:Transaction)=>void }) {
  const isIncome = tx.type==='income'
  const label    = tx.product_name ?? tx.category
  const src      = tx.source==='kasir' ? 'Kasir' : tx.source==='catering' ? '🍱 Catering' : '✏️ Manual'
  return (
    <div onClick={()=>onClick(tx)} className="tx-item" style={{
      display:'flex', alignItems:'center', gap:12, padding:'12px 20px',
      borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background .1s',
    }}>
      <div style={{ width:36, height:36, borderRadius:10, flexShrink:0, fontSize:16, background:isIncome?'var(--success-bg)':'var(--danger-bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {isIncome ? '🧾' : '💸'}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {label}
        </div>
        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1, display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
          {isIncome ? src : `💸 ${tx.category}`}
          {' · '}{formatTime(tx.created_at)}
          {tx.qty && tx.qty>1 ? ` · ×${tx.qty}` : ''}
          {tx.payment_method && (
            <span style={{ fontSize:10, fontWeight:600, padding:'1px 6px', borderRadius:4, background:tx.payment_method==='cash'?'#DCFCE7':'#DBEAFE', color:tx.payment_method==='cash'?'#16A34A':'#2563EB' }}>
              {tx.payment_method==='cash' ? '💵 Cash' : '📱 QRIS'}
            </span>
          )}
        </div>
      </div>
      <div style={{ fontSize:14, fontWeight:600, fontFamily:'Nunito,sans-serif', flexShrink:0, color:isIncome?'var(--success)':'var(--danger)' }}>
        {isIncome?'+':'−'}{formatRupiah(tx.amount)}
      </div>
    </div>
  )
}

// ─── TRANSACTION GROUP ────────────────────────────────────────────────────────
function TransactionGroup({ date, transactions, onSelect }: { date:string; transactions:Transaction[]; onSelect:(tx:Transaction)=>void }) {
  const dayIn  = transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)
  const dayOut = transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)
  return (
    <div>
      <div style={{ padding:'6px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--bg-elevated)', borderBottom:'1px solid var(--border)' }}>
        <span style={{ fontSize:11, fontWeight:700, color:'var(--text-secondary)' }}>{formatDateHeader(date)}</span>
        <div style={{ display:'flex', gap:8, fontSize:10, fontFamily:'Nunito, sans-serif' }}>
          {dayIn  > 0 && <span style={{ color:'var(--success)', fontWeight:700 }}>+{formatRupiah(dayIn)}</span>}
          {dayOut > 0 && <span style={{ color:'var(--danger)',  fontWeight:700 }}>−{formatRupiah(dayOut)}</span>}
        </div>
      </div>
      {transactions.map(tx=><TransactionItem key={tx.id} tx={tx} onClick={onSelect}/>)}
    </div>
  )
}

// ─── DETAIL SHEET ─────────────────────────────────────────────────────────────
function DetailSheet({ tx, onClose, onDelete }: { tx:Transaction|null; onClose:()=>void; onDelete:(id:string)=>Promise<void> }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  useEffect(()=>{ if(!tx){ setConfirming(false); setDeleting(false) } },[tx])
  if (!tx) return null
  const isIncome = tx.type==='income'
  const rows: { icon:React.ReactNode; label:string; value:string|undefined }[] = [
    { icon:<Tag size={13}/>,         label:'Kategori', value:tx.category },
    { icon:<Package size={13}/>,     label:'Produk',   value:tx.product_name },
    { icon:<Hash size={13}/>,        label:'Qty',      value:tx.qty?`${tx.qty}`:undefined },
    { icon:<Wallet size={13}/>,      label:'Amount',   value:formatRupiah(tx.amount) },
    { icon:<TrendingUp size={13}/>,  label:'Laba',     value:tx.profit!==undefined?formatRupiah(tx.profit):undefined },
    { icon:<CreditCard size={13}/>,  label:'Bayar',    value:isIncome&&tx.payment_method?(tx.payment_method==='cash'?'💵 Cash':'📱 QRIS'):undefined },
    { icon:<ShoppingBag size={13}/>, label:'Sumber',   value:tx.source==='kasir'?'Kasir':tx.source==='catering'?'🍱 Catering':'Manual' },
    { icon:<Calendar size={13}/>,    label:'Tanggal',  value:formatDate(tx.date+' 00:00:00','long') },
    { icon:<Clock size={13}/>,       label:'Jam',      value:formatTime(tx.created_at) },
    { icon:<FileText size={13}/>,    label:'Catatan',  value:tx.note||undefined },
  ]
  async function handleDelete() {
    if (!confirming) { setConfirming(true); return }
    setDeleting(true); await onDelete(tx!.id); setDeleting(false); onClose()
  }
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:40, backdropFilter:'blur(2px)', animation:'fadeIn .2s ease' }}/>
      <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:50, background:'var(--bg-surface)', borderRadius:'16px 16px 0 0', maxHeight:'82vh', overflowY:'auto', animation:'slideUp .3s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 4px' }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'var(--border)' }}/>
        </div>
        <div style={{ padding:'4px 20px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:2 }}>Detail Transaksi</div>
            <div style={{ fontSize:20, fontWeight:700, color:isIncome?'var(--success)':'var(--danger)', fontFamily:'Nunito, sans-serif' }}>
              {isIncome?'+':'−'}{formatRupiah(tx.amount)}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'var(--bg-elevated)', border:'none', borderRadius:20, padding:'6px 14px', cursor:'pointer', color:'var(--text-secondary)', fontSize:12, fontWeight:600 }}>Tutup</button>
        </div>
        <div style={{ padding:'6px 0' }}>
          {rows.filter(r=>r.value!==undefined).map((r,i,arr)=>(
            <div key={i} style={{ padding:'9px 20px', display:'flex', alignItems:'flex-start', gap:12, borderBottom:i<arr.length-1?'1px solid var(--border)':'none' }}>
              <span style={{ color:'var(--text-muted)', marginTop:1, flexShrink:0 }}>{r.icon}</span>
              <span style={{ fontSize:12, color:'var(--text-muted)', minWidth:72, flexShrink:0 }}>{r.label}</span>
              <span style={{ fontSize:13, color:'var(--text-primary)', fontWeight:500 }}>{r.value}</span>
            </div>
          ))}
        </div>
        <div style={{ padding:'12px 20px 32px' }}>
          <button onClick={handleDelete} disabled={deleting} style={{ width:'100%', padding:'11px', borderRadius:10, border:'none', cursor:'pointer', background:confirming?'var(--danger)':'var(--danger-bg)', color:confirming?'#fff':'var(--danger)', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity:deleting?.6:1, transition:'background .15s' }}>
            <Trash2 size={14}/>{deleting?'Menghapus...':confirming?'Konfirmasi Hapus?':'Hapus Transaksi'}
          </button>
          {confirming&&!deleting&&(
            <button onClick={()=>setConfirming(false)} style={{ width:'100%', marginTop:6, padding:'9px', borderRadius:10, border:'1px solid var(--border)', background:'none', color:'var(--text-muted)', fontSize:13, cursor:'pointer' }}>Batal</button>
          )}
        </div>
      </div>
    </>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function RiwayatPage() {
  const currentStore = useAppStore(s=>s.currentStore)
  const isDummy      = !currentStore || currentStore.id==='dummy-store-001'
  const isOffline    = typeof navigator!=='undefined' && !navigator.onLine
  const skipSupabase = isDummy || isOffline

  const [allTx,      setAllTx]      = useState<Transaction[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filters,    setFilters]    = useState<Filters>(DEFAULT_FILTERS)
  const [selectedTx, setSelectedTx] = useState<Transaction|null>(null)

  useEffect(()=>{
    async function load() {
      setLoading(true)
      if (!currentStore) {
        await new Promise(r=>setTimeout(r,500))
        setAllTx([...FAKE_DATA].sort((a,b)=>b.created_at.localeCompare(a.created_at)))
        setLoading(false); return
      }
      if (skipSupabase) {
        const pending = useAppStore.getState().pendingSync
        const sales: Transaction[]    = pending.filter(p=>p.table==='sales'    &&p.action==='insert').map(p=>({...(p.payload as any),type:'income'  as const}))
        const expenses: Transaction[] = pending.filter(p=>p.table==='expenses' &&p.action==='insert').map(p=>({...(p.payload as any),type:'expense' as const}))
        setAllTx([...sales,...expenses].sort((a,b)=>b.created_at.localeCompare(a.created_at)))
        setLoading(false); return
      }
      try {
        const supabase = createClient()
        const [{ data:salesData },{ data:expenseData }] = await Promise.all([
          supabase.from('sales').select('*').eq('store_id',currentStore.id).order('created_at',{ascending:false}).limit(500),
          supabase.from('expenses').select('*').eq('store_id',currentStore.id).order('created_at',{ascending:false}).limit(500),
        ])
        const merged: Transaction[] = [
          ...((salesData??[]).map((t:any)=>({...t,type:'income'  as const}))),
          ...((expenseData??[]).map((t:any)=>({...t,type:'expense' as const}))),
        ].sort((a,b)=>b.created_at.localeCompare(a.created_at))
        setAllTx(merged)
      } catch { /* graceful */ }
      setLoading(false)
    }
    load()
  },[currentStore?.id, skipSupabase]) // eslint-disable-line react-hooks/exhaustive-deps

  const categories = useMemo(()=>Array.from(new Set(allTx.map(t=>t.category))).sort(),[allTx])

  const filtered = useMemo(()=>{
    const {start,end} = getDateBounds(filters.dateRange, filters.dateFrom, filters.dateTo)
    const q = filters.search.toLowerCase()
    return allTx.filter(tx=>{
      const txDate = new Date(tx.created_at)
      if (txDate<start||txDate>end)                                                return false
      if (filters.tipe!=='all'     && tx.type!==filters.tipe)                     return false
      if (filters.category!=='all' && tx.category!==filters.category)             return false
      if (filters.payMethod!=='all') {
        if (tx.type==='expense')                                                   return false
        if (tx.payment_method!==filters.payMethod)                                return false
      }
      if (q && ![tx.product_name,tx.category,tx.note].join(' ').toLowerCase().includes(q)) return false
      return true
    })
  },[allTx,filters])

  const { income, expense, count } = useMemo(()=>({
    income:  filtered.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),
    expense: filtered.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0),
    count:   filtered.length,
  }),[filtered])

  const grouped = useMemo(()=>{
    const map = new Map<string,Transaction[]>()
    for (const tx of filtered) {
      if (!map.has(tx.date)) map.set(tx.date,[])
      map.get(tx.date)!.push(tx)
    }
    return Array.from(map.entries()).sort((a,b)=>b[0].localeCompare(a[0]))
  },[filtered])

  const hasActive = useMemo(()=>
    filters.search!==''||filters.tipe!=='all'||filters.dateRange!=='7'||filters.payMethod!=='all'||filters.category!=='all'
  ,[filters])

  const handleChange = useCallback((f:Partial<Filters>)=>setFilters(p=>({...p,...f})),[])
  const handleReset  = useCallback(()=>setFilters(DEFAULT_FILTERS),[])

  const handleDelete = useCallback(async (id:string)=>{
    setAllTx(prev=>prev.filter(t=>t.id!==id))
    if (skipSupabase) return
    try {
      const supabase = createClient()
      await supabase.from('sales').delete().eq('id',id)
      await supabase.from('expenses').delete().eq('id',id)
    } catch { /* graceful */ }
  },[skipSupabase])

  return (
    <>
      <style>{`
        @keyframes skelpulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .tx-item:hover { background: var(--bg-elevated) !important; }
        @media (max-width: 767px) {
          .kpi-4col { grid-template-columns: 1fr 1fr !important; }
          .page-inner { padding: 16px 16px 90px !important; }
        }
        input[type="text"]::placeholder { color: rgba(255,255,255,0.45); }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1) opacity(0.6); }
      `}</style>

      <div style={{ background:'var(--bg-base)', minHeight:'100vh' }}>
        {/* Wrapper padding — sama kayak dash-wrap di dashboard */}
        <div className="page-inner" style={{ maxWidth:1100, margin:'0 auto', padding:'24px 24px 80px' }}>

          {/* ── HERO CARD (merah, borderRadius 16, ikut scroll) ── */}
          <div style={{ marginBottom:12 }}>
            <HeroCard
              filters={filters}
              categories={categories}
              storeName={currentStore?.name ?? 'Warung Demo'}
              onChange={handleChange}
              onReset={handleReset}
              hasActive={hasActive}
            />
          </div>

          {/* ── KPI CARDS ── */}
          <KpiCards income={income} expense={expense} count={count} loading={loading}/>

          {/* ── TRANSACTION LIST ── */}
          <div style={{ marginTop:16 }}>
            {/* Skeleton */}
            {loading && (
              <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
                {[...Array(5)].map((_,i)=>(
                  <div key={i} style={{ display:'flex', gap:12, padding:'14px 20px', borderBottom:'1px solid var(--border)', alignItems:'center' }}>
                    <Skel w={36} h={36} r={10}/>
                    <div style={{ flex:1, display:'flex', flexDirection:'column', gap:7 }}>
                      <Skel h={13} w="50%"/>
                      <Skel h={10} w="35%"/>
                    </div>
                    <Skel h={14} w={80} r={6}/>
                  </div>
                ))}
              </div>
            )}

            {/* Empty */}
            {!loading && grouped.length===0 && (
              <div style={{ textAlign:'center', padding:'60px 20px', background:'var(--bg-surface)', borderRadius:14, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>📋</div>
                <div style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', marginBottom:6 }}>Tidak ada transaksi</div>
                <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20 }}>Coba ubah filter atau rentang tanggal</div>
                {hasActive && (
                  <button onClick={handleReset} style={{ padding:'9px 20px', borderRadius:20, border:'none', cursor:'pointer', background:'var(--accent)', color:'#fff', fontSize:13, fontWeight:700, display:'inline-flex', alignItems:'center', gap:6 }}>
                    <RotateCcw size={13}/> Reset Filter
                  </button>
                )}
              </div>
            )}

            {/* Groups — semua dalam satu card, persis kayak "Transaksi Hari Ini" di dashboard */}
            {!loading && grouped.length>0 && (
              <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
                {grouped.map(([date,txs],gi)=>(
                  <div key={date} style={{ borderTop: gi>0 ? '2px solid var(--bg-elevated)' : 'none' }}>
                    <TransactionGroup date={date} transactions={txs} onSelect={setSelectedTx}/>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <DetailSheet tx={selectedTx} onClose={()=>setSelectedTx(null)} onDelete={handleDelete}/>
    </>
  )
}