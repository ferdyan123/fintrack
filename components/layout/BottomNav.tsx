'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, UtensilsCrossed, Plus, ClipboardList, MoreHorizontal } from 'lucide-react'
import { MoreDrawer } from './MoreDrawer'

const NAV_ITEMS = [
  { href: '/',         icon: Home,            label: 'Dashboard' },
  { href: '/catering', icon: UtensilsCrossed, label: 'Catering'  },
  null,
  { href: '/riwayat',  icon: ClipboardList,   label: 'Riwayat'   },
]

const MORE_PATHS = ['/analitik', '/pengaturan']

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
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        paddingBottom: 'env(safe-area-inset-bottom)',
        height: 'calc(64px + env(safe-area-inset-bottom))',
      }} className="bottom-nav-mobile">
        {NAV_ITEMS.map((item, i) => {
          if (item === null) {
            return (
              <Link key="fab" href="/kasir" style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'var(--accent)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(217,43,43,0.40)',
                marginBottom: 4, flexShrink: 0,
              }}>
                <Plus size={24} strokeWidth={2.5} />
              </Link>
            )
          }
          const Icon = item.icon
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '8px 16px', borderRadius: 14, textDecoration: 'none',
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              minWidth: 52,
            }}>
              <Icon size={22} />
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.02em' }}>
                {item.label}
              </span>
            </Link>
          )
        })}

        <button onClick={() => setDrawerOpen(true)} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          padding: '8px 16px', borderRadius: 14, border: 'none', background: 'none',
          cursor: 'pointer', minWidth: 52,
          color: isMoreActive ? 'var(--accent)' : 'var(--text-muted)',
        }}>
          <MoreHorizontal size={22} />
          <span style={{ fontSize: 10, fontWeight: 600 }}>Lainnya</span>
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