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
    <header className="topbar">
      {/* Logo */}
      <div className="topbar-logo">
        <span className="logo-emoji">🍽️</span>
        <span className="logo-name">{currentStore?.name ?? 'FinTrack'}</span>
      </div>

      {/* Tabs (desktop) */}
      <nav className="topbar-tabs">
        {TABS.map(({ href, icon: Icon, label }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`tab${isActive ? ' active' : ''}`}
            >
              <Icon size={15} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Right: sync */}
      <div className="topbar-right">
        <SyncIndicator />
      </div>

      <style jsx>{`
        .topbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: var(--topbar-height);
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border);
          display: none;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          z-index: 30;
          box-shadow: var(--shadow-sm);
        }
        @media (min-width: 768px) { .topbar { display: flex; } }

        .topbar-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .logo-emoji { font-size: 22px; }
        .logo-name {
          font-size: 16px;
          font-weight: 700;
          color: var(--accent);
          white-space: nowrap;
        }

        .topbar-tabs {
          display: flex;
          align-items: center;
          gap: 2px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .topbar-tabs::-webkit-scrollbar { display: none; }

        .tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-muted);
          text-decoration: none;
          white-space: nowrap;
          transition: all 0.15s;
          position: relative;
        }
        .tab:hover { color: var(--accent); background: var(--accent-subtle); }
        .tab.active {
          color: var(--accent);
          font-weight: 600;
          background: var(--accent-subtle);
        }
        .tab.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 12px;
          right: 12px;
          height: 2px;
          background: var(--accent);
          border-radius: 99px;
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }
      `}</style>
    </header>
  )
}
