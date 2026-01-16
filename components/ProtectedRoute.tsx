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
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ProtectedRoute.tsx:render',message:'ProtectedRoute render',data:{loading,hasUser:!!user,hasProfile:!!profile,profileRole:profile?.role,isAdmin,requireAdmin},timestamp:Date.now(),sessionId:'debug-session',runId:'admin-debug',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ProtectedRoute.tsx:useEffect',message:'ProtectedRoute useEffect triggered',data:{loading,hasUser:!!user,hasProfile:!!profile,profileRole:profile?.role,isAdmin,requireAdmin,pathname:typeof window!=='undefined'?window.location.pathname:'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'admin-debug',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    // Wait for loading to complete AND profile to be fetched (if user exists)
    if (!loading) {
      if (!user) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ProtectedRoute.tsx:20',message:'No user, redirecting to login',data:{pathname:window.location.pathname},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        router.push('/auth/login?redirect=' + encodeURIComponent(window.location.pathname))
      } else if (requireAdmin) {
        // If we have a user but no profile yet, wait a bit longer (profile might still be loading)
        if (profile === null && user) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ProtectedRoute.tsx:24',message:'User exists but profile is null, waiting',data:{userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          // Profile is still loading, don't redirect yet
          return
        }
        if (!isAdmin) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ProtectedRoute.tsx:28',message:'Not admin, redirecting to home',data:{profileRole:profile?.role,isAdmin},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          router.push('/')
        }
      }
    }
  }, [user, profile, loading, isAdmin, requireAdmin, router])

  // Only show loading screen if we don't have valid user/profile data yet
  // This prevents the loading flash when auth state changes but we already have valid credentials
  const shouldShowLoading = loading && (!user || !profile)
  
  if (shouldShowLoading) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ProtectedRoute.tsx:loadingScreen',message:'Showing Loading... screen',data:{loading,hasUser:!!user,hasProfile:!!profile,shouldShowLoading},timestamp:Date.now(),sessionId:'debug-session',runId:'admin-debug-fix2',hypothesisId:'K'})}).catch(()=>{});
    // #endregion
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  // If we have a user but profile is still null, show loading (profile fetch might be in progress)
  if (user && profile === null && requireAdmin) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ProtectedRoute.tsx:loadingProfileScreen',message:'Showing Loading profile... screen',data:{hasUser:!!user,userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'admin-debug',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
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
