'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { updatePassword } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-silicon-slate border border-silicon-slate rounded-xl p-8 text-center">
          <p className="text-platinum-white/80 mb-4">Checking your reset link…</p>
          <p className="text-platinum-white/60 text-sm">
            If this page doesn’t update, the link may be invalid or expired.{' '}
            <Link href="/auth/forgot-password" className="text-radiant-gold hover:text-gold-light">Request a new one</Link>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 bg-silicon-slate border border-silicon-slate rounded-xl p-8"
        >
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Set new password</h2>
            <p className="text-platinum-white/80">Choose a password you’ll use to sign in with email.</p>
          </div>

          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-platinum-white mb-2">
              New password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-platinum-white/80" size={20} />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full pl-10 pr-4 py-3 input-brand transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-platinum-white mb-2">
              Confirm password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-platinum-white/80" size={20} />
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                className="w-full pl-10 pr-4 py-3 input-brand transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3 btn-gold text-imperial-navy font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving…' : 'Set password'}
          </motion.button>

          <p className="text-center text-sm text-platinum-white/80">
            <Link href="/auth/login" className="text-radiant-gold hover:text-gold-light transition-colors">
              Back to sign in
            </Link>
          </p>
        </motion.form>
      </div>
    </div>
  )
}
