'use client'

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { getCurrentUser, getCurrentSession, onAuthStateChange, UserProfile } from '@/lib/auth'

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  isAdmin: false,
})

const AUTH_REQUEST_TIMEOUT_MS = 8000
const PROFILE_REQUEST_TIMEOUT_MS = 10000

async function resolveWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  fallback: T,
  label: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn(`${label} timed out after ${timeoutMs}ms`)
      resolve(fallback)
    }, timeoutMs)
  })

  try {
    return await Promise.race([operation(), timeout])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const initialAuthDoneRef = useRef(false)

  // Helper function to fetch profile from API
  const fetchProfileFromAPI = async (session: Session | null, forceRefresh = false): Promise<UserProfile | null> => {
    if (!session?.access_token) {
      return null
    }

    try {
      const url = `/api/user/profile${forceRefresh ? '?t=' + Date.now() : ''}`
      const response = await resolveWithTimeout(
        () =>
          fetch(url, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
            cache: forceRefresh ? 'no-store' : 'default',
          }),
        PROFILE_REQUEST_TIMEOUT_MS,
        null,
        'Profile request',
      )

      if (!response) {
        return null
      }

      if (!response.ok) {
        if (response.status === 401) {
          return null
        }
        throw new Error(`Failed to fetch profile: ${response.status}`)
      }

      const data = await response.json()
      return data.profile as UserProfile | null
    } catch (error) {
      console.error('Error fetching profile from API:', error)
      return null
    }
  }

  useEffect(() => {
    // Get initial session: restore from storage first so we don't flash sign-in
    // while getUser() (server round-trip) is in flight
    const initAuth = async () => {
      try {
        const restoredSession = await resolveWithTimeout(
          getCurrentSession,
          AUTH_REQUEST_TIMEOUT_MS,
          null,
          'Initial session restore',
        )

        if (restoredSession?.user) {
          setUser(restoredSession.user)
          setSession(restoredSession)
          try {
            const userProfile = await fetchProfileFromAPI(restoredSession, true)
            setProfile(userProfile)
          } catch (profileError) {
            console.warn('Profile fetch error:', profileError)
          }
        }

        const currentUser = await resolveWithTimeout(
          getCurrentUser,
          AUTH_REQUEST_TIMEOUT_MS,
          null,
          'Current user request',
        )
        setUser(currentUser)

        if (currentUser) {
          const currentSession = await resolveWithTimeout(
            getCurrentSession,
            AUTH_REQUEST_TIMEOUT_MS,
            null,
            'Current session refresh',
          )
          if (currentSession) {
            setSession(currentSession)
            if (!restoredSession?.user) {
              try {
                const userProfile = await fetchProfileFromAPI(currentSession, true)
                setProfile(userProfile)
              } catch (profileError) {
                console.warn('Profile fetch error:', profileError)
              }
            }
          }
        } else {
          setSession(null)
          setProfile(null)
        }
      } catch (error) {
        console.error('Auth init error:', error)
      } finally {
        initialAuthDoneRef.current = true
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
        setSession(null)
        setProfile(null)
        // Don't set loading false until initAuth has run; otherwise we flash "signed out"
        // before getCurrentUser() has restored the session from storage
        if (initialAuthDoneRef.current) {
          setLoading(false)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const isAdmin = profile?.role === 'admin' || false

  const value = {
    user,
    session,
    profile,
    loading,
    isAdmin,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
