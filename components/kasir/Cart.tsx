'use client'

import { Minus, Plus, X, ShoppingBag, Check } from 'lucide-react'
import type { CartItem } from '@/types'

interface CartProps {
  cart: CartItem[]
  totalAmount: number
  totalItems: number
  isSubmitting: boolean
  onUpdateQty: (productId: string, newQty: number) => void
  onRemove: (productId: string) => void
  onSubmit: () => void
}

export function Cart({
  cart,
  totalAmount,
  totalItems,
  isSubmitting,
  onUpdateQty,
  onRemove,
  onSubmit,
}: CartProps) {
  if (cart.length === 0) {
    return (
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 20,
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)',
        padding: '14px 16px 20px',
        // Extra padding untuk bottom nav
        paddingBottom: 'calc(20px + 64px)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          color: 'var(--text-muted)',
        }}>
          <ShoppingBag size={18} />
          <span style={{ fontSize: 14 }}>Tap produk untuk menambahkan ke keranjang</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="cart-container animate-slide-up"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 20,
        background: 'var(--bg-surface)',
        borderTop: '2px solid var(--border)',
        boxShadow: '0 -8px 32px rgba(217,43,43,0.10)',
        borderRadius: '20px 20px 0 0',
        maxHeight: '60dvh',
        display: 'flex', flexDirection: 'column',
        // Extra bottom padding untuk bottom nav
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Drag handle */}
      <div style={{
        width: 36, height: 4,
        background: 'var(--border-strong)',
        borderRadius: 99,
        margin: '10px auto 0',
        flexShrink: 0,
      }} />

      {/* Header cart */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '10px 16px 8px',
        flexShrink: 0,
      }}>
        <ShoppingBag size={16} color="var(--accent)" />
        <span style={{
          marginLeft: 8, fontSize: 13, fontWeight: 700,
          color: 'var(--text-secondary)',
        }}>
          Keranjang
        </span>
        <span style={{
          marginLeft: 6,
          background: 'var(--accent)', color: 'white',
          borderRadius: 99, minWidth: 20, height: 20,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, padding: '0 5px',
        }}>
          {totalItems}
        </span>
      </div>

      {/* List item — scrollable */}
      <div style={{
        overflowY: 'auto',
        flexShrink: 1,
        padding: '0 16px 8px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {cart.map((item) => (
          <div key={item.product.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--bg-elevated)',
            borderRadius: 14, padding: '10px 12px',
          }}>
            {/* Emoji / icon */}
            <span style={{ fontSize: 24, flexShrink: 0, lineHeight: 1 }}>
              {item.product.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.product.photo_url}
                  alt={item.product.name}
                  style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }}
                />
              ) : item.product.icon}
            </span>

            {/* Nama + subtotal */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: '0 0 2px', fontSize: 13, fontWeight: 600,
                color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {item.product.name}
              </p>
              <p style={{
                margin: 0, fontSize: 12, fontWeight: 700,
                color: 'var(--accent)',
                fontFamily: 'Nunito, sans-serif',
              }}>
                {formatRupiah(item.subtotal)}
              </p>
            </div>

            {/* Qty controls */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
            }}>
              <button
                onClick={() => onUpdateQty(item.product.id, item.qty - 1)}
                aria-label="Kurangi qty"
                style={qtyBtnStyle}
              >
                <Minus size={12} />
              </button>

              <input
                type="number"
                value={item.qty}
                min={1}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10)
                  if (!isNaN(val)) onUpdateQty(item.product.id, val)
                }}
                style={{
                  width: 36, textAlign: 'center',
                  border: '1px solid var(--border)',
                  borderRadius: 8, padding: '4px 2px',
                  fontSize: 14, fontWeight: 700,
                  color: 'var(--text-primary)',
                  background: 'var(--bg-surface)',
                  outline: 'none',
                  fontFamily: 'Nunito, sans-serif',
                }}
              />

              <button
                onClick={() => onUpdateQty(item.product.id, item.qty + 1)}
                aria-label="Tambah qty"
                style={{ ...qtyBtnStyle, background: 'var(--accent)', color: 'white', border: 'none' }}
              >
                <Plus size={12} />
              </button>

              <button
                onClick={() => onRemove(item.product.id)}
                aria-label={`Hapus ${item.product.name}`}
                style={{
                  ...qtyBtnStyle,
                  marginLeft: 2,
                  background: 'var(--danger-bg)', color: 'var(--danger)', border: 'none',
                }}
              >
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer — total + tombol Selesai */}
      <div style={{
        padding: '10px 16px 16px',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
        background: 'var(--bg-surface)',
        paddingBottom: 'calc(16px + 64px)', // di atas bottom nav
      }}
        className="cart-footer"
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>
            Total
          </span>
          <span style={{
            fontSize: 20, fontWeight: 800, color: 'var(--text-primary)',
            fontFamily: 'Nunito, sans-serif',
          }}>
            {formatRupiah(totalAmount)}
          </span>
        </div>

        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          aria-label="Selesaikan transaksi"
          style={{
            width: '100%',
            padding: '15px',
            borderRadius: 16,
            border: 'none',
            background: isSubmitting ? '#999' : 'var(--accent)',
            color: 'white',
            fontSize: 15,
            fontWeight: 800,
            cursor: isSubmitting ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background 0.15s ease, transform 0.1s ease',
            boxShadow: isSubmitting ? 'none' : '0 4px 16px rgba(217,43,43,0.35)',
            letterSpacing: '0.01em',
          }}
          className="selesai-btn"
        >
          {isSubmitting ? (
            <>
              <span className="spinner" style={{
                width: 18, height: 18, border: '2px solid white',
                borderTopColor: 'transparent', borderRadius: '50%',
                display: 'inline-block',
              }} />
              Menyimpan...
            </>
          ) : (
            <>
              <Check size={18} />
              Selesai
            </>
          )}
        </button>
      </div>

      <style jsx>{`
        @media (min-width: 768px) {
          .cart-footer {
            padding-bottom: 16px !important;
          }
        }
        .selesai-btn:active:not(:disabled) {
          transform: scale(0.98);
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spinner {
          animation: spin 0.8s linear infinite;
        }
      `}</style>
    </div>
  )
}

const qtyBtnStyle: React.CSSProperties = {
  width: 28, height: 28,
  borderRadius: 8,
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}