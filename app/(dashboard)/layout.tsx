import { Topbar } from '@/components/layout/Topbar'
import { BottomNav } from '@/components/layout/BottomNav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
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
