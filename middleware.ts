import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'

const LOGIN_PATH = '/'
const WAITING_PATH = '/menunggu-approval'

const PROTECTED_PATHS = [
  '/dashboard',
  '/kasir',
  '/catering',
  '/pengeluaran',
  '/analitik',
  '/riwayat',
  '/pengaturan',
]

function isProtectedRoute(pathname: string) {
  return PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  const isLoginRoute = pathname === LOGIN_PATH
  const isWaitingRoute = pathname === WAITING_PATH

  // Belum login → redirect ke login
  if (!user && isProtectedRoute(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = LOGIN_PATH
    return NextResponse.redirect(url)
  }

  // Sudah login
  if (user) {
    // Cek apakah user punya store (owner atau staff yang sudah approved)
    if (isProtectedRoute(pathname) || isLoginRoute) {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return request.cookies.getAll() },
            setAll() {},
          },
        }
      )

      const { data: stores } = await supabase.rpc('get_my_stores')
      const hasStore = stores && stores.length > 0

      if (!hasStore) {
        // User tidak punya akses toko — kemungkinan pending approval
        if (isProtectedRoute(pathname)) {
          const url = request.nextUrl.clone()
          url.pathname = WAITING_PATH
          return NextResponse.redirect(url)
        }
        // Biarkan di login page atau waiting page
        return supabaseResponse
      }

      // Punya store → kalau di login page, redirect ke dashboard
      if (isLoginRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}