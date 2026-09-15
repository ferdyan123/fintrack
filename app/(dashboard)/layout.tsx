import { Topbar } from '@/components/layout/Topbar'
import { BottomNav } from '@/components/layout/BottomNav'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <>
      <Topbar />
      <main className="main-layout">
        {children}
      </main>
      <BottomNav />
      <style>{`
        .main-layout { padding-top: 52px; background: #ffffff; min-height: 100vh; }
        @media (min-width: 768px) {
          .main-layout { padding-top: 56px; }
        }
      `}</style>
    </>
  )
}