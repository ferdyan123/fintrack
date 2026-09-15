'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, UtensilsCrossed,
  BarChart2, ClipboardList, Settings
} from 'lucide-react'
import { SyncIndicator } from '@/components/shared/SyncIndicator'
import { useAppStore } from '@/lib/store/appStore'

const TABS = [
  { href: '/',           icon: LayoutDashboard, label: 'Dashboard'  },
  { href: '/kasir',      icon: ShoppingCart,    label: 'Kasir'       },
  { href: '/catering',   icon: UtensilsCrossed, label: 'Catering'    },
  { href: '/analitik',   icon: BarChart2,       label: 'Analitik'    },
  { href: '/riwayat',    icon: ClipboardList,   label: 'Riwayat'     },
  { href: '/pengaturan', icon: Settings,        label: 'Pengaturan'  },
]

export function Topbar() {
  const pathname = usePathname()
  const currentStore = useAppStore((s) => s.currentStore)

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30,
      height: 60, background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      boxShadow: '0 1px 8px rgba(217,43,43,0.06)',
      display: 'none',
    }} className="topbar-desktop">
      <div style={{
        maxWidth: 1200, margin: '0 auto', height: '100%',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 24px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 22 }}>🍽️</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.3px' }}>
            {currentStore?.name ?? 'FinTrack'}
          </span>
        </div>

        {/* Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 2, overflow: 'hidden' }}>
          {TABS.map(({ href, icon: Icon, label }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 10,
                fontSize: 13, fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                textDecoration: 'none', whiteSpace: 'nowrap',
                background: isActive ? 'var(--accent-subtle)' : 'transparent',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'all 0.15s',
              }}>
                <Icon size={15} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <SyncIndicator />
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .topbar-desktop { display: block !important; }
        }
      `}</style>
    </header>
  )
}