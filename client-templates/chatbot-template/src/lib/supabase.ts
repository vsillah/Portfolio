import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { integrations } from './config'

let _supabase: SupabaseClient | null = null
let _supabaseAdmin: SupabaseClient | null = null

function getSupabaseConfig() {
  const url = integrations.supabase.url
  const anonKey = integrations.supabase.anonKey
  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase environment variables. Run `npm run setup` or check your .env.local file.'
    )
  }
  return { url, anonKey, serviceRoleKey: integrations.supabase.serviceRoleKey }
}

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const { url, anonKey } = getSupabaseConfig()
    _supabase = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    })
  }
  return _supabase
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const { url, anonKey, serviceRoleKey } = getSupabaseConfig()
    if (!serviceRoleKey) {
      console.warn('[SERVER] SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations may fail.')
    }
    _supabaseAdmin = createClient(url, serviceRoleKey || anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return _supabaseAdmin
}

/** @deprecated Use getSupabase() instead — kept for backward compatibility */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) { return (getSupabase() as any)[prop] },
})

/** @deprecated Use getSupabaseAdmin() instead — kept for backward compatibility */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) { return (getSupabaseAdmin() as any)[prop] },
})
