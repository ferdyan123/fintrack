'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateStoreCode } from '@/lib/utils'
import { Loader2, Store, Users } from 'lucide-react'

type Tab = 'login' | 'signup'
type SignupMode = 'create' | 'join'

export default function LoginPage() {
  const router = useRouter()

  const [tab, setTab] = useState<Tab>('login')
  const [signupMode, setSignupMode] = useState<SignupMode>('create')

  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [storeName, setStoreName] = useState('')
  const [storeCode, setStoreCode] = useState('')

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [info,    setInfo]    = useState('')

  async function handleLogin() {
    setLoading(true); setError(''); setInfo('')
    const supabase = createClient()
    const { error: e } = await supabase.auth.signInWithPassword({ email, password })
    if (e) { setError(e.message); setLoading(false); return }
    router.push('/')
  }

  async function handleSignup() {
    setLoading(true); setError(''); setInfo('')

    if (signupMode === 'create' && !storeName.trim()) {
      setError('Nama toko harus diisi'); setLoading(false); return
    }
    if (signupMode === 'join' && !storeCode.trim()) {
      setError('Kode toko harus diisi'); setLoading(false); return
    }

    const supabase = createClient()
    const { data, error: e } = await supabase.auth.signUp({ email, password })
    if (e) { setError(e.message); setLoading(false); return }

    // Kalau project Supabase mewajibkan konfirmasi email, belum ada
    // session aktif di sini — user harus konfirmasi dulu baru bisa login,
    // dan proses buat/join toko baru bisa jalan setelah itu (di halaman
    // ini juga, tab "Masuk", karena hydration di providers.tsx akan
    // mendeteksi user belum punya toko).
    if (!data.session) {
      setInfo('Akun berhasil dibuat! Cek email untuk konfirmasi, lalu login di sini.')
      setEmail('')
      setPassword('')
      setStoreName('')
      setStoreCode('')
      setLoading(false)
      setTab('login')
      return
    }

    const userId = data.user!.id

    if (signupMode === 'create') {
      const { error: storeErr } = await supabase.from('stores').insert({
        user_id: userId,
        name: storeName.trim(),
        store_code: generateStoreCode(),
      })
      if (storeErr) {
        setError('Akun dibuat, tapi gagal membuat toko: ' + storeErr.message)
        setLoading(false)
        return
      }
    } else {
      const { data: store, error: findErr } = await supabase
        .from('stores').select('id').eq('store_code', storeCode.trim().toUpperCase()).single()

      if (findErr || !store) {
        setError('Kode toko tidak ditemukan. Periksa kembali kodenya.')
        setLoading(false)
        return
      }

      const { error: joinErr } = await supabase.from('store_members').insert({
        store_id: store.id,
        user_id: userId,
        role: 'staff',
      })
      if (joinErr) {
        setError('Akun dibuat, tapi gagal gabung ke toko: ' + joinErr.message)
        setLoading(false)
        return
      }
    }

    router.push('/')
  }

  const S = {
    page: {
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base, #FFF8F8)', padding: 20,
    } as React.CSSProperties,
    card: {
      width: '100%', maxWidth: 380, background: 'white', borderRadius: 24,
      padding: '32px 28px', boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
    } as React.CSSProperties,
    input: {
      width: '100%', padding: '12px 14px', borderRadius: 12,
      border: '1.5px solid #F0E0E0', background: '#FFFBFB',
      fontSize: 14, outline: 'none', boxSizing: 'border-box' as const,
      fontFamily: 'inherit', marginBottom: 12,
    } as React.CSSProperties,
    label: {
      fontSize: 11, fontWeight: 700, color: '#B08080', textTransform: 'uppercase' as const,
      letterSpacing: '0.07em', marginBottom: 6, display: 'block',
    } as React.CSSProperties,
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, background: '#D92B2B',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px', fontSize: 26,
          }}>🍽️</div>
          <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#1A0A0A' }}>FinTrack</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#B08080' }}>Kelola bisnis UMKM kamu</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: '#FFF0F0', borderRadius: 12, padding: 3, marginBottom: 20 }}>
          {(['login', 'signup'] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setError(''); setInfo('') }} style={{
              flex: 1, padding: '9px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              background: tab === t ? 'white' : 'transparent',
              color: tab === t ? '#D92B2B' : '#B08080',
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
              {t === 'login' ? 'Masuk' : 'Daftar'}
            </button>
          ))}
        </div>

        {/* Signup mode sub-toggle */}
        {tab === 'signup' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button onClick={() => setSignupMode('create')} style={{
              flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
              border: `2px solid ${signupMode === 'create' ? '#D92B2B' : '#F0E0E0'}`,
              background: signupMode === 'create' ? '#FEF2F2' : 'white',
              color: signupMode === 'create' ? '#D92B2B' : '#6B7280',
              fontSize: 12, fontWeight: 700,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <Store size={16} /> Toko Baru
            </button>
            <button onClick={() => setSignupMode('join')} style={{
              flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
              border: `2px solid ${signupMode === 'join' ? '#D92B2B' : '#F0E0E0'}`,
              background: signupMode === 'join' ? '#FEF2F2' : 'white',
              color: signupMode === 'join' ? '#D92B2B' : '#6B7280',
              fontSize: 12, fontWeight: 700,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <Users size={16} /> Gabung Toko
            </button>
          </div>
        )}

        {/* Form fields */}
        <div>
          <label style={S.label}>Email</label>
          <input style={S.input} type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" />

          <label style={S.label}>Password</label>
          <input style={S.input} type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />

          {tab === 'signup' && signupMode === 'create' && (
            <>
              <label style={S.label}>Nama Toko</label>
              <input style={S.input} value={storeName}
                onChange={(e) => setStoreName(e.target.value)} placeholder="cth: Warung Bu Siti" />
            </>
          )}

          {tab === 'signup' && signupMode === 'join' && (
            <>
              <label style={S.label}>Kode Toko</label>
              <input style={{ ...S.input, textTransform: 'uppercase' }} value={storeCode}
                onChange={(e) => setStoreCode(e.target.value)} placeholder="cth: A1B2C3"
                maxLength={6} />
            </>
          )}
        </div>

        {error && (
          <p style={{ fontSize: 12, color: '#DC2626', margin: '0 0 12px', lineHeight: 1.5 }}>⚠️ {error}</p>
        )}
        {info && (
          <p style={{ fontSize: 12, color: '#15803D', margin: '0 0 12px', lineHeight: 1.5 }}>✓ {info}</p>
        )}

        <button
          onClick={tab === 'login' ? handleLogin : handleSignup}
          disabled={loading || !email || !password}
          style={{
            width: '100%', padding: '13px', borderRadius: 14, border: 'none',
            background: (!email || !password) ? '#F0E0E0' : '#D92B2B',
            color: 'white', fontSize: 14, fontWeight: 700,
            cursor: loading ? 'wait' : (!email || !password) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
          {loading ? 'Memproses...' : tab === 'login' ? 'Masuk' : 'Daftar'}
        </button>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}