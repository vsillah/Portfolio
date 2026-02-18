import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file has NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  )
}

// Client for client-side operations (public)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
})

// Server-side client with service role (for admin operations)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey && typeof window === 'undefined') {
  console.warn('[SERVER] SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations may fail.')
}

export const supabaseAdmin = typeof window === 'undefined'
  ? createClient(
      supabaseUrl,
      serviceRoleKey || supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  : null as any
