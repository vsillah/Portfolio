// Server-side authentication utilities for API routes
// These work with the Authorization header token, unlike the client-side auth.ts

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './supabase'
import { User } from '@supabase/supabase-js'

export interface AuthResult {
  user: User
  isAdmin: boolean
}

export interface AuthError {
  error: string
  status: number
}

/**
 * Verify user from Authorization header token
 * Use this in API routes instead of getCurrentUser() from lib/auth.ts
 */
export async function verifyAuth(request: NextRequest): Promise<AuthResult | AuthError> {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  
  if (!token) {
    return { error: 'Authentication required', status: 401 }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  
  if (authError || !user) {
    return { error: 'Authentication required', status: 401 }
  }

  // Check if user is admin
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return {
    user,
    isAdmin: profile?.role === 'admin'
  }
}

/**
 * Type guard to check if result is an error
 */
export function isAuthError(result: AuthResult | AuthError): result is AuthError {
  return 'error' in result
}

/**
 * Verify user and require admin access
 * Returns the user if admin, or an error object
 */
export async function verifyAdmin(request: NextRequest): Promise<AuthResult | AuthError> {
  const result = await verifyAuth(request)
  
  if (isAuthError(result)) {
    return result
  }
  
  if (!result.isAdmin) {
    return { error: 'Admin access required', status: 403 }
  }
  
  return result
}

/**
 * Try to verify user from Authorization header token (optional auth)
 * Returns user if valid token exists, null if no token
 */
export async function tryVerifyAuth(request: NextRequest): Promise<AuthResult | null> {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  
  if (!token) {
    return null // No token provided - that's ok for optional auth
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  
  if (authError || !user) {
    return null // Invalid token - treat as unauthenticated
  }

  // Check if user is admin
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return {
    user,
    isAdmin: profile?.role === 'admin'
  }
}
