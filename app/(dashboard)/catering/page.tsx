'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useAppStore } from '@/lib/store/appStore'
import { createClient } from '@/lib/supabase/client'

// ─── Types ─────────────────────────────────────────────────────────────────────

type OrderStatus   = 'belum_dp' | 'sudah_dp' | 'lunas' | 'selesai'
type PaymentMethod = 'cash' | 'transfer' | 'qris'
type FilterTab     = 'semua' | OrderStatus
type ViewMode      = 'list' | 'kanban' | 'timeline'

interface OrderItem {
  product_id?: string
  name: string
  qty: number
  unit_price: number
  subtotal: number
}

interface CateringOrder {
  id: string
  store_id: string
  customer_name: string
  customer_wa: string
  customer_institution?: string
  event_date: string
  event_time?: string
  location: string
  items: OrderItem[]
  total: number
  dp_amount: number
  remaining: number
  status: OrderStatus
  payment_method?: PaymentMethod
  notes?: string
  created_at: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<OrderStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  belum_dp: { label: 'Belum DP', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', dot: '#DC2626' },
  sudah_dp: { label: 'Sudah DP', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B' },
  lunas:    { label: 'Lunas',    color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0', dot: '#16A34A' },
  selesai:  { label: 'Selesai',  color: '#4B5563', bg: '#F9FAFB', border: '#E5E7EB', dot: '#9CA3AF' },
}

const STATUS_ORDER: OrderStatus[] = ['belum_dp', 'sudah_dp', 'lunas', 'selesai']

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'semua',    label: 'Semua'    },
  { key: 'belum_dp', label: 'Belum DP' },
  { key: 'sudah_dp', label: 'Sudah DP' },
  { key: 'lunas',    label: 'Lunas'    },
  { key: 'selesai',  label: 'Selesai'  },
]

const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon: string }[] = [
  { key: 'cash',     label: 'Cash',     icon: '💵' },
  { key: 'transfer', label: 'Transfer', icon: '🏦' },
  { key: 'qris',     label: 'QRIS',     icon: '📱' },
]

const STATUS_NEXT: Partial<Record<OrderStatus, { next: OrderStatus; label: string; color: string }>> = {
  belum_dp: { next: 'sudah_dp', label: 'Tandai Sudah DP', color: '#B45309' },
  sudah_dp: { next: 'lunas',    label: 'Tandai Lunas',    color: '#15803D' },
  lunas:    { next: 'selesai',  label: 'Tandai Selesai',  color: '#4B5563' },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmt   = (n: number) => 'Rp\u00A0' + n.toLocaleString('id-ID')
const today = new Date().toISOString().split('T')[0]

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateShort(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function daysUntil(d: string) {
  const t = new Date(); t.setHours(0,0,0,0)
  const e = new Date(d); e.setHours(0,0,0,0)
  return Math.ceil((e.getTime() - t.getTime()) / 86400000)
}

function isOverdue(o: CateringOrder) {
  return daysUntil(o.event_date) < 0 && o.status !== 'lunas' && o.status !== 'selesai'
}
function isUrgent(o: CateringOrder) {
  const d = daysUntil(o.event_date)
  return d >= 0 && d <= 3 && o.status !== 'selesai'
}

function fmtPrice(val: string) {
  const d = val.replace(/\D/g, '')
  return d ? parseInt(d).toLocaleString('id-ID') : ''
}

function parsePrice(val: string) {
  return parseInt(val.replace(/\./g, '').replace(/\D/g, '')) || 0
}

function genId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

function lsGet(key: string) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') } catch { return null }
}
function lsSet(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

// ─── Shared UI ─────────────────────────────────────────────────────────────────

function StatusBadge({ status, small }: { status: OrderStatus; small?: boolean }) {
  const c = STATUS_CFG[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: small ? '2px 8px' : '4px 10px',
      borderRadius: 99,
      background: c.bg, color: c.color,
      border: `1px solid ${c.border}`,
      fontSize: small ? 11 : 12, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
      {c.label}
    </span>
  )
}

function UrgencyChip({ order }: { order: CateringOrder }) {
  const overdue = isOverdue(order)
  const urgent  = isUrgent(order)
  if (!overdue && !urgent) return null
  const d = daysUntil(order.event_date)
  return (
    <span style={{
      fontSize: 11, fontWeight: 700,
      color: overdue ? '#DC2626' : '#B45309',
      display: 'inline-flex', alignItems: 'center', gap: 3,
    }}>
      {overdue ? '❗Overdue' : d === 0 ? '⚠️ Hari ini' : `⚠️ ${d} hari lagi`}
    </span>
  )
}

// Input & Label helpers
const iStyle: React.CSSProperties = {
  width: '100%', padding: '10px 13px', borderRadius: 8, fontSize: 14,
  border: '1px solid var(--border)', background: 'var(--bg-base)',
  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
}
const lStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: 'var(--text-muted)', marginBottom: 5, letterSpacing: '0.02em',
}
const errStyle: React.CSSProperties = { fontSize: 11, color: '#DC2626', marginTop: 3 }

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ filter, onAdd }: { filter: FilterTab; onAdd: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 24px' }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>🍱</div>
      <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
        {filter === 'semua' ? 'Belum ada order catering' : `Tidak ada order "${FILTER_TABS.find(t => t.key === filter)?.label}"`}
      </p>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)' }}>
        {filter === 'semua' ? 'Tambah order pertama kamu.' : 'Coba pilih filter lain.'}
      </p>
      {filter === 'semua' && (
        <button onClick={onAdd} style={{
          padding: '10px 22px', borderRadius: 9, border: 'none',
          background: 'var(--accent)', color: '#fff',
          fontWeight: 700, fontSize: 14, cursor: 'pointer',
        }}>+ Buat Order</button>
      )}
    </div>
  )
}

