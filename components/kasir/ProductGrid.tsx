'use client'

import type { Product, CartItem } from '@/types'

interface ProductGridProps {
  products: Product[]
  cart: CartItem[]
  onTap: (product: Product) => void
}

export function ProductGrid({ products, cart, onTap }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '60px 24px', gap: 12,
        color: 'var(--text-muted)', textAlign: 'center',
      }}>
        <span style={{ fontSize: 48 }}>🍽️</span>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>
          Belum ada produk
        </p>
        <p style={{ margin: 0, fontSize: 13 }}>
          Tambah produk dulu di halaman <strong>Pengaturan</strong>
        </p>
        <a href="/pengaturan" style={{
          marginTop: 4, padding: '10px 20px', borderRadius: 12,
          background: 'var(--accent)', color: 'white',
          textDecoration: 'none', fontSize: 13, fontWeight: 700,
        }}>
          Buka Pengaturan →
        </a>
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 12,
      padding: '12px 16px',
    }}
      className="product-grid"
    >
      {products.map((product) => {
        const cartItem = cart.find((c) => c.product.id === product.id)
        const inCart = !!cartItem
        const qtyInCart = cartItem?.qty ?? 0

        return (
          <button
            key={product.id}
            onClick={() => onTap(product)}
            aria-label={`Tambah ${product.name} ke keranjang`}
            style={{
              position: 'relative',
              background: inCart ? 'var(--accent-subtle)' : 'var(--bg-surface)',
              border: inCart ? '2px solid var(--accent)' : '2px solid var(--border)',
              borderRadius: 16,
              padding: 0,
              cursor: 'pointer',
              overflow: 'hidden',
              textAlign: 'left',
              transition: 'transform 0.1s ease, box-shadow 0.1s ease',
              boxShadow: inCart
                ? '0 4px 16px rgba(217,43,43,0.16)'
                : '0 2px 8px rgba(0,0,0,0.06)',
              // Active scale via CSS
              WebkitTapHighlightColor: 'transparent',
            }}
            className="product-card"
          >
            {/* Foto / Emoji area */}
            <div style={{
              width: '100%',
              aspectRatio: '1',
              background: inCart ? 'rgba(217,43,43,0.06)' : 'var(--bg-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {product.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.photo_url}
                  alt={product.name}
                  loading="lazy"
                  style={{
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <span style={{ fontSize: 44 }}>{product.icon}</span>
              )}

              {/* Badge qty */}
              {inCart && (
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'var(--accent)', color: 'white',
                  borderRadius: 99, minWidth: 24, height: 24,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, padding: '0 6px',
                  boxShadow: '0 2px 8px rgba(217,43,43,0.4)',
                }}>
                  {qtyInCart}
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{ padding: '10px 12px 12px' }}>
              <p style={{
                margin: '0 0 4px',
                fontSize: 13, fontWeight: 700,
                color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {product.name}
              </p>
              <p style={{
                margin: 0, fontSize: 13, fontWeight: 800,
                color: inCart ? 'var(--accent)' : 'var(--accent)',
                fontFamily: 'var(--font-number, Nunito, sans-serif)',
              }}>
                {formatRupiah(product.price)}
              </p>
            </div>
          </button>
        )
      })}

      <style jsx>{`
        .product-grid {
          /* 3 kolom di tablet/desktop */
        }
        @media (min-width: 480px) {
          .product-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (min-width: 768px) {
          .product-grid { grid-template-columns: repeat(4, 1fr) !important; }
        }
        .product-card:active {
          transform: scale(0.96);
        }
      `}</style>
    </div>
  )
}

// Helper lokal — sesuai formatRupiah yang dipakai di project (bisa diganti import dari lib/utils nanti)
function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}