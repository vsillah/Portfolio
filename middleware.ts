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

  // Note: /admin routes are protected by ProtectedRoute component on the client side
  // Middleware can't access localStorage where Supabase stores sessions, so we rely on
  // client-side protection. API routes are still protected server-side.
  // /lead-magnets is also protected by ProtectedRoute component on the client side

  return res
}

export const config = {
  matcher: [], // No routes protected by middleware - using client-side ProtectedRoute instead
}
