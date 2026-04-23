'use client'

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Inbox, RefreshCw, ExternalLink, Search, X } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'

interface EmailMessageRow {
  id: string
  email_kind: string
  channel: string
  contact_submission_id: number | null
  recipient_email: string | null
  subject: string | null
  body_preview: string
  direction: string
  status: string
  transport: string
  source_system: string
  source_id: string | null
  external_id: string | null
  sent_at: string | null
  created_at: string
  metadata: Record<string, unknown>
}

const STATUS_OPTIONS = [
  'all',
  'draft',
  'queued',
  'sent',
  'failed',
  'bounced',
  'replied',
  'delivered',
  'complained',
  'opened',
  'clicked',
  'delivery_delayed',
] as const
const TRANSPORT_OPTIONS = ['all', 'gmail_smtp', 'n8n', 'logged_only', 'unknown', 'resend'] as const

function contactLabelFromRow(row: { name: string | null; email: string | null; company: string | null }, id: string) {
  const name = row.name?.trim() ?? ''
  if (name) return name
  const email = row.email?.trim() ?? ''
  if (email) return email
  return `Contact #${id}`
}

export default function EmailCenterPage() {
  return (
    <ProtectedRoute requireAdmin>
      <EmailCenterContent />
    </ProtectedRoute>
  )
}

function EmailCenterContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  /** When set (e.g. from Lead Pipeline link), still filters server-side but no free-form ID field. */
  const contactFromUrl = searchParams.get('contact')?.trim() ?? ''

  const [items, setItems] = useState<EmailMessageRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') ?? '')
  const [qDebounced, setQDebounced] = useState(() => searchParams.get('q') ?? '')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [kindFilter, setKindFilter] = useState('')
  const [transportFilter, setTransportFilter] = useState<string>('all')
  const [leadContactInfo, setLeadContactInfo] = useState<{
    name: string | null
    email: string | null
    company: string | null
  } | null>(null)
  const [leadContactLoading, setLeadContactLoading] = useState(false)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce search (meeting records pattern)
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setQDebounced(searchInput.trim())
      searchDebounceRef.current = null
    }, 400)
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [searchInput])

  const clearLeadFilter = useCallback(() => {
    setLeadContactInfo(null)
    const p = new URLSearchParams(searchParams.toString())
    p.delete('contact')
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [pathname, router, searchParams])

  useEffect(() => {
    const id = contactFromUrl.trim()
    if (!id || Number.isNaN(Number(id))) {
      setLeadContactInfo(null)
      return
    }
    let cancelled = false
    setLeadContactLoading(true)
    setLeadContactInfo(null)
    void (async () => {
      try {
        const session = await getCurrentSession()
        if (!session?.access_token) {
          if (!cancelled) setLeadContactInfo(null)
          return
        }
        const res = await fetch(`/api/admin/contacts/${id}/name`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok || !json?.contact) {
          setLeadContactInfo(null)
          return
        }
        const c = json.contact as { name: string | null; email: string | null; company: string | null }
        setLeadContactInfo({
          name: c.name,
          email: c.email,
          company: c.company,
        })
      } finally {
        if (!cancelled) setLeadContactLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [contactFromUrl])

  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    if (contactFromUrl && !Number.isNaN(Number(contactFromUrl))) {
      p.set('contact', contactFromUrl)
    }
    if (qDebounced) p.set('q', qDebounced)
    if (statusFilter !== 'all') p.set('status', statusFilter)
    if (kindFilter.trim()) p.set('kind', kindFilter.trim())
    if (transportFilter !== 'all') p.set('transport', transportFilter)
    p.set('limit', '75')
    return p.toString()
  }, [contactFromUrl, qDebounced, statusFilter, kindFilter, transportFilter])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) {
        throw new Error('Your session has expired. Please sign in again.')
      }
      const res = await fetch(`/api/admin/email-messages?${queryString}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'Failed to load messages')
      }
      setItems(json.items ?? [])
      setTotal(typeof json.total === 'number' ? json.total : 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [queryString])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Email Center' },
          ]}
        />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 flex items-center justify-center">
              <Inbox size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold gradient-text">Email Center</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                One place to see what was sent, how it went out, and where the source row lives.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/admin/email-preview"
              className="text-sm text-violet-400 hover:text-violet-300 underline"
            >
              Email Preview
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-silicon-slate hover:bg-silicon-slate/50 text-sm"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {contactFromUrl && !Number.isNaN(Number(contactFromUrl)) && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Lead filter (from your link):</span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-950/30 px-2.5 py-1 text-sm text-teal-100 max-w-full min-w-0">
                <Link
                  href={`/admin/contacts/${contactFromUrl}`}
                  className="text-teal-300 hover:underline truncate min-w-0"
                  title={
                    leadContactInfo
                      ? [leadContactInfo.name, leadContactInfo.email, `ID ${contactFromUrl}`]
                          .filter(Boolean)
                          .join(' · ')
                      : `Open contact #${contactFromUrl}`
                  }
                >
                  {leadContactLoading
                    ? 'Loading…'
                    : leadContactInfo
                      ? contactLabelFromRow(leadContactInfo, contactFromUrl)
                      : `Contact #${contactFromUrl}`}
                </Link>
                <button
                  type="button"
                  onClick={clearLeadFilter}
                  className="rounded p-0.5 text-teal-200/80 hover:bg-teal-500/20 hover:text-white shrink-0"
                  title="Show all contacts"
                  aria-label="Clear lead filter and show all contacts"
                >
                  <X size={14} />
                </button>
              </span>
            </div>
          )}

          <div className="flex flex-col gap-3 w-full min-w-0">
            <div className="relative w-full max-w-2xl min-w-0">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                aria-hidden
              />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by subject, recipient, kind, source, or lead name / email…"
                className="w-full min-w-0 rounded-lg border border-silicon-slate bg-silicon-slate/40 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-radiant-gold/30"
                aria-label="Search email messages"
                autoComplete="off"
              />
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Status
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg bg-silicon-slate/40 border border-silicon-slate px-3 py-2 text-sm text-foreground min-w-[140px]"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s === 'all' ? 'All statuses' : s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Kind (email_kind)
                <input
                  value={kindFilter}
                  onChange={(e) => setKindFilter(e.target.value)}
                  placeholder="e.g. cold_outreach"
                  className="rounded-lg bg-silicon-slate/40 border border-silicon-slate px-3 py-2 text-sm text-foreground w-44"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Transport
                <select
                  value={transportFilter}
                  onChange={(e) => setTransportFilter(e.target.value)}
                  className="rounded-lg bg-silicon-slate/40 border border-silicon-slate px-3 py-2 text-sm text-foreground min-w-[160px]"
                >
                  {TRANSPORT_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t === 'all' ? 'All transports' : t}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void load()}
                className="px-4 py-2 rounded-lg btn-gold text-imperial-navy text-sm font-medium"
              >
                Apply filters
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Showing {items.length} of {total} rows (most recent first).
        </div>

        <div className="overflow-x-auto rounded-xl border border-silicon-slate bg-silicon-slate/20">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-silicon-slate">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Transport</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">To / Subject</th>
                <th className="px-4 py-3">Preview</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No rows match the current filters. Outreach drafts, transactional sends, and historical
                    emails all flow into <code className="text-xs">email_messages</code>; try clearing the
                    status / kind / transport filters above.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="border-b border-silicon-slate/60 hover:bg-silicon-slate/30">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {row.sent_at
                        ? new Date(row.sent_at).toLocaleString()
                        : new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-violet-300">{row.email_kind}</span>
                      <div className="text-[10px] text-muted-foreground">{row.channel}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded px-2 py-0.5 text-xs bg-silicon-slate border border-silicon-slate">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-cyan-300/90">{row.transport}</td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-mono text-muted-foreground">{row.source_system}</div>
                      {row.source_id && (
                        <div className="font-mono text-[10px] truncate max-w-[140px]" title={row.source_id}>
                          {row.source_id}
                        </div>
                      )}
                      {row.external_id && (
                        <div
                          className="font-mono text-[10px] truncate max-w-[140px] text-amber-300/80"
                          title={row.external_id}
                        >
                          ext:{row.external_id}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.contact_submission_id != null ? (
                        <Link
                          href={`/admin/contacts/${row.contact_submission_id}`}
                          className="inline-flex items-center gap-1 text-teal-400 hover:text-teal-300"
                        >
                          #{row.contact_submission_id}
                          <ExternalLink size={12} />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <div className="text-xs text-muted-foreground truncate" title={row.recipient_email ?? ''}>
                        {row.recipient_email ?? '—'}
                      </div>
                      <div className="text-foreground truncate" title={row.subject ?? ''}>
                        {row.subject ?? '(no subject)'}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[280px] text-xs text-muted-foreground truncate" title={row.body_preview}>
                      {row.body_preview}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
