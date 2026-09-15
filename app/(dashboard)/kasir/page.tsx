'use client'

import { useCallback, useMemo } from 'react'
import { Calendar } from 'lucide-react'
import { useAppStore } from '@/lib/store/appStore'
import { useToast } from '@/components/shared/Toast'
import { useKasir } from '@/lib/hooks/useKasir'
import { ProductGrid } from '@/components/kasir/ProductGrid'
import { Cart } from '@/components/kasir/Cart'

export default function KasirPage() {
  const allProducts = useAppStore((s) => s.products)
  const products = useMemo(() => allProducts.filter((p) => p.is_active), [allProducts])
  const { toast } = useToast()

  const {
    cart,
    selectedDate,
    setSelectedDate,
    isSubmitting,
    totalAmount,
    totalItems,
    addToCart,
    updateQty,
    removeFromCart,
    submitCart,
  } = useKasir()

  const handleTapProduct = useCallback((product: typeof products[number]) => {
    addToCart(product)
  }, [addToCart])

  const handleSubmit = useCallback(async () => {
    if (cart.length === 0) return
    const ok = await submitCart()
    if (ok) {
      toast(`✅ ${totalItems} item berhasil dicatat!`, 'success')
    } else {
      toast('Gagal menyimpan transaksi', 'error')
    }
  }, [submitCart, toast, cart.length, totalItems])

  const displayDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <>
      {/* HEADER */}
      <div style={{
        position: 'sticky', top: 52, zIndex: 15,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ margin: '0 0 2px', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
            Kasir
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            {products.length} produk aktif
          </p>
        </div>

        <div style={{ position: 'relative' }}>
          <label htmlFor="kasir-date" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '8px 12px', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap',
          }}>
            <Calendar size={14} color="var(--accent)" />
            <span>{displayDate}</span>
          </label>
          <input
            id="kasir-date" type="date" value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
          />
        </div>
      </div>

      {/* PRODUCT GRID */}
      <div style={{
        paddingBottom: cart.length === 0 ? 'calc(64px + 70px)' : 'calc(64px + 260px)',
        minHeight: '60dvh',
        transition: 'padding-bottom 0.3s ease',
      }}>
        <ProductGrid products={products} cart={cart} onTap={handleTapProduct} />
      </div>

      {/* CART */}
      <Cart
        cart={cart}
        totalAmount={totalAmount}
        totalItems={totalItems}
        isSubmitting={isSubmitting}
        onUpdateQty={updateQty}
        onRemove={removeFromCart}
        onSubmit={handleSubmit}
      />
    </>
  )
}
