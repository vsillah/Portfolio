'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, profile, loading, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Wait for loading to complete AND profile to be fetched (if user exists)
    if (!loading) {
      if (!user) {
        router.push('/auth/login?redirect=' + encodeURIComponent(window.location.pathname))
      } else if (requireAdmin) {
        // If we have a user but no profile yet, wait a bit longer (profile might still be loading)
        if (profile === null && user) {
          // Profile is still loading, don't redirect yet
          return
        }
        if (!isAdmin) {
          router.push('/')
        }
      }
    }
  }, [user, profile, loading, isAdmin, requireAdmin, router])

  // Only show loading screen if we don't have valid user/profile data yet
  // This prevents the loading flash when auth state changes but we already have valid credentials
  const shouldShowLoading = loading && (!user || !profile)
  
  if (shouldShowLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  // If we have a user but profile is still null, show loading (profile fetch might be in progress)
  if (user && profile === null && requireAdmin) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading profile...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-red-500">Access denied. Admin privileges required.</div>
      </div>
    )
  }

  return <>{children}</>
}
