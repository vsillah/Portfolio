'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the hash from the URL (Supabase OAuth returns tokens in hash)
        const hash = window.location.hash.substring(1)
        const hashParams = new URLSearchParams(hash)
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const error = hashParams.get('error')
        const errorDescription = hashParams.get('error_description')

        // Only log in development
        if (process.env.NODE_ENV === 'development') {
          console.log('Auth callback - Full URL:', window.location.href)
          console.log('Auth callback - Hash:', window.location.hash)
          console.log('Extracted tokens:', { accessToken: !!accessToken, refreshToken: !!refreshToken, error })
        }

        if (error) {
          // Log error in production for debugging OAuth issues
          console.error('OAuth error:', error, errorDescription)
          router.push(`/auth/login?error=${encodeURIComponent(errorDescription || error)}`)
          return
        }

        if (accessToken && refreshToken) {
          // Set the session using Supabase client
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (sessionError) {
            if (process.env.NODE_ENV === 'development') {
              console.error('Session error:', sessionError)
            }
            router.push(`/auth/login?error=${encodeURIComponent(sessionError.message)}`)
            return
          }

          if (data?.session) {
            // Success! Redirect to home or the next URL
            const next = searchParams.get('next') || '/'
            // Clear the hash from URL
            window.history.replaceState(null, '', window.location.pathname + window.location.search)
            router.push(next)
            router.refresh() // Refresh to update auth state
            return
          }
        }

        // Also check for code parameter (fallback for PKCE flow)
        const code = searchParams.get('code')
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          
          if (exchangeError) {
            if (process.env.NODE_ENV === 'development') {
              console.error('Code exchange error:', exchangeError)
            }
            router.push(`/auth/login?error=${encodeURIComponent(exchangeError.message)}`)
            return
          }

          if (data?.session) {
            const next = searchParams.get('next') || '/'
            router.push(next)
            router.refresh()
            return
          }
        }

        // Check if we already have a session (might have been set automatically)
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const next = searchParams.get('next') || '/'
          router.push(next)
          router.refresh()
          return
        }

        // If we get here, something went wrong
        router.push('/auth/login?error=Could not authenticate')
      } catch (error: any) {
        // Only log in development to avoid console spam in production
        if (process.env.NODE_ENV === 'development') {
          console.error('Auth callback error:', error)
        }
        router.push(`/auth/login?error=${encodeURIComponent(error.message || 'Authentication failed')}`)
      }
    }

    // Small delay to ensure hash is available
    const timer = setTimeout(() => {
      handleAuthCallback()
    }, 100)

    return () => clearTimeout(timer)
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-white">Completing authentication...</div>
    </div>
  )
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
}
