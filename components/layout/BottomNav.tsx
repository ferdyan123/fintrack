'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, UtensilsCrossed, Plus, Receipt, MoreHorizontal } from 'lucide-react'
import { MoreDrawer } from './MoreDrawer'

const NAV_ITEMS = [
  { href: '/',            icon: Home,            label: 'Dashboard'   },
  { href: '/catering',    icon: UtensilsCrossed, label: 'Catering'    },
  null,
  { href: '/pengeluaran', icon: Receipt,         label: 'Pengeluaran' },
]

// fix: '/riwayat' sekarang pindah ke drawer "Lainnya", jadi ikut ditambahkan
// di sini supaya tab "Lainnya" tetap aktif saat user membuka halaman Riwayat.
const MORE_PATHS = ['/analitik', '/pengaturan', '/riwayat']

export function BottomNav() {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isMoreActive = MORE_PATHS.some((p) => pathname.startsWith(p))

  return (
    <>
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 4px',
        paddingBottom: 'env(safe-area-inset-bottom)',
        // fix: nav sebelumnya 64px terlalu tinggi & padding item terlalu lebar,
        // total lebar 5 item (Dashboard/Catering/FAB/Riwayat/Lainnya) melebihi
        // lebar layar HP kecil (≤ ~405px) sehingga terlihat "kegedean"/sesak.
        height: 'calc(58px + env(safe-area-inset-bottom))',
      }} className="bottom-nav-mobile">
        {NAV_ITEMS.map((item, i) => {
          if (item === null) {
            return (
              <Link key="fab" href="/kasir" style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'var(--accent)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(217,43,43,0.38)',
                marginBottom: 2, flexShrink: 0,
              }}>
                <Plus size={20} strokeWidth={2.5} />
              </Link>
            )
          }
          const Icon = item.icon
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '6px 6px', borderRadius: 12, textDecoration: 'none',
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              minWidth: 44, flex: 1,
            }}>
              <Icon size={19} />
              <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>
                {item.label}
              </span>
            </Link>
          )
        })}

        <button onClick={() => setDrawerOpen(true)} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          padding: '6px 6px', borderRadius: 12, border: 'none', background: 'none',
          cursor: 'pointer', minWidth: 44, flex: 1,
          color: isMoreActive ? 'var(--accent)' : 'var(--text-muted)',
        }}>
          <MoreHorizontal size={19} />
          <span style={{ fontSize: 9.5, fontWeight: 600 }}>Lainnya</span>
        </button>
      </nav>

      <MoreDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <style>{`
        .bottom-nav-mobile { display: flex; }
        @media (min-width: 768px) {
          .bottom-nav-mobile { display: none !important; }
        }
      `}</style>
    </>
  )
}