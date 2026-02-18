import { supabase } from './supabase'
import { User, Session } from '@supabase/supabase-js'

export interface UserProfile {
  id: string
  email: string
  role: 'user' | 'admin'
  created_at: string
  updated_at: string
}

// Get current user
export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Get current session
export async function getCurrentSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// Get user profile with role
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      // Suppress ALL profile fetch errors - they're expected during initial setup
      // The profile will be created by the database trigger automatically
      // 500 errors often indicate RLS policy issues that resolve once the profile exists
      // We don't log any errors here to keep the console clean
      
      // If profile doesn't exist, try to create it (but only if it's a "not found" error)
      if (error.code === 'PGRST116') {
        // Profile doesn't exist, create it
        const { data: { user } } = await supabase.auth.getUser()
        if (user && user.email) {
          const { data: newProfile, error: createError } = await supabase
            .from('user_profiles')
            .insert([{ id: userId, email: user.email, role: 'user' }])
            .select()
            .single()
          
          if (!createError && newProfile) {
            return newProfile as UserProfile
          }
        }
      }
      return null
    }

    if (!data) return null
    return data as UserProfile
  } catch (error) {
    // Suppress all errors - profile will be created by trigger or RLS will handle it
    return null
  }
}

// Check if user is admin
export async function isAdmin(userId?: string): Promise<boolean> {
  const user = userId ? { id: userId } : await getCurrentUser()
  if (!user) return false

  const profile = await getUserProfile(user.id)
  return profile?.role === 'admin'
}

// Sign up with email/password
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  return { data, error }
}

// Sign in with email/password
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

// Sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

// Sign in with OAuth provider. Pass nextPath to land on that page after OAuth (e.g. /checkout).
export async function signInWithOAuth(provider: 'google' | 'github', nextPath?: string) {
  const base = `${window.location.origin}/auth/callback`
  const redirectTo = nextPath
    ? `${base}?next=${encodeURIComponent(nextPath)}`
    : base
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
    },
  })
  return { data, error }
}

// Reset password
export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  })
  return { data, error }
}

// Update password
export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  })
  return { data, error }
}

// Listen to auth state changes
export function onAuthStateChange(callback: (event: string, session: Session | null) => void) {
  return supabase.auth.onAuthStateChange(callback)
}
