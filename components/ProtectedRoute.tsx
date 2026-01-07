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
    if (!loading) {
      if (!user) {
        router.push('/auth/login?redirect=' + encodeURIComponent(window.location.pathname))
      } else if (requireAdmin && !isAdmin) {
        router.push('/')
      }
    }
  }, [user, loading, isAdmin, requireAdmin, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
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
