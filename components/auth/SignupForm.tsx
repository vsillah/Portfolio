'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Github, Lock, Mail, UserPlus } from 'lucide-react'
import { signUp, signInWithOAuth } from '@/lib/auth'
import { useRouter, useSearchParams } from 'next/navigation'

export default function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const { error } = await signUp(email, password)
      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
        // Wait a moment then redirect (or to redirect param when email confirmation is disabled and user is signed in)
        setTimeout(() => {
          router.push(redirectTo)
          router.refresh()
        }, 2000)
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

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto w-full max-w-md text-center"
      >
        <div className="admin-console-card rounded-xl border border-green-500/40 p-8">
          <h2 className="mb-2 text-2xl font-bold text-foreground">Check your email</h2>
          <p className="text-muted-foreground">
            We sent a confirmation link. Verify the account, then return to Portfolio.
          </p>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="admin-console-command-card space-y-6 rounded-xl border p-6 sm:p-8"
      >
        <div>
          <div className="admin-console-eyebrow mb-3">Account setup</div>
          <h2 className="text-3xl font-bold text-foreground">Create account</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Create secure access for Portfolio operations and client workspaces.
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg border border-red-500/45 bg-red-500/15 p-4 text-sm text-red-200"
          >
            {error}
          </motion.div>
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
                className="input-brand w-full py-3 pl-10 pr-4"
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
                minLength={6}
                className="input-brand w-full py-3 pl-10 pr-4"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-foreground">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="input-brand w-full py-3 pl-10 pr-4"
                placeholder="••••••••"
              />
            </div>
          </div>
        </div>

        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="admin-console-button-primary h-12 w-full text-base disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            'Creating account...'
          ) : (
            <>
              <UserPlus size={20} />
              Sign Up
            </>
          )}
        </motion.button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-[#121e31] px-3 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <motion.button
            type="button"
            onClick={() => handleOAuth('github')}
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="admin-console-button-secondary h-11 w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Github size={20} />
            GitHub
          </motion.button>

          <motion.button
            type="button"
            onClick={() => handleOAuth('google')}
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
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
          </motion.button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <a href={redirectTo ? `/auth/login?redirect=${encodeURIComponent(redirectTo)}` : '/auth/login'} className="text-radiant-gold transition-colors hover:text-gold-light">
            Sign in
          </a>
        </p>
      </motion.form>
    </div>
  )
}
