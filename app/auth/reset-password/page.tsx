'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { updatePassword } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AuthShell from '@/components/auth/AuthShell'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Supabase recovery link puts tokens in the URL hash; the client recovers the session on load.
    const check = async () => {
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      setReady(!!session)
    }
    check()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      const { error } = await updatePassword(password)
      if (error) {
        setError(error.message)
      } else {
        router.push('/auth/login')
        router.refresh()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return (
      <AuthShell>
        <div className="admin-console-card rounded-xl border p-8 text-center">
          <div className="admin-console-eyebrow mb-3 justify-center">Recovery link</div>
          <p className="mb-4 text-muted-foreground">Checking your reset link...</p>
          <p className="text-sm leading-6 text-muted-foreground">
            If this page doesn’t update, the link may be invalid or expired.{' '}
            <Link href="/auth/forgot-password" className="text-radiant-gold hover:text-gold-light">Request a new one</Link>.
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="admin-console-command-card space-y-6 rounded-xl border p-6 sm:p-8"
      >
        <div>
          <div className="admin-console-eyebrow mb-3">Account recovery</div>
          <h2 className="text-3xl font-bold text-foreground">Set new password</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Choose the password you will use to sign in with email.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/45 bg-red-500/15 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-foreground">
            New password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="input-brand w-full py-3 pr-4 transition-colors"
              style={{ paddingLeft: '3.25rem' }}
              placeholder="••••••••"
            />
          </div>
        </div>

        <div>
          <label htmlFor="confirm" className="mb-2 block text-sm font-medium text-foreground">
            Confirm password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              className="input-brand w-full py-3 pr-4 transition-colors"
              style={{ paddingLeft: '3.25rem' }}
              placeholder="••••••••"
            />
          </div>
        </div>

        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="admin-console-button-primary h-12 w-full text-base disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Set password'}
        </motion.button>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/auth/login" className="text-radiant-gold transition-colors hover:text-gold-light">
            Back to sign in
          </Link>
        </p>
      </motion.form>
    </AuthShell>
  )
}
