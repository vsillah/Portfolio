import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './supabase'
import { User } from '@supabase/supabase-js'
import { integrations } from './config'

export interface AuthResult {
  user: User
  isAdmin: boolean
}

export interface AuthError {
  error: string
  status: number
}

export async function verifyAuth(request: NextRequest): Promise<AuthResult | AuthError> {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return { error: 'Authentication required', status: 401 }

  const supabase = createClient(
    integrations.supabase.url,
    integrations.supabase.anonKey
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return { error: 'Authentication required', status: 401 }

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return { user, isAdmin: profile?.role === 'admin' }
}

export function isAuthError(result: AuthResult | AuthError): result is AuthError {
  return 'error' in result
}

export async function verifyAdmin(request: NextRequest): Promise<AuthResult | AuthError> {
  const result = await verifyAuth(request)
  if (isAuthError(result)) return result
  if (!result.isAdmin) return { error: 'Admin access required', status: 403 }
  return result
}
