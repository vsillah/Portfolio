import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  // Create a Supabase client with the request
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
  })

  // Get the session from the Authorization header or cookie
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  
  let session = null
  if (token) {
    const { data } = await supabase.auth.getUser(token)
    if (data.user) {
      session = { user: data.user }
    }
  }

  // Also check cookies for session
  const accessToken = req.cookies.get('sb-access-token')?.value
  if (!session && accessToken) {
    const { data } = await supabase.auth.getUser(accessToken)
    if (data.user) {
      session = { user: data.user }
    }
  }

  const { pathname } = req.nextUrl

  // Protect admin routes
  if (pathname.startsWith('/admin')) {
    if (!session) {
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/auth/login'
      redirectUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // Check if user is admin using admin client
    const supabaseAdmin = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  // Protect lead magnets route
  if (pathname.startsWith('/lead-magnets')) {
    if (!session) {
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/auth/login'
      redirectUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(redirectUrl)
    }
  }

  return res
}

export const config = {
  matcher: ['/admin/:path*', '/lead-magnets/:path*'],
}
