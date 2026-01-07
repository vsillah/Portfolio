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

        if (error) {
          window.location.href = `/auth/login?error=${encodeURIComponent(errorDescription || error)}`
          return
        }

        if (accessToken && refreshToken) {
          // Set the session using Supabase client
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (sessionError) {
            window.location.href = `/auth/login?error=${encodeURIComponent(sessionError.message)}`
            return
          }

          if (data?.session) {
            // Success! Wait a moment for session to be stored
            await new Promise(resolve => setTimeout(resolve, 200))
            
            // Get next URL or default to home
            const next = searchParams.get('next') || '/'
            
            // Clear the hash from URL
            window.history.replaceState(null, '', window.location.pathname + window.location.search)
            
            // Use window.location for production - ensures full page reload
            window.location.href = next
            return
          }
        }

        // Also check for code parameter (fallback for PKCE flow)
        const code = searchParams.get('code')
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          
          if (exchangeError) {
            window.location.href = `/auth/login?error=${encodeURIComponent(exchangeError.message)}`
            return
          }

          if (data?.session) {
            // Wait for session to be stored
            await new Promise(resolve => setTimeout(resolve, 200))
            
            const next = searchParams.get('next') || '/'
            window.location.href = next
            return
          }
        }

        // Check if we already have a session (might have been set automatically)
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const next = searchParams.get('next') || '/'
          window.location.href = next
          return
        }

        // If we get here, something went wrong
        window.location.href = '/auth/login?error=Could not authenticate'
      } catch (error: any) {
        window.location.href = `/auth/login?error=${encodeURIComponent(error.message || 'Authentication failed')}`
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