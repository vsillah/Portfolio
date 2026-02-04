'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { getCurrentUser, getCurrentSession, onAuthStateChange, UserProfile } from '@/lib/auth'

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

  // Helper function to fetch profile from API
  const fetchProfileFromAPI = async (session: Session | null, forceRefresh = false): Promise<UserProfile | null> => {
    if (!session?.access_token) {
      return null
    }

    try {
      const url = `/api/user/profile${forceRefresh ? '?t=' + Date.now() : ''}`
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        cache: forceRefresh ? 'no-store' : 'default',
      })

      if (!response.ok) {
        if (response.status === 401) {
          return null
        }
        throw new Error(`Failed to fetch profile: ${response.status}`)
      }

      const data = await response.json()
      console.log('[AUTH DEBUG] Fetched profile from API:', data.profile)
      return data.profile as UserProfile | null
    } catch (error) {
      console.error('Error fetching profile from API:', error)
      return null
    }
  }

  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      try {
        const user = await getCurrentUser()
        setUser(user)
        if (user) {
          try {
            const session = await getCurrentSession()
            if (session) {
              const userProfile = await fetchProfileFromAPI(session, true) // Force refresh on init
              setProfile(userProfile)
            }
          } catch (profileError) {
            // Silently handle profile errors - profile might not exist yet or will be created by trigger
            console.warn('Profile fetch error:', profileError)
          }
        }
      } catch (error) {
        // Only log unexpected errors
        console.error('Auth init error:', error)
      } finally {
        // Only set loading false after profile fetch completes (or if no user)
        setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        // Note: We set loading true here, but ProtectedRoute will only show
        // the loading screen if we don't have valid user/profile data yet
        setLoading(true)
        // Fetch profile using API route
        // Use setTimeout to debounce and avoid rapid repeated calls
        setTimeout(async () => {
          try {
            const userProfile = await fetchProfileFromAPI(session)
            if (userProfile) {
              setProfile(userProfile)
            }
            // If profile is null, it will be created by the database trigger
            // We'll get it on the next auth state change
          } catch (profileError) {
            // Silently handle all profile errors - they're expected during initial setup
            console.warn('Profile fetch error in auth change:', profileError)
          } finally {
            setLoading(false) // Only set loading false after profile fetch completes
          }
        }, 100)
      } else {
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const isAdmin = profile?.role === 'admin' || false

  // Debug logging
  useEffect(() => {
    if (user && !loading) {
      console.log('[AUTH DEBUG] User:', user.id, user.email)
      console.log('[AUTH DEBUG] Profile:', profile)
      console.log('[AUTH DEBUG] Profile role:', profile?.role)
      console.log('[AUTH DEBUG] isAdmin:', isAdmin)
    }
  }, [user, profile, loading, isAdmin])

  const value = {
    user,
    profile,
    loading,
    isAdmin,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
