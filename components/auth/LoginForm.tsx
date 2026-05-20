'use client'

import { useState } from 'react'
import { Github, Lock, LogIn, Mail } from 'lucide-react'
import { signIn, signInWithOAuth } from '@/lib/auth'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error } = await signIn(email, password)
      if (error) {
        setError(error.message)
      } else {
        router.push(redirectTo)
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = async (provider: 'google' | 'github') => {
    setError('')
    setLoading(true)
    try {
      const { error } = await signInWithOAuth(provider, redirectTo)
      if (error) {
        setError(error.message)
        setLoading(false)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <form
        onSubmit={handleSubmit}
        className="admin-console-command-card animate-fade-in-up space-y-6 rounded-xl border p-6 sm:p-8"
      >
        <div>
          <div className="admin-console-eyebrow mb-3">Secure access</div>
          <h2 className="text-3xl font-bold text-foreground">Sign in</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Access Portfolio operations, client workspaces, and saved admin context.
          </p>
        </div>

        {error && (
          <div className="animate-fade-in rounded-lg border border-red-500/45 bg-red-500/15 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-foreground">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-brand w-full py-3 pl-10 pr-4 transition-colors"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-foreground">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-brand w-full py-3 pl-10 pr-4 transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="admin-console-button-primary h-12 w-full text-base transition-transform duration-150 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            'Signing in...'
          ) : (
            <>
              <LogIn size={20} />
              Sign In
            </>
          )}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-[#121e31] px-3 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleOAuth('github')}
            disabled={loading}
            className="admin-console-button-secondary h-11 w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Github size={20} />
            GitHub
          </button>

          <button
            type="button"
            onClick={() => handleOAuth('google')}
            disabled={loading}
            className="admin-console-button-secondary h-11 w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <a href={redirectTo ? `/auth/signup?redirect=${encodeURIComponent(redirectTo)}` : '/auth/signup'} className="text-radiant-gold transition-colors hover:text-gold-light">
            Sign up
          </a>
        </p>

        <p className="text-center text-sm text-muted-foreground">
          <a href="/auth/forgot-password" className="text-radiant-gold transition-colors hover:text-gold-light">
            Forgot password?
          </a>
        </p>
      </form>
    </div>
  )
}
