'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAppStore } from '@/lib/store/appStore'
import { setupOnlineListener } from '@/lib/supabase/sync'
import { ToastProvider } from '@/components/shared/Toast'

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

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
