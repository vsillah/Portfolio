import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file has NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  )
}

// Client for client-side operations (public)
// Configure to use localStorage for session persistence
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
if (!serviceRoleKey) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations may fail.')
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey || supabaseAnonKey, // Fallback to anon key if service role missing (won't work for admin ops)
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)