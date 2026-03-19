import { createClient } from '@supabase/supabase-js'
import { integrations } from './config'

const supabaseUrl = integrations.supabase.url
const supabaseAnonKey = integrations.supabase.anonKey

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Run `npm run setup` or check your .env.local file.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
})

const serviceRoleKey = integrations.supabase.serviceRoleKey
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
