'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart2, Settings, LogOut, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store/appStore'

interface MoreDrawerProps {
  open: boolean
  onClose: () => void
}

const MORE_ITEMS = [
  { href: '/analitik',   icon: BarChart2, label: 'Analitik'    },
  { href: '/pengaturan', icon: Settings,  label: 'Pengaturan'  },
]

export function MoreDrawer({ open, onClose }: MoreDrawerProps) {
  const pathname = usePathname()
  const router = useRouter()
  const overlayRef = useRef<HTMLDivElement>(null)
  const currentStore = useAppStore((s) => s.currentStore)
  const setCurrentStore = useAppStore((s) => s.setCurrentStore)

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Lock scroll saat drawer buka
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setCurrentStore(null)
    onClose()
    router.push('/login')
  }

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="drawer-overlay animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="drawer animate-slide-up" role="dialog" aria-modal="true">
        {/* Handle bar */}
        <div className="drawer-handle" />

        {/* Header */}
        <div className="drawer-header">
          <span className="drawer-title">Menu Lainnya</span>
          <button className="drawer-close" onClick={onClose} aria-label="Tutup menu">
            <X size={18} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="drawer-nav">
          {MORE_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`drawer-item${isActive ? ' active' : ''}`}
                onClick={onClose}
              >
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Divider + Akun */}
        <div className="drawer-divider" />
        <div className="drawer-account">
          <div className="account-avatar">
            {currentStore?.name?.[0]?.toUpperCase() ?? 'T'}
          </div>
          <div className="account-info">
            <span className="account-name">{currentStore?.name ?? 'Toko'}</span>
            <span className="account-code">Kode: {currentStore?.store_code}</span>
          </div>
        </div>

        <button className="drawer-logout" onClick={handleLogout}>
          <LogOut size={16} />
          <span>Keluar</span>
        </button>
      </div>

      <style jsx>{`
        .drawer-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 40;
          backdrop-filter: blur(2px);
        }
        .drawer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: var(--bg-surface);
          border-radius: 20px 20px 0 0;
          z-index: 50;
          padding: 0 0 32px;
          box-shadow: 0 -8px 32px rgba(0,0,0,0.15);
          max-height: 60dvh;
        }
        .drawer-handle {
          width: 40px; height: 4px;
          background: var(--border-strong);
          border-radius: 99px;
          margin: 12px auto 0;
        }
        .drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px 8px;
        }
        .drawer-title {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
        }
        .drawer-close {
          width: 32px; height: 32px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          border: none; background: var(--bg-elevated);
          color: var(--text-secondary);
          cursor: pointer;
        }
        .drawer-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 8px 12px;
        }
        .drawer-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 500;
          color: var(--text-secondary);
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
        }
        .drawer-item:hover, .drawer-item.active {
          background: var(--accent-subtle);
          color: var(--accent);
        }
        .drawer-divider {
          height: 1px;
          background: var(--border);
          margin: 8px 20px;
        }
        .drawer-account {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
        }
        .account-avatar {
          width: 40px; height: 40px;
          border-radius: 50%;
          background: var(--accent-subtle);
          color: var(--accent);
          font-weight: 700;
          font-size: 16px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .account-info { display: flex; flex-direction: column; gap: 2px; }
        .account-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .account-code { font-size: 12px; color: var(--text-muted); font-family: 'DM Mono', monospace; }
        .drawer-logout {
          margin: 8px 12px 0;
          width: calc(100% - 24px);
          display: flex; align-items: center; justify-content: center; gap-8px;
          gap: 8px;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid var(--danger-bg);
          background: var(--danger-bg);
          color: var(--danger);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .drawer-logout:hover { opacity: 0.8; }
      `}</style>
    </>
  )
}
