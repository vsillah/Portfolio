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
        console.log('Auth callback - Full URL:', window.location.href)
        console.log('Auth callback - Hash:', window.location.hash)
        console.log('Auth callback - Search:', window.location.search)

        // Get the hash from the URL (Supabase OAuth returns tokens in hash)
        const hash = window.location.hash.substring(1)
        const hashParams = new URLSearchParams(hash)
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const error = hashParams.get('error')
        const errorDescription = hashParams.get('error_description')

        console.log('Extracted tokens:', { accessToken: !!accessToken, refreshToken: !!refreshToken, error })

        if (error) {
          console.error('OAuth error:', error, errorDescription)
          router.push(`/auth/login?error=${encodeURIComponent(errorDescription || error)}`)
          return
        }

        if (accessToken && refreshToken) {
          console.log('Setting session with tokens...')
          // Set the session using Supabase client
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (sessionError) {
            console.error('Session error:', sessionError)
            router.push(`/auth/login?error=${encodeURIComponent(sessionError.message)}`)
            return
          }

          if (data?.session) {
            console.log('Session established successfully!', data.session.user.email)
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
          console.log('Found code parameter, exchanging...')
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          
          if (exchangeError) {
            console.error('Code exchange error:', exchangeError)
            router.push(`/auth/login?error=${encodeURIComponent(exchangeError.message)}`)
            return
          }

          if (data?.session) {
            console.log('Session established via code exchange!', data.session.user.email)
            const next = searchParams.get('next') || '/'
            router.push(next)
            router.refresh()
            return
          }
        }

        // Check if we already have a session (might have been set automatically)
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          console.log('Found existing session!', session.user.email)
          const next = searchParams.get('next') || '/'
          router.push(next)
          router.refresh()
          return
        }

        // If we get here, something went wrong
        console.error('No tokens, code, or session found. Redirecting to login.')
        router.push('/auth/login?error=Could not authenticate')
      } catch (error: any) {
        console.error('Auth callback error:', error)
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
