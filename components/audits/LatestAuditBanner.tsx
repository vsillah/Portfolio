'use client'

/**
 * Shared "Latest audit" awareness banner.
 *
 * Shown wherever a new audit could be generated (public /tools/audit, admin
 * sales pages, contact detail, gamma reports, etc.) so the user always knows
 * if a prior audit already exists for this contact and can either view the
 * existing report or regenerate it from the data on file — no re-entry.
 *
 * All "View report" and "Rerun" actions ultimately tie back to the same
 * gamma_reports row and the /admin/reports/gamma admin page.
 */

import { useCallback, useEffect, useState } from 'react'
import { getCurrentSession } from '@/lib/auth'

type Mode = 'public' | 'admin'

export type LatestAuditBannerProps = {
  mode: Mode
  /** Public: required. Admin: optional if contactSubmissionId or auditId supplied. */
  email?: string | null
  /** Admin only: primary lookup key when known. */
  contactSubmissionId?: number | string | null
  /** Admin only: direct audit lookup. */
  auditId?: string | number | null
  /** Optional compact variant for table rows / tight layouts. */
  variant?: 'card' | 'inline'
  /** Called after a successful rerun kicks off. */
  onRerun?: (info: { auditId: string; gammaReportId: string }) => void
  /** Optional className override on the outer wrapper. */
  className?: string
}

