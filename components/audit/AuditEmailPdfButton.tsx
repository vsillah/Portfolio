'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, Loader2 } from 'lucide-react'
import { getCurrentSession } from '@/lib/auth'

type Tone = 'dark' | 'light'

const buttonStyles: Record<Tone, string> = {
  dark:
    'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-radiant-gold/50 text-foreground hover:bg-radiant-gold/10 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium',
  light:
    'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-radiant-gold/40 bg-background/30 text-foreground hover:bg-radiant-gold/15 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium',
}

const msgStyles: Record<Tone, string> = {
  dark: 'text-sm text-muted-foreground',
  light: 'text-sm text-muted-foreground',
}

/**
 * Emails a printable PDF of the audit to the signed-in user's address (POST /api/tools/audit/email-pdf).
 */
export function AuditEmailPdfButton({
  auditId,
  tone = 'dark',
  className = '',
}: {
  auditId: string
  tone?: Tone
  className?: string
}) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function send() {
    setLoading(true)
    setMsg('')
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) {
        setMsg('Please sign in to email yourself a PDF.')
        return
      }
      const res = await fetch('/api/tools/audit/email-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ auditId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg(typeof data?.error === 'string' ? data.error : 'Could not send email.')
        return
      }
      setMsg('Check your inbox for the PDF.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={send}
        disabled={loading}
        className={buttonStyles[tone]}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
        ) : (
          <Mail className="h-4 w-4 shrink-0" aria-hidden />
        )}
        Email PDF to me
      </button>
      {msg ? (
        <p className={`mt-2 ${msgStyles[tone]}`} role="status">
          {msg}
        </p>
      ) : null}
    </div>
  )
}

/** Shown on the report page when the visitor is not signed in. */
export function AuditEmailPdfSignInCta({
  auditId,
  className = '',
}: {
  auditId: string
  className?: string
}) {
  return (
    <p className={`text-sm text-muted-foreground ${className}`}>
      <Link
        href={`/auth/login?redirect=${encodeURIComponent(`/tools/audit/report/${auditId}`)}`}
        className="text-radiant-gold/90 hover:underline"
      >
        Sign in
      </Link>{' '}
      to email yourself a printable PDF.
    </p>
  )
}
