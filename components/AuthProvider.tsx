'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { getCurrentUser, getUserProfile, onAuthStateChange, UserProfile } from '@/lib/auth'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      try {
        const user = await getCurrentUser()
        setUser(user)
        if (user) {
          try {
            const userProfile = await getUserProfile(user.id)
            setProfile(userProfile)
          } catch (profileError) {
            // Silently handle profile errors - profile might not exist yet or will be created by trigger
            // The trigger should create it automatically, so we don't need to log this
          }
        }
      } catch (error) {
        // Only log unexpected errors
        console.error('Auth init error:', error)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        // Fetch profile with error suppression
        // Use setTimeout to debounce and avoid rapid repeated calls
        setTimeout(async () => {
          try {
            const userProfile = await getUserProfile(session.user.id)
            if (userProfile) {
              setProfile(userProfile)
            }
            // If profile is null, it will be created by the database trigger
            // We'll get it on the next auth state change
          } catch (profileError) {
            // Silently handle all profile errors - they're expected during initial setup
          }
        }, 100)
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin' || false,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