type LatestAuditResponse = {
  found: boolean
  auditId?: string
  auditStatus?: string | null
  completedAt?: string | null
  updatedAt?: string | null
  businessName?: string | null
  contactEmail?: string | null
  contactSubmissionId?: number | null
  auditType?: string | null
  gammaReportId?: string | null
  gammaUrl?: string | null
  gammaStatus?: string | null
  gammaCreatedAt?: string | null
  adminReportUrl?: string
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'recently'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'recently'
  const diffMs = Date.now() - then
  if (diffMs < 0) return 'just now'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.floor(days / 365)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

async function adminHeaders(): Promise<HeadersInit> {
  try {
    const session = await getCurrentSession()
    const token = session?.access_token
    return token
      ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      : { 'Content-Type': 'application/json' }
  } catch {
    return { 'Content-Type': 'application/json' }
  }
}

export default function LatestAuditBanner({
  mode,
  email,
  contactSubmissionId,
  auditId,
  variant = 'card',
  onRerun,
  className,
}: LatestAuditBannerProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<LatestAuditResponse | null>(null)
  const [rerunning, setRerunning] = useState(false)
  const [rerunMessage, setRerunMessage] = useState<string | null>(null)
  const [rerunError, setRerunError] = useState<string | null>(null)

  const loadLatest = useCallback(async () => {
    setLoading(true)
    try {
      if (mode === 'public') {
        const normEmail = (email || '').trim().toLowerCase()
        if (!normEmail || !normEmail.includes('@')) {
          setData(null)
          return
        }
        const res = await fetch(`/api/audits/latest?email=${encodeURIComponent(normEmail)}`)
        if (!res.ok) {
          setData(null)
          return
        }
        setData((await res.json()) as LatestAuditResponse)
      } else {
        const params = new URLSearchParams()
        if (email) params.set('email', email)
        if (contactSubmissionId !== null && contactSubmissionId !== undefined && contactSubmissionId !== '') {
          params.set('contactSubmissionId', String(contactSubmissionId))
        }
        if (auditId) params.set('auditId', String(auditId))
        if (!params.toString()) {
          setData(null)
          return
        }
        const headers = await adminHeaders()
        const res = await fetch(`/api/admin/audits/latest?${params.toString()}`, { headers })
        if (!res.ok) {
          setData(null)
          return
        }
        setData((await res.json()) as LatestAuditResponse)
      }
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [mode, email, contactSubmissionId, auditId])

  useEffect(() => {
    void loadLatest()
  }, [loadLatest])

  const handleRerun = useCallback(async () => {
    if (!data?.found || !data.auditId) return
    setRerunning(true)
    setRerunError(null)
    setRerunMessage(null)
    try {
      if (mode === 'public') {
        const res = await fetch('/api/audits/rerun', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: (email || '').trim().toLowerCase() }),
        })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          setRerunError(
            typeof payload?.error === 'string' && payload.error
              ? payload.error
              : 'We could not start a new report. Please try again.'
          )
          return
        }
        setRerunMessage('Report regenerating — we will email you when it is ready.')
        onRerun?.({ auditId: payload.auditId, gammaReportId: payload.gammaReportId })
      } else {
        const headers = await adminHeaders()
        const res = await fetch('/api/admin/audits/rerun', {
          method: 'POST',
          headers,
          body: JSON.stringify({ auditId: data.auditId }),
        })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          setRerunError(
            typeof payload?.error === 'string' && payload.error
              ? payload.error
              : 'Failed to regenerate the audit report.'
          )
          return
        }
        setRerunMessage('Regeneration started. Track progress in Admin → Reports → Gamma.')
        onRerun?.({ auditId: payload.auditId, gammaReportId: payload.gammaReportId })
      }
      // Refresh the banner so the status reflects the new "generating" row.
      await loadLatest()
    } catch {
      setRerunError('Network error. Please try again.')
    } finally {
      setRerunning(false)
    }
  }, [data, mode, email, loadLatest, onRerun])

  if (loading && !data) return null
  if (!data?.found || !data.auditId) return null

  const when = formatRelative(data.completedAt || data.updatedAt)
  const gammaStatus = data.gammaStatus || null
  const gammaReady = gammaStatus === 'completed' && Boolean(data.gammaUrl)
  const gammaGenerating = gammaStatus === 'generating' || gammaStatus === 'pending'

  const viewHref =
    mode === 'admin'
      ? data.adminReportUrl || `/admin/reports/gamma?auditId=${encodeURIComponent(data.auditId)}`
      : data.gammaUrl || null

  const viewLabel = mode === 'admin' ? 'View report' : 'View report'

  const wrapperClass =
    variant === 'inline'
      ? 'flex flex-wrap items-center gap-2 text-xs text-emerald-200'
      : 'rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-100'

  return (
    <div className={`${wrapperClass} ${className || ''}`.trim()} data-testid="latest-audit-banner">
      <div className={variant === 'inline' ? 'flex items-center gap-2' : 'flex items-start gap-3'}>
        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
        <div className="flex-1">
          <div className={variant === 'inline' ? 'font-medium' : 'font-medium text-emerald-100'}>
            Latest audit {when}
            {data.businessName ? (
              <span className="text-emerald-200/70"> · {data.businessName}</span>
            ) : null}
          </div>
          {variant === 'card' ? (
            <div className="mt-0.5 text-xs text-emerald-200/70">
              {gammaReady
                ? 'A Gamma report is ready. View the existing deck or regenerate it from the saved audit data.'
                : gammaGenerating
                  ? 'A new Gamma report is being generated — check back shortly.'
                  : 'No Gamma deck yet. You can regenerate one from the saved audit data.'}
            </div>
          ) : null}
        </div>
        <div className={variant === 'inline' ? 'flex items-center gap-2' : 'flex shrink-0 items-center gap-2'}>
          {viewHref ? (
            <a
              href={viewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-100 hover:bg-emerald-500/20"
              aria-disabled={!gammaReady && mode === 'public'}
              onClick={(e) => {
                if (mode === 'public' && !gammaReady) e.preventDefault()
              }}
            >
              {viewLabel}
            </a>
          ) : null}
          <button
            type="button"
            onClick={handleRerun}
            disabled={rerunning || gammaGenerating}
            className="inline-flex items-center rounded-md border border-emerald-400/40 bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-100 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rerunning ? 'Starting…' : gammaGenerating ? 'Regenerating…' : 'Rerun'}
          </button>
        </div>
      </div>
      {rerunMessage ? (
        <div className="mt-2 text-xs text-emerald-200">{rerunMessage}</div>
      ) : null}
      {rerunError ? <div className="mt-2 text-xs text-rose-300">{rerunError}</div> : null}
    </div>
  )
}
