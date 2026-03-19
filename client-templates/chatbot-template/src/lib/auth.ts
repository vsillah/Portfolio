import { supabase } from './supabase'
import { User, Session } from '@supabase/supabase-js'

export interface UserProfile {
  id: string
  email: string
  role: 'user' | 'admin'
  created_at: string
  updated_at: string
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        const { data: { user } } = await supabase.auth.getUser()
        if (user && user.email) {
          const { data: newProfile, error: createError } = await supabase
            .from('user_profiles')
            .insert([{ id: userId, email: user.email, role: 'user' }])
            .select()
            .single()
          if (!createError && newProfile) return newProfile as UserProfile
        }
      }
      return null
    }
    if (!data) return null
    return data as UserProfile
  } catch {
    return null
  }
}

export async function isAdmin(userId?: string): Promise<boolean> {
  const user = userId ? { id: userId } : await getCurrentUser()
  if (!user) return false
  const profile = await getUserProfile(user.id)
  return profile?.role === 'admin'
}

export async function signUp(email: string, password: string) {
  return supabase.auth.signUp({ email, password })
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function signInWithOAuth(provider: 'google' | 'github') {
  return supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
}

export function onAuthStateChange(callback: (event: string, session: Session | null) => void) {
  return supabase.auth.onAuthStateChange(callback)
}
