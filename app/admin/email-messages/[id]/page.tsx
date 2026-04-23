'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Mail, RefreshCw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'

interface EmailMessageDetail {
  id: string
  email_kind: string
  channel: string
  contact_submission_id: number | null
  contact_communication_id: string | null
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
  context_json: Record<string, unknown>
}

interface EmailMessageResponse {
  message: EmailMessageDetail
  full_body: string | null
  full_body_source: 'contact_communications' | 'outreach_queue' | null
  contact: { id: number; name: string | null; email: string | null; company: string | null } | null
}

function contactLabel(c: EmailMessageResponse['contact']): string {
  if (!c) return ''
  return c.name?.trim() || c.email?.trim() || `Contact #${c.id}`
}

export default function EmailMessageViewerPage() {
  return (
    <ProtectedRoute requireAdmin>
      <EmailMessageViewerContent />
    </ProtectedRoute>
  )
}

function EmailMessageViewerContent() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const [data, setData] = useState<EmailMessageResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) {
        throw new Error('Your session has expired. Please sign in again.')
      }
      const res = await fetch(`/api/admin/email-messages/${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'Failed to load email')
      }
      setData(json as EmailMessageResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const msg = data?.message
  const body = data?.full_body ?? msg?.body_preview ?? ''
  const bodyIsTruncated = !data?.full_body && !!msg?.body_preview
  const contactName = contactLabel(data?.contact ?? null)

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Email Center', href: '/admin/email-center' },
            { label: msg?.subject || 'Email' },
          ]}
        />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 flex items-center justify-center shrink-0">
              <Mail size={24} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold gradient-text truncate">
                {msg?.subject || '(no subject)'}
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5 truncate">
                {msg
                  ? `${msg.email_kind} · ${msg.direction} · ${msg.status}`
                  : 'Loading…'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/admin/email-center"
              className="inline-flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 underline"
            >
              <ArrowLeft size={14} />
              Email Center
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-silicon-slate hover:bg-silicon-slate/50 text-sm"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="rounded-lg border border-silicon-slate bg-silicon-slate/20 px-4 py-8 text-center text-muted-foreground">
            Loading…
          </div>
        ) : msg ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-silicon-slate bg-silicon-slate/20 p-4 text-sm">
              <MetaRow label="To">
                <span className="text-foreground">{msg.recipient_email || '—'}</span>
              </MetaRow>
              <MetaRow label="When">
                <span className="text-foreground">
                  {msg.sent_at
                    ? new Date(msg.sent_at).toLocaleString()
                    : new Date(msg.created_at).toLocaleString()}
                </span>
              </MetaRow>
              <MetaRow label="Contact">
                {msg.contact_submission_id != null ? (
                  <Link
                    href={`/admin/contacts/${msg.contact_submission_id}`}
                    className="inline-flex items-center gap-1 text-teal-400 hover:text-teal-300"
                  >
                    {contactName || `#${msg.contact_submission_id}`}
                    <ExternalLink size={12} />
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </MetaRow>
              <MetaRow label="Transport">
                <span className="text-cyan-300/90">{msg.transport}</span>
              </MetaRow>
              <MetaRow label="Source">
                <span className="font-mono text-xs text-muted-foreground">
                  {msg.source_system}
                  {msg.source_id ? ` · ${msg.source_id}` : ''}
                </span>
              </MetaRow>
              <MetaRow label="External ID">
                <span className="font-mono text-xs text-amber-300/80 break-all">
                  {msg.external_id || '—'}
                </span>
              </MetaRow>
            </div>

            <div className="rounded-xl border border-silicon-slate bg-white text-gray-900 shadow-sm">
              <div className="border-b border-gray-200 px-6 py-3 text-xs text-gray-500">
                Preview rendered from{' '}
                {data?.full_body_source
                  ? data.full_body_source === 'contact_communications'
                    ? 'contact_communications.body'
                    : 'outreach_queue.body'
                  : 'body_preview (first 500 chars — full body not found)'}
              </div>
              <div className="px-6 py-6">
                {body ? (
                  <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-a:text-blue-600">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">(empty body)</p>
                )}
                {bodyIsTruncated && (
                  <p className="mt-4 text-xs italic text-amber-700">
                    Showing body_preview only; the linked source row was not found.
                  </p>
                )}
              </div>
            </div>

            {(hasKeys(msg.metadata) || hasKeys(msg.context_json)) && (
              <details className="rounded-xl border border-silicon-slate bg-silicon-slate/20 p-4 text-sm">
                <summary className="cursor-pointer text-muted-foreground">Raw metadata</summary>
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {hasKeys(msg.metadata) && (
                    <JsonBlock title="metadata" value={msg.metadata} />
                  )}
                  {hasKeys(msg.context_json) && (
                    <JsonBlock title="context_json" value={msg.context_json} />
                  )}
                </div>
              </details>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="min-w-0 break-words">{children}</div>
    </div>
  )
}

function JsonBlock({ title, value }: { title: string; value: Record<string, unknown> }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{title}</div>
      <pre className="text-xs bg-black/40 text-gray-100 rounded-lg p-3 overflow-auto max-h-80">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

function hasKeys(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length > 0
}
