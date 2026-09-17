'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SyncIndicator } from '@/components/shared/SyncIndicator'
import { CatatActionSheet } from '@/components/shared/CatatActionSheet'
import { ExpenseModal } from '@/components/shared/ExpenseModal'
import { useAppStore } from '@/lib/store/appStore'
import { useState } from 'react'
import { MoreDrawer } from './MoreDrawer'

const TABS = [
  { href: '/',              label: 'Dashboard'   },
  { href: '/kasir',         label: 'Kasir'       },
  { href: '/catering',      label: 'Catering'    },
  { href: '/pengeluaran',   label: 'Pengeluaran' },
  { href: '/analitik',      label: 'Analitik'    },
  { href: '/riwayat',       label: 'Riwayat'     },
  { href: '/pengaturan',    label: 'Pengaturan'  },
]

export function Topbar() {
  const pathname     = usePathname()
  const currentStore = useAppStore((s) => s.currentStore)

  const [drawerOpen,      setDrawerOpen]      = useState(false)
  const [actionSheetOpen, setActionSheetOpen] = useState(false)
  const [expenseOpen,     setExpenseOpen]     = useState(false)

  const btnStyle = {
    display: 'flex', alignItems: 'center', gap: 6,
    background: '#D92B2B', color: 'white',
    padding: '7px 14px', borderRadius: 8,
    fontSize: 13, fontWeight: 600,
    border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' as const,
  }

  const btnStyleMobile = {
    background: '#D92B2B', color: 'white',
    padding: '6px 12px', borderRadius: 8,
    fontSize: 12, fontWeight: 600,
    border: 'none', cursor: 'pointer',
  }

  return (
    <>
      {/* ── DESKTOP TOPBAR ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30,
        background: '#ffffff',
        borderBottom: '1px solid #F0E0E0',
        height: 56,
        display: 'flex', alignItems: 'center',
        padding: '0 24px',
        gap: 16,
      }} className="topbar-desktop">
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginRight: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: '#D92B2B',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14,
          }}>🍽️</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1A0A0A', letterSpacing: '-0.2px' }}>
            {currentStore?.name ?? 'FinTrack'}
          </span>
        </div>

        {/* Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, overflowX: 'auto' }}>
          {TABS.map(({ href, label }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link key={href} href={href} style={{
                padding: '6px 12px', borderRadius: 8,
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                color: isActive ? '#D92B2B' : '#6B3030',
                textDecoration: 'none', whiteSpace: 'nowrap',
                background: isActive ? 'rgba(217,43,43,0.08)' : 'transparent',
                borderBottom: isActive ? '2px solid #D92B2B' : '2px solid transparent',
              }}>
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <SyncIndicator />
          <button style={btnStyle} onClick={() => setActionSheetOpen(true)}>
            + Catat
          </button>
        </div>
      </header>

      {/* ── MOBILE TOPBAR ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30,
        background: '#ffffff',
        borderBottom: '1px solid #F0E0E0',
        height: 52,
        display: 'flex', alignItems: 'center',
        padding: '0 16px',
        justifyContent: 'space-between',
      }} className="topbar-mobile">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7, background: '#D92B2B',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
          }}>🍽️</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1A0A0A' }}>
            {currentStore?.name ?? 'FinTrack'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SyncIndicator />
          <button style={btnStyleMobile} onClick={() => setActionSheetOpen(true)}>
            + Catat
          </button>
        </div>
      </header>

      <MoreDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <CatatActionSheet
        open={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        onOpenExpense={() => setExpenseOpen(true)}
      />

      <ExpenseModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
      />

      <style>{`
        .topbar-desktop { display: none !important; }
        .topbar-mobile  { display: flex !important; }
        @media (min-width: 768px) {
          .topbar-desktop { display: flex !important; }
          .topbar-mobile  { display: none !important; }
        }
      `}</style>
    </>
  )
}