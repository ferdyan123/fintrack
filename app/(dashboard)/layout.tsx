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
      {/* Padding top hanya di desktop (topbar fixed) */}
      <main style={{ paddingTop: 0 }} className="main-content">
        {children}
      </main>
      <BottomNav />

      <style>{`
        @media (min-width: 768px) {
          .main-content { padding-top: 60px !important; }
        }
      `}</style>
    </>
  )
}