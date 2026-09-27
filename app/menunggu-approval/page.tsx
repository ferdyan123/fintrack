'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function MenungguApprovalPage() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#FFF8F8', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 380, background: 'white', borderRadius: 24,
        padding: '40px 28px', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: '#1F2937', margin: '0 0 8px' }}>
          Menunggu Persetujuan
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, margin: '0 0 24px' }}>
          Permintaan gabung kamu sudah terkirim ke owner toko. Tunggu sampai owner menyetujui aksesmu.
        </p>
        <div style={{
          background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 12,
          padding: '12px 16px', fontSize: 13, color: '#92400E', marginBottom: 24, lineHeight: 1.5,
        }}>
          💡 Minta owner toko untuk membuka halaman <strong>Pengaturan</strong> dan menyetujui permintaanmu di section <strong>Permintaan Gabung</strong>.
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: '12px', borderRadius: 12, border: 'none',
            background: '#FEE2E2', color: '#DC2626', fontSize: 14, fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Keluar
        </button>
      </div>
    </div>
  )
}