'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAppStore } from '@/lib/store/appStore'
import { setupOnlineListener } from '@/lib/supabase/sync'
import { createClient } from '@/lib/supabase/client'
import { ToastProvider } from '@/components/shared/Toast'
import type { Store } from '@/types'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
})

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'drako') root.setAttribute('data-theme', 'drako')
    else root.removeAttribute('data-theme')
  }, [theme])

  useEffect(() => {
    const cleanup = setupOnlineListener()
    return cleanup
  }, [])

  return <>{children}</>
}

// ─── Store Hydrator ─────────────────────────────────────────────────────────
// Ini "jembatan sync" yang tadinya hilang: begitu ada session Supabase aktif
// (di device MANAPUN — HP, laptop, browser lain), komponen ini menarik ulang
// data toko + produk + kategori dari server dan mengisi ke Zustand. Tanpa
// ini, data cuma hidup di localStorage device yang pertama kali dipakai.
function StoreHydrator({ children }: { children: React.ReactNode }) {
  const setCurrentStore      = useAppStore((s) => s.setCurrentStore)
  const setProducts          = useAppStore((s) => s.setProducts)
  const setExpenseCategories = useAppStore((s) => s.setExpenseCategories)

  useEffect(() => {
    const supabase = createClient()

    async function hydrate(userId: string) {
      // Ambil semua toko yang bisa diakses user ini (owner ATAU staff yang
      // join lewat store_code) via RPC get_my_stores().
      const { data: stores, error: storesErr } = await supabase.rpc('get_my_stores')
      if (storesErr || !stores || stores.length === 0) return

      // Untuk sekarang: pilih toko pertama. Kalau user punya toko yang
      // sebelumnya aktif tersimpan lokal dan masih ada di daftar, pertahankan
      // pilihan itu — supaya tidak "lompat" ke toko lain tanpa sengaja.
      const savedId = useAppStore.getState().currentStore?.id
      const matched = (stores as Store[]).find((s) => s.id === savedId)
      const store   = matched ?? (stores as Store[])[0]

      setCurrentStore(store)

      const [{ data: products }, { data: cats }] = await Promise.all([
        supabase.from('products').select('*').eq('store_id', store.id),
        supabase.from('expense_categories').select('*').eq('store_id', store.id),
      ])

      setProducts(products ?? [])
      setExpenseCategories(cats ?? [])
    }

    // Hydrate begitu komponen mount, kalau sudah ada session aktif.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) hydrate(data.session.user.id)
    })

    // Hydrate ulang setiap kali status auth berubah (login baru, refresh
    // token, dsb). Saat logout, kosongkan store lokal juga.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        hydrate(session.user.id)
      }
      if (event === 'SIGNED_OUT') {
        setCurrentStore(null)
        setProducts([])
        setExpenseCategories([])
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [setCurrentStore, setProducts, setExpenseCategories])

  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <StoreHydrator>
          <ToastProvider>{children}</ToastProvider>
        </StoreHydrator>
      </ThemeProvider>
    </QueryClientProvider>
  )
}