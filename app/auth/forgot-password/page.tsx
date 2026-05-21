'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail } from 'lucide-react'
import { resetPassword } from '@/lib/auth'
import Link from 'next/link'
import AuthShell from '@/components/auth/AuthShell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setSent(false)
    try {
      const { error } = await resetPassword(email)
      if (error) {
        setError(error.message)
      } else {
        setSent(true)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
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
          <h2 className="text-3xl font-bold text-foreground">Reset password</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Enter your account email. We will send a secure link to set a new password.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/45 bg-red-500/15 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {sent ? (
          <div className="rounded-lg border border-green-500/40 bg-green-500/15 p-4 text-sm text-green-100">
            Check your email for the reset link. It may take a few minutes.
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-foreground">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input-brand w-full py-3 pr-4 transition-colors"
                  style={{ paddingLeft: '3.25rem' }}
                  placeholder="you@example.com"
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
              {loading ? 'Sending...' : 'Send reset link'}
            </motion.button>
          </>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/auth/login" className="text-radiant-gold transition-colors hover:text-gold-light">
            Back to sign in
          </Link>
        </p>
      </motion.form>
    </AuthShell>
  )
}
