'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart, TrendingDown, UtensilsCrossed, X } from 'lucide-react'

interface CatatActionSheetProps {
  open: boolean
  onClose: () => void
  onOpenExpense: () => void
}

const ACTIONS = [
  {
    key: 'kasir',
    icon: ShoppingCart,
    emoji: '🧾',
    label: 'Transaksi Kasir',
    desc: 'Catat penjualan produk',
    color: '#16A34A',
    bg: '#DCFCE7',
    href: '/kasir',
  },
  {
    key: 'expense',
    icon: TrendingDown,
    emoji: '💸',
    label: 'Pengeluaran',
    desc: 'Bahan baku, gaji, listrik...',
    color: '#DC2626',
    bg: '#FEE2E2',
    href: null, // trigger modal
  },
  {
    key: 'catering',
    icon: UtensilsCrossed,
    emoji: '🍱',
    label: 'Order Catering',
    desc: 'Buat order catering baru',
    color: '#D97706',
    bg: '#FEF3C7',
    href: '/catering',
  },
]

export function CatatActionSheet({ open, onClose, onOpenExpense }: CatatActionSheetProps) {
  const router    = useRouter()
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  function handleAction(a: typeof ACTIONS[number]) {
    onClose()
    if (a.href) {
      router.push(a.href)
    } else {
      // delay kecil biar overlay close dulu sebelum modal buka
      setTimeout(() => onOpenExpense(), 120)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
          animation: 'fadeIn 0.15s ease',
        }}
      />

      {/* ── MOBILE: Bottom sheet ── */}
      <div
        className="catat-mobile"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 55,
          background: 'var(--bg-surface)',
          borderRadius: '20px 20px 0 0',
          padding: '0 0 env(safe-area-inset-bottom)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
          animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Handle */}
        <div style={{ width: 40, height: 4, background: 'var(--border-strong)', borderRadius: 99, margin: '12px auto 0' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 8px' }}>
          <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>
            Catat Transaksi
          </span>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--bg-elevated)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 12px 20px' }}>
          {ACTIONS.map((a) => (
            <button
              key={a.key}
              onClick={() => handleAction(a)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', borderRadius: 16,
                border: 'none', background: 'transparent',
                cursor: 'pointer', textAlign: 'left', width: '100%',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-elevated)' }}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <div style={{
                width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>
                {a.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{a.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.desc}</div>
              </div>
              <div style={{ fontSize: 18, color: 'var(--text-muted)', flexShrink: 0 }}>›</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── DESKTOP: Dropdown (muncul di bawah tombol) ── */}
      <div
        className="catat-desktop"
        style={{
          position: 'fixed', top: 64, right: 24, zIndex: 55,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden', minWidth: 280,
          animation: 'scaleIn 0.18s cubic-bezier(0.34,1.56,0.64,1)',
          transformOrigin: 'top right',
        }}
      >
        <div style={{ padding: '10px 14px 6px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>
            Catat Transaksi
          </span>
        </div>
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            onClick={() => handleAction(a)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 14px', width: '100%',
              border: 'none', background: 'transparent',
              cursor: 'pointer', textAlign: 'left',
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-elevated)' }}
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>
              {a.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{a.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.desc}</div>
            </div>
          </button>
        ))}
        <div style={{ height: 6 }} />
      </div>

      <style>{`
        .catat-desktop { display: none !important; }
        .catat-mobile  { display: block !important; }
        @media (min-width: 768px) {
          .catat-desktop { display: block !important; }
          .catat-mobile  { display: none !important; }
        }
      `}</style>
    </>
  )
}