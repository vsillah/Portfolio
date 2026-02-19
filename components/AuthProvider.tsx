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
    // Get initial session: restore from storage first so we don't flash sign-in
    // while getUser() (server round-trip) is in flight
    const initAuth = async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthProvider.tsx:initAuth',message:'initAuth started',data:{},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      try {
        const session = await getCurrentSession()
        if (session?.user) {
          setUser(session.user)
          setSession(session)
          try {
            const userProfile = await fetchProfileFromAPI(session, true)
            setProfile(userProfile)
          } catch (profileError) {
            console.warn('Profile fetch error:', profileError)
          }
        }
        const user = await getCurrentUser()
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthProvider.tsx:getCurrentUser',message:'getCurrentUser resolved',data:{userId:user?.id ?? null,hasUser:!!user},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        setUser(user)
        if (user) {
          const currentSession = await getCurrentSession()
          if (currentSession) {
            setSession(currentSession)
            if (!session?.user) {
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
        }
      } catch (error) {
        console.error('Auth init error:', error)
      } finally {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthProvider.tsx:finally',message:'auth loading set false',data:{},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
        // #endregion
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
    session,
    profile,
    loading,
    isAdmin,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
