'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, UtensilsCrossed, Plus, ClipboardList, MoreHorizontal } from 'lucide-react'
import { MoreDrawer } from './MoreDrawer'

const NAV_ITEMS = [
  { href: '/',         icon: Home,            label: 'Dashboard'  },
  { href: '/catering', icon: UtensilsCrossed, label: 'Catering'   },
  null, // FAB slot
  { href: '/riwayat',  icon: ClipboardList,   label: 'Riwayat'    },
]

// Halaman yang termasuk "More"
const MORE_PATHS = ['/analitik', '/pengaturan']

export function BottomNav() {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isMoreActive = MORE_PATHS.some((p) => pathname.startsWith(p))

  return (
    <>
      <nav className="bottom-nav bottom-nav-safe">
        {NAV_ITEMS.map((item, i) => {
          if (item === null) {
            // FAB kasir
            return (
              <Link key="fab" href="/kasir" className="fab" aria-label="Kasir">
                <Plus size={24} strokeWidth={2.5} />
              </Link>
            )
          }

          const Icon = item.icon
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${isActive ? ' active' : ''}`}
              aria-label={item.label}
            >
              <Icon size={22} />
              <span className="nav-label">{item.label}</span>
            </Link>
          )
        })}

        {/* More button */}
        <button
          className={`nav-item${isMoreActive ? ' active' : ''}`}
          onClick={() => setDrawerOpen(true)}
          aria-label="Menu lainnya"
        >
          <MoreHorizontal size={22} />
          <span className="nav-label">Lainnya</span>
        </button>
      </nav>

      <MoreDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <style jsx>{`
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: var(--nav-height);
          background: var(--bg-surface);
          border-top: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-around;
          z-index: 30;
          box-shadow: 0 -4px 20px rgba(0,0,0,0.06);
        }
        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 8px 12px;
          border-radius: 14px;
          color: var(--text-muted);
          text-decoration: none;
          border: none;
          background: none;
          cursor: pointer;
          transition: color 0.2s, background 0.2s;
          min-width: 56px;
        }
        .nav-item:hover { color: var(--accent); background: var(--accent-subtle); }
        .nav-item.active { color: var(--accent); }
        .nav-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .fab {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: var(--accent);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(217,43,43,0.40);
          transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
          margin-bottom: 4px;
        }
        .fab:hover {
          background: var(--accent-hover);
          transform: scale(1.08);
          box-shadow: 0 6px 20px rgba(217,43,43,0.50);
        }
        .fab:active { transform: scale(0.95); }
      `}</style>
    </>
  )
}
