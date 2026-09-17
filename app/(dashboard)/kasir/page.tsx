'use client'

import { useMemo, useCallback, useState } from 'react'
import { Plus, Minus, Trash2, Check, User, Banknote, Smartphone } from 'lucide-react'
import { useAppStore } from '@/lib/store/appStore'
import { useToast } from '@/components/shared/Toast'
import { createClient } from '@/lib/supabase/client'
import type { Product } from '@/types'

interface CartItem { product: Product; qty: number }
type PayMethod = 'cash' | 'qris'

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

export default function KasirPage() {
  const allProducts = useAppStore((s) => s.products)
  const currentStore = useAppStore((s) => s.currentStore)
  const addPendingSync = useAppStore((s) => s.addPendingSync)
  const { toast } = useToast()

  const products = useMemo(() => allProducts.filter((p) => p.is_active), [allProducts])

  const [customerName, setCustomerName] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [payMethod, setPayMethod] = useState<PayMethod>('cash')
  const [submitting, setSubmitting] = useState(false)

  const getQty = (id: string) => cart.find((c) => c.product.id === id)?.qty ?? 0

  const add = useCallback((product: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product.id === product.id)
      if (idx > -1) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
        return next
      }
      return [...prev, { product, qty: 1 }]
    })
  }, [])

  const minus = useCallback((id: string) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product.id === id)
      if (idx === -1) return prev
      if (prev[idx].qty <= 1) return prev.filter((c) => c.product.id !== id)
      const next = [...prev]
      next[idx] = { ...next[idx], qty: next[idx].qty - 1 }
      return next
    })
  }, [])

  const remove = useCallback((id: string) => {
    setCart((prev) => prev.filter((c) => c.product.id !== id))
  }, [])

  const total = cart.reduce((s, c) => s + c.product.price * c.qty, 0)
  const totalItems = cart.reduce((s, c) => s + c.qty, 0)

  const handleCheckout = useCallback(async () => {
    if (cart.length === 0) return
    setSubmitting(true)
    const now = new Date().toISOString()
    const date = now.slice(0, 10)
    const note = [customerName.trim(), payMethod === 'cash' ? 'Tunai' : 'QRIS'].filter(Boolean).join(' · ')

    const records = cart.map((item) => ({
      store_id: currentStore?.id ?? 'dummy-store-001',
      type: 'income' as const,
      product_id: item.product.id,
      product_name: item.product.name,
      category: 'Penjualan',
      qty: item.qty,
      amount: item.product.price * item.qty,
      profit: (item.product.price - item.product.hpp) * item.qty,
      note,
      date,
      source: 'kasir' as const,
      created_at: now,
    }))

    try {
      if (!navigator.onLine) throw new Error('offline')
      const supabase = createClient()
      const { error } = await supabase.from('transactions').insert(records)
      if (error) throw error
    } catch {
      records.forEach((r) =>
        addPendingSync({ table: 'transactions', action: 'insert', payload: { ...r, id: crypto.randomUUID() } })
      )
    }

    toast(`✅ ${totalItems} item berhasil dicatat!`, 'success')
    setCart([])
    setCustomerName('')
    setPayMethod('cash')
    setSubmitting(false)
  }, [cart, currentStore, customerName, payMethod, addPendingSync, toast, totalItems])

  const PAY_OPTIONS: { key: PayMethod; label: string; icon: React.ReactNode }[] = [
    { key: 'cash', label: 'Tunai', icon: <Banknote size={16} /> },
    { key: 'qris', label: 'QRIS', icon: <Smartphone size={16} /> },
  ]

  return (
    <>
      {/* ══ DESKTOP / TABLET ≥768px — split layout ══ */}
      <div className="kasir-desktop">
        {/* Kolom kiri — menu */}
        <div className="kasir-left">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>Kasir</h1>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                {products.length} menu tersedia
              </p>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '6px 12px' }}>
              {new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>
          <MenuGrid products={products} getQty={getQty} onAdd={add} onMinus={minus} />
        </div>

        {/* Kolom kanan — order panel */}
        <div className="kasir-right">
          {/* Header */}
          <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
              Pesanan
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--bg-elevated)', border: '1.5px solid var(--border)',
              borderRadius: 12, padding: '10px 12px' }}>
              <User size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <input type="text" value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nama customer (opsional)"
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent',
                  fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit' }} />
              {customerName && (
                <button onClick={() => setCustomerName('')} style={{ border: 'none', background: 'none',
                  cursor: 'pointer', color: 'var(--text-muted)', padding: 0, fontSize: 18, lineHeight: 1 }}>×</button>
              )}
            </div>
          </div>

          {/* List item */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
            {cart.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', minHeight: 140,
                color: 'var(--text-muted)', gap: 8 }}>
                <span style={{ fontSize: 40 }}>🛒</span>
                <p style={{ margin: 0, fontSize: 13 }}>Belum ada item dipilih</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cart.map((item) => (
                  <div key={item.product.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                    background: 'var(--bg-elevated)', borderRadius: 12, padding: '10px 12px' }}>
                    {item.product.photo_url ? (
                  <img src={item.product.photo_url} alt={item.product.name} style={{
                    width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0,
                  }} />
                ) : (
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{item.product.icon}</span>
                )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 1px', fontSize: 13, fontWeight: 600,
                        color: 'var(--text-primary)', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product.name}</p>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                        {formatRp(item.product.price * item.qty)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      <button onClick={() => minus(item.product.id)} style={qBtn('var(--bg-surface)', 'var(--text-primary)')}>
                        <Minus size={11} />
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 800, minWidth: 18,
                        textAlign: 'center', color: 'var(--text-primary)' }}>{item.qty}</span>
                      <button onClick={() => add(item.product)} style={qBtn('var(--accent)', 'white')}>
                        <Plus size={11} />
                      </button>
                      <button onClick={() => remove(item.product.id)}
                        style={{ ...qBtn('var(--danger-bg)', 'var(--danger)'), marginLeft: 2 }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer pembayaran + checkout */}
          <div style={{ padding: '14px 20px 24px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              Pembayaran
            </p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              {PAY_OPTIONS.map((o) => (
                <button key={o.key} onClick={() => setPayMethod(o.key)} style={{
                  flex: 1, padding: '11px 8px', borderRadius: 12, cursor: 'pointer',
                  border: payMethod === o.key ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                  background: payMethod === o.key ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                  color: payMethod === o.key ? 'var(--accent)' : 'var(--text-secondary)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  fontSize: 12, fontWeight: 700, transition: 'all 0.15s ease',
                }}>
                  {o.icon}
                  {o.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{totalItems} item</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                  {payMethod === 'cash' ? '💵 Tunai' : '📱 QRIS'}
                </p>
              </div>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)',
                fontFamily: 'Nunito, sans-serif' }}>{formatRp(total)}</span>
            </div>
            <button onClick={handleCheckout} disabled={submitting || cart.length === 0} style={{
              width: '100%', padding: '15px', borderRadius: 14, border: 'none',
              background: cart.length === 0 ? 'var(--border)' : 'var(--accent)',
              color: 'white', fontSize: 15, fontWeight: 800,
              cursor: cart.length === 0 ? 'not-allowed' : submitting ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: cart.length > 0 ? '0 4px 20px rgba(217,43,43,0.3)' : 'none',
              opacity: cart.length === 0 ? 0.5 : 1, transition: 'all 0.15s ease',
            }}>
              {submitting ? 'Menyimpan...' : <><Check size={18} /> Selesai &amp; Catat</>}
            </button>
          </div>
        </div>
      </div>

      {/* ══ MOBILE <768px ══ */}
      <div className="kasir-mobile">
        {/* Header */}
        <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>Kasir</h1>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{products.length} menu tersedia</p>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '5px 10px' }}>
            {new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>

        {/* Input customer */}
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg-surface)', border: '1.5px solid var(--border)',
            borderRadius: 12, padding: '11px 14px' }}>
            <User size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input type="text" value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nama customer (opsional)"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 14, color: 'var(--text-primary)', fontFamily: 'inherit' }} />
            {customerName && (
              <button onClick={() => setCustomerName('')} style={{ border: 'none', background: 'none',
                cursor: 'pointer', color: 'var(--text-muted)', padding: 0, fontSize: 18, lineHeight: 1 }}>×</button>
            )}
          </div>
        </div>

        <p style={{ margin: '16px 16px 10px', fontSize: 11, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
          Pilih Menu
        </p>

        <div style={{ padding: '0 16px' }}>
          <MenuGrid products={products} getQty={getQty} onAdd={add} onMinus={minus} />
        </div>

        {/* ── STICKY CART MOBILE ── */}
        {cart.length > 0 && (
          <div style={{
            position: 'fixed', bottom: 64, left: 0, right: 0, /* 64px = tinggi bottom nav */
            background: 'var(--bg-surface)',
            borderTop: '2px solid var(--border)',
            borderRadius: '20px 20px 0 0',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
            zIndex: 30,
            maxHeight: '48dvh',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Handle */}
            <div style={{ width: 36, height: 4, background: 'var(--border)',
              borderRadius: 99, margin: '10px auto 0', flexShrink: 0 }} />

            {/* Label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px 6px', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Pesanan</span>
              {customerName && (
                <span style={{ fontSize: 12, fontWeight: 600,
                  background: 'var(--accent-subtle)', color: 'var(--accent)',
                  borderRadius: 8, padding: '2px 8px' }}>{customerName}</span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 12, background: 'var(--accent)',
                color: 'white', borderRadius: 99, padding: '2px 8px', fontWeight: 700 }}>
                {totalItems} item
              </span>
            </div>

            {/* List item scrollable */}
            <div style={{ overflowY: 'auto', padding: '0 16px 6px',
              display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 112, minHeight: 0 }}>
              {cart.map((item) => (
                <div key={item.product.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                  background: 'var(--bg-elevated)', borderRadius: 12, padding: '8px 12px' }}>
                  {item.product.photo_url ? (
                    <img src={item.product.photo_url} alt={item.product.name} style={{
                      width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0,
                    }} />
                  ) : (
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{item.product.icon}</span>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.product.name}</p>
                    <p style={{ margin: '1px 0 0', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                      {formatRp(item.product.price * item.qty)}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    <button onClick={() => minus(item.product.id)} style={qBtn('var(--bg-surface)', 'var(--text-primary)')}>
                      <Minus size={11} /></button>
                    <span style={{ fontSize: 13, fontWeight: 800, minWidth: 18, textAlign: 'center' }}>{item.qty}</span>
                    <button onClick={() => add(item.product)} style={qBtn('var(--accent)', 'white')}>
                      <Plus size={11} /></button>
                    <button onClick={() => remove(item.product.id)}
                      style={{ ...qBtn('var(--danger-bg)', 'var(--danger)'), marginLeft: 2 }}>
                      <Trash2 size={11} /></button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pembayaran */}
            <div style={{ padding: '8px 16px 0', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                {PAY_OPTIONS.map((o) => (
                  <button key={o.key} onClick={() => setPayMethod(o.key)} style={{
                    flex: 1, padding: '6px 8px', borderRadius: 10, cursor: 'pointer',
                    border: payMethod === o.key ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                    background: payMethod === o.key ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                    color: payMethod === o.key ? 'var(--accent)' : 'var(--text-secondary)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    fontSize: 12, fontWeight: 700, transition: 'all 0.15s ease',
                  }}>
                    {o.icon}{o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Total + tombol */}
            <div style={{ padding: '0 16px 14px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Total</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)',
                  fontFamily: 'Nunito, sans-serif' }}>{formatRp(total)}</span>
              </div>
              <button onClick={handleCheckout} disabled={submitting} style={{
                width: '100%', padding: '11px', borderRadius: 12, border: 'none',
                background: submitting ? '#bbb' : 'var(--accent)',
                color: 'white', fontSize: 13, fontWeight: 800,
                cursor: submitting ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 20px rgba(217,43,43,0.3)',
              }}>
                {submitting ? 'Menyimpan...' : <><Check size={18} /> Selesai &amp; Catat</>}
              </button>
            </div>
          </div>
        )}

        {/* Spacer bawah agar konten tidak ketutup cart */}
        <div style={{ height: cart.length > 0 ? 380 : 80 }} />
      </div>

      <style jsx global>{`
        /* Desktop split */
        .kasir-desktop {
          display: none;
          height: calc(100dvh - 56px);
          overflow: hidden;
        }
        .kasir-left {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
          border-right: 1px solid var(--border);
        }
        .kasir-right {
          width: 380px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-left: 1px solid var(--border);
        }
        /* Mobile single column */
        .kasir-mobile { display: block; }

        @media (min-width: 768px) {
          .kasir-desktop { display: flex !important; }
          .kasir-mobile  { display: none !important; }
        }

        /* Menu grid kolom */
        .menu-grid { grid-template-columns: repeat(2, 1fr); }
        @media (min-width: 900px) {
          .menu-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>
    </>
  )
}

function MenuGrid({ products, getQty, onAdd, onMinus }: {
  products: Product[]
  getQty: (id: string) => number
  onAdd: (p: Product) => void
  onMinus: (id: string) => void
}) {
  if (products.length === 0) return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>🍽️</div>
      <p style={{ margin: 0, fontWeight: 600 }}>Belum ada menu</p>
      <p style={{ margin: '4px 0 0', fontSize: 13 }}>Tambah produk di Pengaturan</p>
    </div>
  )

  return (
    <div style={{ display: 'grid', gap: 10 }} className="menu-grid">
      {products.map((product) => {
        const qty = getQty(product.id)
        const inCart = qty > 0
        return (
          <div key={product.id} style={{
            background: 'var(--bg-surface)',
            border: inCart ? '2px solid var(--accent)' : '1.5px solid var(--border)',
            borderRadius: 16, overflow: 'hidden',
            boxShadow: inCart ? '0 4px 16px rgba(217,43,43,0.10)' : '0 1px 4px rgba(0,0,0,0.04)',
            transition: 'border-color 0.15s ease',
          }}>
            <div onClick={() => onAdd(product)} style={{
              width: '100%', aspectRatio: '1.3',
              background: inCart ? 'rgba(217,43,43,0.05)' : 'var(--bg-elevated)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 44,
              WebkitTapHighlightColor: 'transparent',
            }}>
              {product.photo_url ? (
                <img src={product.photo_url} alt={product.name} style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                }} />
              ) : product.icon}
            </div>
            <div style={{ padding: '10px 12px 12px' }}>
              <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700,
                color: 'var(--text-primary)', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</p>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800,
                color: 'var(--accent)', fontFamily: 'Nunito, sans-serif' }}>
                {formatRp(product.price)}</p>
              {inCart ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--bg-elevated)', borderRadius: 10, padding: '3px' }}>
                  <button onClick={() => onMinus(product.id)} style={qBtn('var(--bg-surface)', 'var(--text-primary)')}>
                    <Minus size={13} /></button>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)',
                    minWidth: 28, textAlign: 'center', fontFamily: 'Nunito, sans-serif' }}>{qty}</span>
                  <button onClick={() => onAdd(product)} style={qBtn('var(--accent)', 'white')}>
                    <Plus size={13} /></button>
                </div>
              ) : (
                <button onClick={() => onAdd(product)} style={{
                  width: '100%', padding: '7px 0', borderRadius: 10,
                  border: '1.5px solid var(--accent)', background: 'transparent',
                  color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}>
                  <Plus size={14} /> Tambah
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function qBtn(bg: string, color: string): React.CSSProperties {
  return {
    width: 28, height: 28, borderRadius: 8, background: bg, color, border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0,
  }
}