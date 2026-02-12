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
// Note: This is accessed in API routes (server-side only)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey && typeof window === 'undefined') {
  // Only warn on server-side to avoid client-side warnings
  console.warn('[SERVER] SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations may fail.')
}

// Ensure supabaseAdmin is only created on the server to avoid client-side auth warnings
// CRITICAL: Force Authorization header via global.headers to prevent auth state contamination
// from other Supabase clients sharing the same in-memory auth store (same URL = same storageKey)
export const supabaseAdmin = typeof window === 'undefined'
  ? createClient(
      supabaseUrl,
      serviceRoleKey || supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${serviceRoleKey || supabaseAnonKey}`
          },
          // Prevent Next.js from caching PostgREST responses in Route Handlers.
          // Without this, stale data can be served from the fetch cache.
          fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' })
        }
      }
    )
  : null as any
