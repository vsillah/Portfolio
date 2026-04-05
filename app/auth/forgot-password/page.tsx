'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail } from 'lucide-react'
import { resetPassword } from '@/lib/auth'
import Link from 'next/link'
import SiteThemeCorner from '@/components/SiteThemeCorner'

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
    <>
      <SiteThemeCorner />
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 bg-silicon-slate border border-silicon-slate rounded-xl p-8"
        >
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Reset password</h2>
            <p className="text-muted-foreground">Enter your account email and we&apos;ll send a link to set a new password.</p>
          </div>

          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {sent ? (
            <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm">
              Check your email for the reset link. It may take a few minutes. Click the link to set a new password.
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 input-brand transition-colors"
                    placeholder="you@example.com"
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
                {loading ? 'Sending…' : 'Send reset link'}
              </motion.button>
            </>
          )}

          <p className="text-center text-sm text-muted-foreground">
            <Link href="/auth/login" className="text-radiant-gold hover:text-gold-light transition-colors">
              Back to sign in
            </Link>
          </p>
        </motion.form>
      </div>
    </div>
    </>
  )
}
