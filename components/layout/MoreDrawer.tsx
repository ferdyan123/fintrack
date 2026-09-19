'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart2, Settings, LogOut, X, ClipboardList } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store/appStore'

interface MoreDrawerProps {
  open: boolean
  onClose: () => void
}

// fix: "Riwayat" sekarang dipindah ke sini (posisi di bottom nav utama
// digantikan "Pengeluaran"), supaya bottom nav utama fokus ke halaman
// yang lebih sering dipakai sehari-hari.
const MORE_ITEMS = [
  { href: '/riwayat',    icon: ClipboardList, label: 'Riwayat'    },
  { href: '/analitik',   icon: BarChart2,     label: 'Analitik'   },
  { href: '/pengaturan', icon: Settings,      label: 'Pengaturan' },
]

export function MoreDrawer({ open, onClose }: MoreDrawerProps) {
  const pathname = usePathname()
  const router = useRouter()
  const currentStore = useAppStore((s) => s.currentStore)
  const setCurrentStore = useAppStore((s) => s.setCurrentStore)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

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
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(2px)',
          zIndex: 40,
        }}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--bg-surface)',
          borderRadius: '20px 20px 0 0',
          zIndex: 50,
          padding: '0 0 32px',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
          maxHeight: '60dvh',
        }}
      >
        {/* Handle */}
        <div style={{
          width: 40, height: 4,
          background: 'var(--border-strong)',
          borderRadius: 99,
          margin: '12px auto 0',
        }} />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 8px',
        }}>
          <span style={{
            fontSize: 13, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--text-muted)',
          }}>
            Menu Lainnya
          </span>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', background: 'var(--bg-elevated)',
            color: 'var(--text-secondary)', cursor: 'pointer',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 12px' }}>
          {MORE_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 14,
                  fontSize: 15, fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  textDecoration: 'none',
                  background: isActive ? 'var(--accent-subtle)' : 'transparent',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', margin: '8px 20px' }} />

        {/* Akun */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--accent-subtle)', color: 'var(--accent)',
            fontWeight: 700, fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {currentStore?.name?.[0]?.toUpperCase() ?? 'T'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {currentStore?.name ?? 'Toko'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
              Kode: {currentStore?.store_code}
            </span>
          </div>
        </div>

        {/* Tombol logout */}
        <button
          onClick={handleLogout}
          style={{
            margin: '8px 12px 0',
            width: 'calc(100% - 24px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px',
            borderRadius: 14,
            border: '1px solid var(--danger-bg)',
            background: 'var(--danger-bg)',
            color: 'var(--danger)',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <LogOut size={16} />
          <span>Keluar</span>
        </button>
      </div>
    </>
  )
}