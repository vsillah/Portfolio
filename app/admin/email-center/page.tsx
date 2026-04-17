'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Inbox, RefreshCw, ExternalLink, Info } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'

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

export default function EmailCenterPage() {
  return (
    <ProtectedRoute requireAdmin>
      <EmailCenterContent />
    </ProtectedRoute>
  )
}

function EmailCenterContent() {
  const searchParams = useSearchParams()
  const initialContact = searchParams.get('contact') ?? ''

  const [items, setItems] = useState<EmailMessageRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contactFilter, setContactFilter] = useState(initialContact)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [kindFilter, setKindFilter] = useState('')
  const [transportFilter, setTransportFilter] = useState<string>('all')

  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    if (contactFilter.trim()) p.set('contact', contactFilter.trim())
    if (statusFilter !== 'all') p.set('status', statusFilter)
    if (kindFilter.trim()) p.set('kind', kindFilter.trim())
    if (transportFilter !== 'all') p.set('transport', transportFilter)
    p.set('limit', '75')
    return p.toString()
  }, [contactFilter, statusFilter, kindFilter, transportFilter])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/email-messages?${queryString}`)
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

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-amber-500/25 bg-amber-950/20 p-4 flex gap-3 text-sm text-amber-100/90"
        >
          <Info className="shrink-0 mt-0.5 text-amber-400" size={18} />
          <div className="space-y-1">
            <p>
              <strong>Storage map:</strong>{' '}
              <code className="text-xs bg-black/30 px-1 rounded">email_messages</code> is the index you are
              viewing. Lead outreach lifecycle still lives in{' '}
              <code className="text-xs bg-black/30 px-1 rounded">outreach_queue</code>; asset sends in{' '}
              <code className="text-xs bg-black/30 px-1 rounded">contact_deliveries</code>; full message bodies
              and timeline events in{' '}
              <code className="text-xs bg-black/30 px-1 rounded">contact_communications</code> when a lead is
              linked.
            </p>
            <p className="text-amber-200/70">
              New sends log here automatically. Historical rows were backfilled from the communications timeline.
            </p>
          </div>
        </motion.div>

        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Contact ID
            <input
              value={contactFilter}
              onChange={(e) => setContactFilter(e.target.value)}
              placeholder="e.g. 123 (optional)"
              className="rounded-lg bg-silicon-slate/40 border border-silicon-slate px-3 py-2 text-sm text-foreground w-40"
            />
          </label>
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
                    No rows yet. After you apply the database migration, new sends appear here; historical email
                    timeline rows are backfilled from <code className="text-xs">contact_communications</code>.
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