// ─── ORDER CARD (List / Mobile) ────────────────────────────────────────────────

function OrderCard({ order, onClick }: { order: CateringOrder; onClick: () => void }) {
  const overdue = isOverdue(order)
  const urgent  = isUrgent(order)
  const days    = daysUntil(order.event_date)
  const pm      = PAYMENT_METHODS.find(p => p.key === order.payment_method)

  // Format tanggal tanpa tahun: "20 Sep · 10:00"
  const eventLabel = (() => {
    const d = new Date(order.event_date)
    const tgl = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    return order.event_time ? `${tgl} · ${order.event_time}` : tgl
  })()

  const metaTags = [
    `📅 ${eventLabel}`,
    `📍 ${order.location}`,
    ...(pm ? [`${pm.icon} ${pm.label}`] : []),
  ]

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        border: '1px solid #EFEFEF',
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'box-shadow 0.12s',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      {/* Urgent bar */}
      {(urgent || overdue) && (
        <div style={{
          padding: '7px 14px',
          background: overdue ? '#FFF0F0' : '#FFFBEB',
          borderBottom: `1px solid ${overdue ? '#FECACA' : '#FEF3C7'}`,
          fontSize: 11, fontWeight: 700,
          color: overdue ? '#C0392B' : '#92610A',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          {overdue
            ? '❗ Order ini overdue — segera tindak lanjuti'
            : `⚠️ Acara ${days === 0 ? 'hari ini' : `${days} hari lagi`} — segera persiapkan`}
        </div>
      )}

      {/* Header: nama + status */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', padding: '13px 14px 8px',
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#111', letterSpacing: '-0.2px' }}>
            {order.customer_name}
          </p>
          {order.customer_institution && (
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#ABABAB' }}>
              {order.customer_institution}
            </p>
          )}
        </div>
        <StatusBadge status={order.status} small />
      </div>

      {/* Meta tags */}
      <div style={{ padding: '0 14px 10px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {metaTags.map((tag, i) => (
          <span key={i} style={{
            fontSize: 11, color: '#888',
            background: '#F7F7F7',
            padding: '4px 9px', borderRadius: 6,
            whiteSpace: 'nowrap',
          }}>{tag}</span>
        ))}
      </div>

      {/* Finance grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #F5F5F5' }}>
        {[
          { label: 'Total', value: fmt(order.total),     color: '#111' },
          { label: 'DP',    value: fmt(order.dp_amount), color: '#16A34A' },
          { label: 'Sisa',  value: fmt(order.remaining), color: order.remaining > 0 ? '#C0392B' : '#16A34A' },
        ].map((col, i) => (
          <div key={i} style={{ padding: '10px 14px', borderRight: i < 2 ? '1px solid #F5F5F5' : 'none' }}>
            <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, color: '#ABABAB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {col.label}
            </p>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: col.color, whiteSpace: 'nowrap' }}>
              {col.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── KANBAN VIEW ───────────────────────────────────────────────────────────────

function KanbanView({ orders, onCardClick }: { orders: CateringOrder[]; onCardClick: (o: CateringOrder) => void }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(220px, 1fr))',
      gap: 14,
      overflowX: 'auto',
      padding: '0 0 16px',
    }}>
      {STATUS_ORDER.map(status => {
        const col = orders.filter(o => o.status === status)
        const cfg = STATUS_CFG[status]
        return (
          <div key={status} style={{ minWidth: 220 }}>
            {/* Column header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', borderRadius: '8px 8px 0 0',
              background: cfg.bg, border: `1px solid ${cfg.border}`,
              borderBottom: 'none',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot }} />
                {cfg.label}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, background: cfg.border,
                color: cfg.color, borderRadius: 99, padding: '1px 8px',
              }}>{col.length}</span>
            </div>

            {/* Cards */}
            <div style={{
              border: `1px solid ${cfg.border}`, borderTop: 'none',
              borderRadius: '0 0 8px 8px',
              background: '#FAFAFA',
              minHeight: 80,
              display: 'flex', flexDirection: 'column', gap: 8, padding: 8,
            }}>
              {col.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '16px 0' }}>
                  Kosong
                </p>
              ) : col.map(o => (
                <div
                  key={o.id}
                  onClick={() => onCardClick(o)}
                  style={{
                    background: '#fff',
                    border: `1px solid ${isOverdue(o) ? '#FECACA' : isUrgent(o) ? '#FDE68A' : '#E5E7EB'}`,
                    borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
                    transition: 'box-shadow 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                    {o.customer_name}
                  </p>
                  {o.customer_institution && (
                    <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--text-muted)' }}>{o.customer_institution}</p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>📅 {fmtDateShort(o.event_date)}</span>
                    <UrgencyChip order={o} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid #F3F4F6' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sisa</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: o.remaining > 0 ? '#DC2626' : '#15803D' }}>
                      {fmt(o.remaining)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── TIMELINE VIEW ─────────────────────────────────────────────────────────────

function TimelineView({ orders, onCardClick }: { orders: CateringOrder[]; onCardClick: (o: CateringOrder) => void }) {
  // Group by month
  const grouped = useMemo(() => {
    const map = new Map<string, CateringOrder[]>()
    const sorted = [...orders].sort((a, b) => a.event_date.localeCompare(b.event_date))
    sorted.forEach(o => {
      const key = o.event_date.slice(0, 7) // 'YYYY-MM'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(o)
    })
    return map
  }, [orders])

  function monthLabel(key: string) {
    const [y, m] = key.split('-')
    return new Date(+y, +m - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  }

  if (orders.length === 0) return null

  return (
    <div style={{ position: 'relative', paddingLeft: 28 }}>
      {/* Vertical line */}
      <div style={{
        position: 'absolute', left: 10, top: 8, bottom: 8,
        width: 2, background: '#E5E7EB', borderRadius: 2,
      }} />

      {[...grouped.entries()].map(([monthKey, monthOrders]) => (
        <div key={monthKey} style={{ marginBottom: 28 }}>
          {/* Month label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              position: 'absolute', left: 4,
              width: 14, height: 14, borderRadius: '50%',
              background: 'var(--accent)', border: '2px solid #fff',
              boxShadow: '0 0 0 2px var(--accent)',
            }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', textTransform: 'capitalize' }}>
              {monthLabel(monthKey)}
            </span>
          </div>

          {/* Orders in month */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {monthOrders.map(o => {
              const cfg = STATUS_CFG[o.status]
              const overdue = isOverdue(o)
              const urgent  = isUrgent(o)
              return (
                <div
                  key={o.id}
                  onClick={() => onCardClick(o)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '52px 1fr',
                    gap: 12,
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  {/* Date column */}
                  <div style={{ textAlign: 'right', paddingTop: 2 }}>
                    <div style={{ position: 'absolute', left: -22, top: 10,
                      width: 8, height: 8, borderRadius: '50%',
                      background: cfg.dot, border: '2px solid #fff',
                      boxShadow: `0 0 0 2px ${cfg.border}`,
                    }} />
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                      {new Date(o.event_date).getDate()}
                    </p>
                    <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {new Date(o.event_date).toLocaleDateString('id-ID', { weekday: 'short' })}
                    </p>
                  </div>

                  {/* Card */}
                  <div
                    style={{
                      background: '#fff',
                      border: `1px solid ${overdue ? '#FECACA' : urgent ? '#FDE68A' : '#E5E7EB'}`,
                      borderLeft: `3px solid ${cfg.dot}`,
                      borderRadius: '0 8px 8px 0',
                      padding: '10px 14px',
                      transition: 'box-shadow 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.07)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                          {o.customer_name}
                        </p>
                        {o.customer_institution && (
                          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{o.customer_institution}</p>
                        )}
                      </div>
                      <StatusBadge status={o.status} small />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>📍 {o.location}</span>
                      {o.event_time && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {o.event_time}</span>}
                      <UrgencyChip order={o} />
                    </div>

                    <div style={{ display: 'flex', gap: 14, marginTop: 8, paddingTop: 8, borderTop: '1px solid #F9FAFB' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total <strong style={{ color: 'var(--text-primary)' }}>{fmt(o.total)}</strong></span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sisa <strong style={{ color: o.remaining > 0 ? '#DC2626' : '#15803D' }}>{fmt(o.remaining)}</strong></span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── DETAIL BOTTOM SHEET ───────────────────────────────────────────────────────

function DetailSheet({
  order, onClose, onStatusChange,
}: {
  order: CateringOrder
  onClose: () => void
  onStatusChange: (id: string, status: OrderStatus) => void
}) {
  const nextAction = STATUS_NEXT[order.status]

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 560,
        background: '#fff', borderRadius: '18px 18px 0 0',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
      }}>
        {/* Handle */}
        <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: '#E5E7EB' }} />
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{order.customer_name}</h2>
              {order.customer_institution && (
                <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>{order.customer_institution}</p>
              )}
            </div>
            <StatusBadge status={order.status} />
          </div>

          {/* Urgency banner */}
          {(isOverdue(order) || isUrgent(order)) && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13, fontWeight: 600,
              background: isOverdue(order) ? '#FEF2F2' : '#FFFBEB',
              color:      isOverdue(order) ? '#DC2626'  : '#B45309',
              border: `1px solid ${isOverdue(order) ? '#FECACA' : '#FDE68A'}`,
            }}>
              {isOverdue(order)
                ? '❗ Order ini overdue — segera selesaikan pembayaran.'
                : `⚠️ Acara ${daysUntil(order.event_date) === 0 ? 'hari ini' : `${daysUntil(order.event_date)} hari lagi`} — segera persiapkan.`}
            </div>
          )}

          {/* Info grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 16 }}>
            {[
              { icon: '📅', label: 'Tanggal', value: fmtDate(order.event_date) + (order.event_time ? ` · ${order.event_time}` : '') },
              { icon: '📍', label: 'Lokasi',  value: order.location },
              { icon: '📱', label: 'WA',
                value: (
                  <a href={`https://wa.me/62${order.customer_wa.replace(/^0/, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                    {order.customer_wa} ↗
                  </a>
                )
              },
              ...(order.payment_method ? [{
                icon: '💳', label: 'Bayar',
                value: `${PAYMENT_METHODS.find(p => p.key === order.payment_method)?.icon} ${PAYMENT_METHODS.find(p => p.key === order.payment_method)?.label}`
              }] : []),
            ].map((row, i, arr) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '20px 60px 1fr',
                gap: 8, alignItems: 'center',
                padding: '10px 0',
                borderBottom: i < arr.length - 1 ? '1px solid #F3F4F6' : 'none',
              }}>
                <span style={{ fontSize: 14 }}>{row.icon}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{row.label}</span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{row.value as React.ReactNode}</span>
              </div>
            ))}
          </div>

          {/* Menu */}
          {order.items.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rincian Menu</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {order.items.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '8px 12px', background: '#F9FAFB', borderRadius: 8,
                  }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{item.qty} × {fmt(item.unit_price)}</p>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', alignSelf: 'center' }}>{fmt(item.subtotal)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pembayaran */}
          <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pembayaran</p>
            {[
              { label: 'Total Tagihan', value: fmt(order.total),      color: 'var(--text-primary)', bold: true, big: true },
              { label: 'DP Dibayar',   value: fmt(order.dp_amount),   color: '#15803D' },
              { label: 'Sisa Bayar',   value: fmt(order.remaining),   color: order.remaining > 0 ? '#DC2626' : '#15803D', bold: true },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: i < 2 ? 8 : 0, paddingBottom: i === 0 ? 8 : 0, borderBottom: i === 0 ? '1px solid #E5E7EB' : 'none' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{row.label}</span>
                <span style={{ fontSize: row.big ? 16 : 13, fontWeight: row.bold ? 700 : 500, color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Notes */}
          {order.notes && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Catatan</p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, background: '#F9FAFB', padding: '10px 12px', borderRadius: 8 }}>{order.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px 28px', borderTop: '1px solid #F3F4F6', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {nextAction && (
            <button
              onClick={() => { onStatusChange(order.id, nextAction.next); onClose() }}
              style={{
                padding: '13px', borderRadius: 10, border: 'none',
                background: nextAction.color, color: '#fff',
                fontWeight: 700, fontSize: 15, cursor: 'pointer',
              }}
            >{nextAction.label}</button>
          )}
          <button onClick={onClose} style={{
            padding: '11px', borderRadius: 10,
            border: '1px solid #E5E7EB', background: 'transparent',
            color: 'var(--text-secondary)', fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}>Tutup</button>
        </div>
      </div>
    </div>
  )
}

// ─── ADD ORDER MODAL ───────────────────────────────────────────────────────────

type FormState = {
  customer_name: string; customer_wa: string; customer_institution: string
  event_date: string; event_time: string; location: string
  items: OrderItem[]
  dp_str: string; payment_method: PaymentMethod; notes: string
}

function emptyForm(): FormState {
  return {
    customer_name: '', customer_wa: '', customer_institution: '',
    event_date: '', event_time: '', location: '',
    items: [],
    dp_str: '', payment_method: 'cash', notes: '',
  }
}

function AddOrderModal({ onClose, onSave }: {
  onClose: () => void
  onSave: (o: Omit<CateringOrder, 'id' | 'store_id' | 'created_at' | 'remaining'>) => void
}) {
  const products = useAppStore((s) => s.products)
  const [form, setForm]   = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [step, setStep]   = useState<1 | 2 | 3>(1)

  const [itemMode, setItemMode]       = useState<'product' | 'custom'>('product')
  const [selProductId, setSelProduct] = useState('')
  const [itemName, setItemName]       = useState('')
  const [itemQty, setItemQty]         = useState('1')
  const [itemPrice, setItemPrice]     = useState('')

  const total = useMemo(() => form.items.reduce((s, i) => s + i.subtotal, 0), [form.items])
  const dpNum = useMemo(() => parsePrice(form.dp_str), [form.dp_str])

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(p => ({ ...p, [k]: v }))
    setErrors(p => { const e = { ...p }; delete e[k]; return e })
  }

  function addItem() {
    let name = ''; let price = 0; let pid: string | undefined

    if (itemMode === 'product') {
      const prod = products.find(p => p.id === selProductId)
      if (!prod) return
      name  = prod.name
      price = parsePrice(itemPrice) || prod.price
      pid   = prod.id
    } else {
      name  = itemName.trim()
      price = parsePrice(itemPrice)
      if (!name || !price) return
    }

    const qty = parseInt(itemQty) || 1
    const item: OrderItem = { name, qty, unit_price: price, subtotal: qty * price }
    if (pid) item.product_id = pid
    set('items', [...form.items, item])
    setSelProduct(''); setItemName(''); setItemQty('1'); setItemPrice('')
  }

  function removeItem(i: number) {
    set('items', form.items.filter((_, idx) => idx !== i))
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.customer_name.trim()) e.customer_name = 'Wajib diisi'
    if (!form.customer_wa.trim())   e.customer_wa   = 'Wajib diisi'
    if (!form.event_date)           e.event_date    = 'Wajib diisi'
    if (!form.location.trim())      e.location      = 'Wajib diisi'
    if (form.items.length === 0)    e.items         = 'Tambahkan minimal 1 item menu'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSave() {
    if (!validate()) { setStep(form.items.length === 0 ? 2 : 1); return }
    onSave({
      customer_name:        form.customer_name.trim(),
      customer_wa:          form.customer_wa.trim(),
      customer_institution: form.customer_institution.trim() || undefined,
      event_date:  form.event_date,
      event_time:  form.event_time || undefined,
      location:    form.location.trim(),
      items:       form.items,
      total,
      dp_amount:      dpNum,
      status:         'belum_dp',
      payment_method: form.payment_method,
      notes:          form.notes.trim() || undefined,
    })
  }

  const STEPS = ['Pemesan & Acara', 'Menu', 'Pembayaran']

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 560, background: '#fff',
        borderRadius: '18px 18px 0 0',
        maxHeight: '94vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
      }}>
        {/* Handle & Header */}
        <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: '#E5E7EB' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Order Catering Baru</h2>
            <button onClick={onClose} style={{
              background: '#F3F4F6', border: 'none', borderRadius: 99,
              width: 28, height: 28, cursor: 'pointer', fontSize: 16,
              color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          </div>

          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderRadius: 8, overflow: 'hidden', border: '1px solid #E5E7EB' }}>
            {STEPS.map((label, i) => {
              const s = (i + 1) as 1 | 2 | 3
              const active = step === s
              const done   = step > s
              return (
                <button key={label} onClick={() => setStep(s)} style={{
                  flex: 1, padding: '9px 4px', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: active ? 'var(--accent)' : done ? '#FEF2F2' : '#fff',
                  color:      active ? '#fff' : done ? 'var(--accent)' : '#9CA3AF',
                  borderRight: i < 2 ? '1px solid #E5E7EB' : 'none',
                  transition: 'all 0.15s',
                }}>
                  {done ? '✓ ' : `${s}. `}{label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>

          {/* ── Step 1 ─────────────────────────────────────────── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data Pemesan</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lStyle}>Nama Pemesan *</label>
                  <input style={{ ...iStyle, borderColor: errors.customer_name ? '#DC2626' : undefined }}
                    placeholder="Nama lengkap" value={form.customer_name}
                    onChange={e => set('customer_name', e.target.value)} />
                  {errors.customer_name && <p style={errStyle}>{errors.customer_name}</p>}
                </div>

                <div>
                  <label style={lStyle}>No. WhatsApp *</label>
                  <input style={{ ...iStyle, borderColor: errors.customer_wa ? '#DC2626' : undefined }}
                    inputMode="numeric" placeholder="0812xxxx" value={form.customer_wa}
                    onChange={e => set('customer_wa', e.target.value)} />
                  {errors.customer_wa && <p style={errStyle}>{errors.customer_wa}</p>}
                </div>

                <div>
                  <label style={lStyle}>Instansi / Acara <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(opsional)</span></label>
                  <input style={iStyle} placeholder="Pernikahan, ulang tahun..." value={form.customer_institution}
                    onChange={e => set('customer_institution', e.target.value)} />
                </div>
              </div>

              <div style={{ height: 1, background: '#F3F4F6', margin: '4px 0' }} />
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Info Acara</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lStyle}>Tanggal Acara *</label>
                  <input type="date" style={{ ...iStyle, borderColor: errors.event_date ? '#DC2626' : undefined }}
                    min={today} value={form.event_date}
                    onChange={e => set('event_date', e.target.value)} />
                  {errors.event_date && <p style={errStyle}>{errors.event_date}</p>}
                </div>
                <div>
                  <label style={lStyle}>Waktu <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(opsional)</span></label>
                  <input type="time" style={iStyle} value={form.event_time}
                    onChange={e => set('event_time', e.target.value)} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lStyle}>Lokasi *</label>
                  <input style={{ ...iStyle, borderColor: errors.location ? '#DC2626' : undefined }}
                    placeholder="Alamat atau nama tempat" value={form.location}
                    onChange={e => set('location', e.target.value)} />
                  {errors.location && <p style={errStyle}>{errors.location}</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2 ─────────────────────────────────────────── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
              {/* Mode toggle */}
              <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 8, padding: 3, gap: 3 }}>
                {(['product', 'custom'] as const).map(m => (
                  <button key={m} onClick={() => setItemMode(m)} style={{
                    flex: 1, padding: '7px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600,
                    background: itemMode === m ? '#fff' : 'transparent',
                    color:      itemMode === m ? 'var(--text-primary)' : '#9CA3AF',
                    boxShadow:  itemMode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s',
                  }}>
                    {m === 'product' ? '📦 Dari Produk' : '✏️ Input Manual'}
                  </button>
                ))}
              </div>

              {/* Item builder */}
              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {itemMode === 'product' ? (
                  <div>
                    <label style={lStyle}>Pilih Produk</label>
                    <select style={iStyle} value={selProductId} onChange={e => {
                      setSelProduct(e.target.value)
                      const p = products.find(pr => pr.id === e.target.value)
                      if (p) setItemPrice(p.price.toLocaleString('id-ID'))
                    }}>
                      <option value="">-- Pilih --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label style={lStyle}>Nama Item</label>
                    <input style={iStyle} placeholder="Nasi Box Ayam Bakar..." value={itemName}
                      onChange={e => setItemName(e.target.value)} />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8 }}>
                  <div>
                    <label style={lStyle}>Qty</label>
                    <input style={iStyle} inputMode="numeric" value={itemQty}
                      onChange={e => setItemQty(e.target.value.replace(/\D/g, '') || '1')} />
                  </div>
                  <div>
                    <label style={lStyle}>Harga / item {itemMode === 'product' && <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(bisa diubah)</span>}</label>
                    <input style={iStyle} inputMode="numeric" placeholder="0" value={itemPrice}
                      onChange={e => setItemPrice(fmtPrice(e.target.value))} />
                  </div>
                </div>

                <button onClick={addItem} style={{
                  padding: '9px', borderRadius: 7, border: 'none',
                  background: 'var(--accent)', color: '#fff', fontWeight: 700,
                  fontSize: 13, cursor: 'pointer',
                }}>+ Tambah ke Menu</button>
              </div>

              {/* Item list */}
              {errors.items && form.items.length === 0 && (
                <p style={{ ...errStyle, margin: 0 }}>{errors.items}</p>
              )}
              {form.items.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {form.items.map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '9px 12px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
                    }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</p>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                          {item.qty} × {fmt(item.unit_price)} = <strong>{fmt(item.subtotal)}</strong>
                        </p>
                      </div>
                      <button onClick={() => removeItem(i)} style={{
                        background: '#FEF2F2', border: 'none', borderRadius: 6,
                        color: '#DC2626', width: 26, height: 26, cursor: 'pointer', fontSize: 14,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>×</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px',
                    background: '#FEF2F2', borderRadius: 8, border: '1px solid #FECACA' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Total</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)' }}>{fmt(total)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3 ─────────────────────────────────────────── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>
              {/* Total summary */}
              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total ({form.items.length} item)</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{fmt(total)}</span>
              </div>

              {/* Metode bayar */}
              <div>
                <label style={lStyle}>Metode Pembayaran</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {PAYMENT_METHODS.map(m => (
                    <button key={m.key} onClick={() => set('payment_method', m.key)} style={{
                      flex: 1, padding: '10px 8px', borderRadius: 8, cursor: 'pointer',
                      fontSize: 13, fontWeight: 600,
                      border: `2px solid ${form.payment_method === m.key ? 'var(--accent)' : '#E5E7EB'}`,
                      background: form.payment_method === m.key ? '#FEF2F2' : '#fff',
                      color: form.payment_method === m.key ? 'var(--accent)' : 'var(--text-secondary)',
                      transition: 'all 0.12s',
                    }}>
                      <div style={{ fontSize: 18, marginBottom: 2 }}>{m.icon}</div>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* DP */}
              <div>
                <label style={lStyle}>Nominal DP <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(kosongkan jika belum)</span></label>
                <input style={iStyle} inputMode="numeric" placeholder="0" value={form.dp_str}
                  onChange={e => set('dp_str', fmtPrice(e.target.value))} />
                {dpNum > 0 && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#15803D' }}>
                    Sisa: {fmt(Math.max(0, total - dpNum))}
                  </p>
                )}
              </div>

              {/* Catatan */}
              <div>
                <label style={lStyle}>Catatan <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(opsional)</span></label>
                <textarea style={{ ...iStyle, minHeight: 72, resize: 'vertical' }}
                  placeholder="Alergi, request khusus, dll." value={form.notes}
                  onChange={e => set('notes', e.target.value)} />
              </div>

              {/* Ringkasan */}
              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '14px 16px' }}>
                <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ringkasan</p>
                {[
                  form.customer_name && { l: 'Pemesan',   v: form.customer_name },
                  form.event_date    && { l: 'Tgl Acara', v: fmtDate(form.event_date) },
                  form.location      && { l: 'Lokasi',    v: form.location },
                ].filter(Boolean).map((row: any, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.l}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{row.v}</span>
                  </div>
                ))}
                <div style={{ height: 1, background: '#E5E7EB', margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(total)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>DP</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#15803D' }}>{fmt(dpNum)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sisa</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: Math.max(0, total - dpNum) > 0 ? '#DC2626' : '#15803D' }}>{fmt(Math.max(0, total - dpNum))}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px 28px', borderTop: '1px solid #F3F4F6', flexShrink: 0, display: 'flex', gap: 8 }}>
          {step > 1 && (
            <button onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)} style={{
              flex: 1, padding: '13px', borderRadius: 10,
              border: '1px solid #E5E7EB', background: '#fff',
              color: 'var(--text-secondary)', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}>← Kembali</button>
          )}
          {step < 3 ? (
            <button onClick={() => setStep(s => (s + 1) as 1 | 2 | 3)} style={{
              flex: 2, padding: '13px', borderRadius: 10, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}>Lanjut →</button>
          ) : (
            <button onClick={handleSave} style={{
              flex: 2, padding: '13px', borderRadius: 10, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
            }}>Simpan Order</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────

const LS_KEY = 'fintrack_catering_orders'

export default function CateringPage() {
  const currentStore = useAppStore((s) => s.currentStore)
  const [orders,      setOrders]      = useState<CateringOrder[]>([])
  const [loading,     setLoading]     = useState(true)
  const [filter,      setFilter]      = useState<FilterTab>('semua')
  const [viewMode,    setViewMode]    = useState<ViewMode>('list')
  const [showAdd,     setShowAdd]     = useState(false)
  const [detailOrder, setDetailOrder] = useState<CateringOrder | null>(null)

  const isDummy   = !currentStore || currentStore.id === 'dummy-store-001'
  const supabase  = createClient()

  // ── Load ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      if (isDummy || !navigator.onLine) {
        const saved = lsGet(LS_KEY) as CateringOrder[] | null
        setOrders(Array.isArray(saved) ? saved : [])
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('catering_orders')
        .select('*')
        .eq('store_id', currentStore!.id)
        .order('event_date', { ascending: true })
      setOrders(data ?? [])
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDummy, currentStore?.id])

  // ── Save new order ────────────────────────────────────────────────────────────
  const handleSave = useCallback(async (
    payload: Omit<CateringOrder, 'id' | 'store_id' | 'created_at' | 'remaining'>
  ) => {
    const newOrder: CateringOrder = {
      ...payload,
      id:         genId(),
      store_id:   currentStore?.id ?? 'dummy-store-001',
      remaining:  payload.total - payload.dp_amount,
      created_at: new Date().toISOString(),
    }

    let updated: CateringOrder[]

    if (isDummy || !navigator.onLine) {
      updated = [...orders, newOrder].sort(
        (a, b) => a.event_date.localeCompare(b.event_date)
      )
      setOrders(updated)
      lsSet(LS_KEY, updated)
    } else {
      const { data, error } = await supabase
        .from('catering_orders')
        .insert({
          store_id:             newOrder.store_id,
          customer_name:        newOrder.customer_name,
          customer_wa:          newOrder.customer_wa,
          customer_institution: newOrder.customer_institution,
          event_date:           newOrder.event_date,
          event_time:           newOrder.event_time,
          location:             newOrder.location,
          items:                newOrder.items,
          total:                newOrder.total,
          dp_amount:            newOrder.dp_amount,
          status:               newOrder.status,
          payment_method:       newOrder.payment_method,
          notes:                newOrder.notes,
        })
        .select()
        .single()
      if (!error && data) {
        updated = [...orders, data as CateringOrder].sort(
          (a, b) => a.event_date.localeCompare(b.event_date)
        )
        setOrders(updated)
      }
    }
    setShowAdd(false)
  }, [isDummy, orders, currentStore?.id])

  // ── Update status ─────────────────────────────────────────────────────────────
  const handleStatusChange = useCallback(async (id: string, status: OrderStatus) => {
    const updated = orders.map(o =>
      o.id === id
        ? { ...o, status, remaining: status === 'lunas' || status === 'selesai' ? 0 : o.remaining }
        : o
    )
    setOrders(updated)

    if (!isDummy && navigator.onLine) {
      await supabase.from('catering_orders').update({ status }).eq('id', id)
    } else {
      lsSet(LS_KEY, updated)
    }
  }, [isDummy, orders])

  // ── Filtered orders ───────────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    orders.filter(o => filter === 'semua' || o.status === filter)
  , [orders, filter])

  const counts = useMemo(() => {
    const c: Record<string, number> = { semua: orders.length }
    orders.forEach(o => { c[o.status] = (c[o.status] ?? 0) + 1 })
    return c
  }, [orders])

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now       = new Date(); now.setHours(0,0,0,0)
    const thisMonth = new Date().toISOString().slice(0, 7) // 'YYYY-MM'

    // Acara terdekat (belum selesai, event_date >= hari ini)
    const upcoming = orders
      .filter(o => o.status !== 'selesai' && o.event_date >= today)
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
    const nearest = upcoming[0] ?? null

    // Piutang aktif (belum lunas/selesai)
    const piutangOrders = orders.filter(o => o.status !== 'lunas' && o.status !== 'selesai')
    const totalPiutang  = piutangOrders.reduce((s, o) => s + o.remaining, 0)

    // Order bulan ini
    const bulanIni      = orders.filter(o => o.event_date.startsWith(thisMonth))
    const totalBulanIni = bulanIni.reduce((s, o) => s + o.total, 0)

    // Perlu perhatian: overdue + urgent (≤3 hari, belum selesai)
    const needAttention = orders.filter(o => {
      const d = daysUntil(o.event_date)
      return o.status !== 'selesai' && (
        (d < 0 && o.status !== 'lunas') ||   // overdue
        (d >= 0 && d <= 3)                    // urgent
      )
    })

    return {
      totalTagihan: orders.reduce((s, o) => s + o.total, 0),
      totalDP:      orders.reduce((s, o) => s + o.dp_amount, 0),
      totalSisa:    orders.reduce((s, o) => s + o.remaining, 0),
      nearest,
      nearestDays:  nearest ? daysUntil(nearest.event_date) : null,
      totalPiutang,
      piutangCount: piutangOrders.length,
      bulanIniCount:   bulanIni.length,
      totalBulanIni,
      attentionCount:  needAttention.length,
      overdueCount:    needAttention.filter(o => daysUntil(o.event_date) < 0).length,
      urgentCount:     needAttention.filter(o => { const d = daysUntil(o.event_date); return d >= 0 && d <= 3 }).length,
    }
  }, [orders])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingBottom: 80 }}>

      {/* ── WRAPPER — batasi lebar di desktop ──────────────────────────────────── */}
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* HERO — ikut struktur referensi persis */}
        <div style={{ background: 'var(--accent)', padding: '20px 20px 32px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
              🍱 Catering
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="view-toggle" style={{ display: 'flex', background: 'rgba(0,0,0,0.18)', borderRadius: 8, padding: 3, gap: 2 }}>
                {([['list','☰'],['kanban','⊞'],['timeline','◎']] as const).map(([mode, icon]) => (
                  <button key={mode} onClick={() => setViewMode(mode)} style={{
                    padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 12, color: '#fff',
                    background: viewMode === mode ? 'rgba(255,255,255,0.22)' : 'transparent',
                  }}>{icon}</button>
                ))}
              </div>
              <button onClick={() => setShowAdd(true)} style={{
                background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
              }}>+ Order</button>
            </div>
          </div>

          <p style={{ margin: '0 0 6px', fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500, letterSpacing: '.03em', textTransform: 'uppercase' }}>
            Total piutang aktif
          </p>
          <p style={{ margin: 0, fontSize: 36, fontWeight: 800, color: '#fff', lineHeight: 1, letterSpacing: '-1px' }}>
            {fmt(stats.totalPiutang)}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
            {orders.length} order · {stats.piutangCount} belum lunas
          </p>
        </div>

        {/* CARDS FLOAT — persis referensi: grid 2 col, marginTop negatif, z-index */}
        {orders.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
            padding: '0 14px', marginTop: -18, position: 'relative', zIndex: 2,
          }}>
            {/* Acara Terdekat */}
            <div style={{ background: '#fff', borderRadius: 14, padding: '13px 14px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
              <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Acara Terdekat
              </p>
              {stats.nearest ? (
                <>
                  <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: '#111', lineHeight: 1.1 }}>
                    {stats.nearest.customer_name}
                  </p>
                  <p style={{ margin: '0 0 5px', fontSize: 11, color: '#9CA3AF' }}>
                    {fmtDateShort(stats.nearest.event_date)}
                    {stats.nearest.event_time ? ` · ${stats.nearest.event_time}` : ''}
                  </p>
                  <span style={{
                    display: 'inline-block', fontSize: 10, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 99,
                    background: stats.nearestDays === 0 ? '#FEF2F2' : stats.nearestDays! <= 3 ? '#FFFBEB' : '#F0FDF4',
                    color:      stats.nearestDays === 0 ? '#DC2626' : stats.nearestDays! <= 3 ? '#B45309' : '#15803D',
                  }}>
                    {stats.nearestDays === 0 ? 'Hari ini' : stats.nearestDays === 1 ? 'Besok' : `${stats.nearestDays} hari lagi`}
                  </span>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>Belum ada</p>
              )}
            </div>

            {/* Bulan Ini */}
            <div style={{ background: '#fff', borderRadius: 14, padding: '13px 14px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
              <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Bulan Ini
              </p>
              <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#111', lineHeight: 1.1 }}>
                {stats.bulanIniCount} order
              </p>
              <p style={{ margin: '0 0 5px', fontSize: 11, color: '#9CA3AF' }}>
                {fmt(stats.totalBulanIni)} nilai
              </p>
              <span style={{
                display: 'inline-block', fontSize: 10, fontWeight: 700,
                padding: '2px 8px', borderRadius: 99,
                background: stats.attentionCount > 0 ? '#FFFBEB' : '#F0FDF4',
                color:      stats.attentionCount > 0 ? '#B45309' : '#15803D',
              }}>
                {stats.attentionCount > 0 ? `${stats.attentionCount} perlu perhatian` : 'Aman ✓'}
              </span>
            </div>
          </div>
        )}

        {/* BODY — background abu seperti referensi */}
        <div style={{ background: 'var(--bg-base)', padding: '18px 14px 0' }}>

          {/* Filter tabs — merah saat aktif persis referensi */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 2 }}
            className="hide-scroll">
            {FILTER_TABS.map(tab => {
              const active = filter === tab.key
              const count  = counts[tab.key] ?? 0
              return (
                <button key={tab.key} onClick={() => setFilter(tab.key)} style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: 99,
                  border: `1.5px solid ${active ? 'var(--accent)' : '#E5E7EB'}`,
                  background: active ? 'var(--accent)' : '#fff',
                  color:      active ? '#fff' : '#6B7280',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                  transition: 'all 0.12s',
                }}>
                  {tab.key !== 'semua' && (
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
                      background: active ? 'rgba(255,255,255,0.7)' : STATUS_CFG[tab.key as OrderStatus].dot,
                    }} />
                  )}
                  {tab.label}
                  {count > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '0 6px', borderRadius: 99,
                      background: active ? 'rgba(255,255,255,0.25)' : '#F3F4F6',
                      color:      active ? '#fff' : '#6B7280',
                    }}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Section label */}
          <p style={{ margin: '0 0 10px 2px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {filtered.length} order ditemukan
          </p>

        </div>
      </div>

      {/* ── Content — masuk dalam wrapper maxWidth 480 ──────────────────────── */}
      <div style={{ maxWidth: 480, margin: '0 auto', background: 'var(--bg-base)', padding: '0 14px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{
                height: 120, borderRadius: 12, background: '#fff',
                border: '1px solid #F3F4F6',
                animation: 'pulse 1.4s ease-in-out infinite',
              }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState filter={filter} onAdd={() => setShowAdd(true)} />
        ) : (
          <>
            {/* Mobile: selalu list */}
            <div className="mobile-list">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map(o => (
                  <OrderCard key={o.id} order={o} onClick={() => setDetailOrder(o)} />
                ))}
              </div>
            </div>

            {/* Desktop: sesuai viewMode */}
            <div className="desktop-view">
              {viewMode === 'list' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filtered.map(o => (
                    <OrderCard key={o.id} order={o} onClick={() => setDetailOrder(o)} />
                  ))}
                </div>
              )}
              {viewMode === 'kanban' && (
                <KanbanView orders={filtered} onCardClick={setDetailOrder} />
              )}
              {viewMode === 'timeline' && (
                <TimelineView orders={filtered} onCardClick={setDetailOrder} />
              )}
            </div>
          </>
        )}
      </div>

      {/* Mobile FAB */}
      <button
        onClick={() => setShowAdd(true)}
        className="mobile-fab"
        aria-label="Tambah order"
        style={{
          position: 'fixed', bottom: 84, right: 20,
          width: 50, height: 50, borderRadius: '50%',
          background: 'var(--accent)', color: '#fff', border: 'none',
          fontSize: 22, cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(217,43,43,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >+</button>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }

        /* Mobile */
        @media (max-width: 767px) {
          .desktop-view { display: none !important; }
          .mobile-list  { display: block !important; }
          .view-toggle  { display: none !important; }
        }

        @media (min-width: 768px) {
          .desktop-view { display: block !important; }
          .mobile-list  { display: none !important; }
          .mobile-fab   { display: none !important; }
        }

        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Modals */}
      {showAdd && (
        <AddOrderModal onClose={() => setShowAdd(false)} onSave={handleSave} />
      )}
      {detailOrder && (
        <DetailSheet
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          onStatusChange={(id, status) => {
            handleStatusChange(id, status)
            setDetailOrder(prev => prev?.id === id ? { ...prev, status } : prev)
          }}
        />
      )}
    </div>
  )
}