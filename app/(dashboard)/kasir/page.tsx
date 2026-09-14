'use client'

import { useState, useMemo } from 'react'
import { Minus, Plus, X, CheckCircle, ShoppingCart } from 'lucide-react'
import { useAppStore } from '@/lib/store/appStore'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah, toISODate } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import type { Product, CartItem } from '@/types'

export default function KasirPage() {
  const products = useAppStore((s) => s.products)
  const currentStore = useAppStore((s) => s.currentStore)
  const addPendingSync = useAppStore((s) => s.addPendingSync)
  const { toast } = useToast()

  const [cart, setCart] = useState<CartItem[]>([])
  const [date, setDate] = useState(toISODate())
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const total = useMemo(() => cart.reduce((s, i) => s + i.subtotal, 0), [cart])
  const totalProfit = useMemo(
    () => cart.reduce((s, i) => s + (i.product.price - i.product.hpp) * i.qty, 0),
    [cart]
  )

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, qty: i.qty + 1, subtotal: (i.qty + 1) * product.price }
            : i
        )
      }
      return [...prev, { product, qty: 1, subtotal: product.price }]
    })
  }

  function setQty(productId: string, qty: number) {
    if (qty <= 0) { setCart((prev) => prev.filter((i) => i.product.id !== productId)); return }
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === productId ? { ...i, qty, subtotal: qty * i.product.price } : i
      )
    )
  }

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId))
  }

  async function handleSelesai() {
    if (cart.length === 0 || !currentStore) return
    setLoading(true)
    const supabase = createClient()
    const transactions = cart.map((item) => ({
      store_id: currentStore.id, type: 'income' as const,
      product_id: item.product.id, product_name: item.product.name,
      category: 'Penjualan', qty: item.qty, amount: item.subtotal,
      profit: (item.product.price - item.product.hpp) * item.qty,
      date, source: 'kasir' as const,
    }))
    const { error } = await supabase.from('transactions').insert(transactions)
    if (error) {
      transactions.forEach((t) => addPendingSync({ table: 'transactions', action: 'insert', payload: t }))
      toast('Disimpan offline, akan sync saat online', 'warning')
    } else {
      toast('Transaksi berhasil disimpan!', 'success')
    }
    setSuccess(true)
    setTimeout(() => { setSuccess(false); setCart([]) }, 1200)
    setLoading(false)
  }

  const cartQty = (productId: string) => cart.find((i) => i.product.id === productId)?.qty ?? 0

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', paddingBottom: 180 }}>
      <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Kasir
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tanggal:</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              style={{ fontSize: 13, fontWeight: 600, border: '1px solid var(--border)',
                borderRadius: 8, padding: '4px 8px', background: 'var(--bg-surface)',
                color: 'var(--text-primary)' }} />
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🍽️</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              Belum ada produk. Tambah produk di Pengaturan dulu ya.
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 12 }}>
              Pilih Produk — Tap untuk tambah ke keranjang
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: 10 }}>
              {products.map((product) => (
                <ProductCard key={product.id} product={product}
                  qty={cartQty(product.id)} onTap={() => addToCart(product)} />
              ))}
            </div>
          </>
        )}
      </div>

      {cart.length > 0 && (
        <div style={{ position: 'fixed', bottom: 'var(--nav-height)', left: 0, right: 0,
          background: 'var(--bg-surface)', borderTop: '1px solid var(--border)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.12)', zIndex: 20,
          maxHeight: '55dvh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px 8px' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
              display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShoppingCart size={16} color="var(--accent)" />
              Keranjang ({cart.length} item)
            </span>
            <button onClick={() => setCart([])} style={{ fontSize: 12, color: 'var(--danger)',
              background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              Kosongkan
            </button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '0 16px' }}>
            {cart.map((item) => (
              <CartRow key={item.product.id} item={item}
                onQtyChange={(qty) => setQty(item.product.id, qty)}
                onRemove={() => removeItem(item.product.id)} />
            ))}
          </div>
          <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 2px' }}>Total</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', margin: 0,
                  fontFamily: 'Nunito, sans-serif' }}>{formatRupiah(total)}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 2px' }}>Est. Laba</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)', margin: 0,
                  fontFamily: 'Nunito, sans-serif' }}>{formatRupiah(totalProfit)}</p>
              </div>
            </div>
            <button onClick={handleSelesai} disabled={loading || success}
              style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                background: success ? 'var(--success)' : 'var(--accent)',
                color: 'white', fontSize: 15, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.3s' }}>
              {success ? <><CheckCircle size={18} /> Tersimpan!</>
                : loading ? 'Menyimpan...'
                : `Selesai — ${formatRupiah(total)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ProductCard({ product, qty, onTap }: { product: Product; qty: number; onTap: () => void }) {
  return (
    <button onClick={onTap} style={{
      background: qty > 0 ? 'var(--accent-subtle)' : 'var(--bg-surface)',
      border: `2px solid ${qty > 0 ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 16, padding: '14px 10px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      cursor: 'pointer', transition: 'all 0.15s', position: 'relative', width: '100%',
    }}>
      {qty > 0 && (
        <span style={{ position: 'absolute', top: 8, right: 8, background: 'var(--accent)',
          color: 'white', borderRadius: '50%', width: 22, height: 22,
          fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {qty}
        </span>
      )}
      {product.photo_url ? (
        <img src={product.photo_url} alt={product.name}
          style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover' }} />
      ) : (
        <span style={{ fontSize: 36 }}>{product.icon}</span>
      )}
      <div style={{ width: '100%', textAlign: 'center' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
          margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {product.name}
        </p>
        <p style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700,
          margin: 0, fontFamily: 'Nunito, sans-serif' }}>{formatRupiah(product.price)}</p>
      </div>
    </button>
  )
}

function CartRow({ item, onQtyChange, onRemove }: {
  item: CartItem; onQtyChange: (qty: number) => void; onRemove: () => void
}) {
  const qBtn: React.CSSProperties = { width: 26, height: 26, borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>{item.product.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 1px', color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product.name}</p>
        <p style={{ fontSize: 12, color: 'var(--accent)', margin: 0,
          fontFamily: 'Nunito, sans-serif', fontWeight: 700 }}>{formatRupiah(item.subtotal)}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <button onClick={() => onQtyChange(item.qty - 1)} style={qBtn}><Minus size={12} /></button>
        <input type="number" value={item.qty} min={1}
          onChange={(e) => onQtyChange(Number(e.target.value))}
          style={{ width: 36, textAlign: 'center', fontSize: 14, fontWeight: 700,
            border: '1px solid var(--border)', borderRadius: 8, padding: '4px 2px',
            background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
        <button onClick={() => onQtyChange(item.qty + 1)}
          style={{ ...qBtn, background: 'var(--accent)', color: 'white', border: 'none' }}>
          <Plus size={12} /></button>
        <button onClick={onRemove}
          style={{ ...qBtn, background: 'var(--danger-bg)', color: 'var(--danger)', border: 'none', marginLeft: 2 }}>
          <X size={12} /></button>
      </div>
    </div>
  )
}
