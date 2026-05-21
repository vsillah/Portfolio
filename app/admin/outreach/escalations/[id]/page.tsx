'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, User, Mail, MessageSquare, AlertTriangle } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import { getBackUrl } from '@/lib/admin-return-context'

interface EscalationDetail {
  id: number
  session_id: string
  escalated_at: string
  source: string
  reason: string | null
  visitor_name: string | null
  visitor_email: string | null
  transcript: string | null
  contact_submission_id: number | null
  slack_sent_at: string | null
  created_at: string
  updated_at: string
  contact_submissions: { name: string | null; email: string | null } | null
}

interface LeadOption {
  id: number
  name: string
  email: string
}

export default function EscalationDetailPage() {
  return (
    <ProtectedRoute requireAdmin>
      <EscalationDetailContent />
    </ProtectedRoute>
  )
}

function EscalationDetailContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params?.id as string
  const backUrl = getBackUrl(searchParams, '/admin/outreach?tab=escalations')
  const [escalation, setEscalation] = useState<EscalationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [linkSelect, setLinkSelect] = useState<string>(() => '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const fetchEscalation = async () => {
      const session = await getCurrentSession()
      if (!session?.access_token) return
      try {
        const res = await fetch(`/api/admin/chat-escalations/${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setEscalation(data)
          setLinkSelect(data.contact_submission_id != null ? String(data.contact_submission_id) : '')
        } else if (res.status === 404) {
          setEscalation(null)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchEscalation()
  }, [id])

  useEffect(() => {
    const fetchLeads = async () => {
      setLeadsLoading(true)
      const session = await getCurrentSession()
      if (!session?.access_token) return
      try {
        const res = await fetch('/api/admin/outreach/leads?limit=200&offset=0', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setLeads(data.leads?.map((l: { id: number; name: string; email: string }) => ({ id: l.id, name: l.name, email: l.email })) ?? [])
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLeadsLoading(false)
      }
    }
    fetchLeads()
  }, [])

  const handleSaveLink = async () => {
    if (!id || saving) return
    const session = await getCurrentSession()
    if (!session?.access_token) return
    setSaving(true)
    setSaveError(null)
    try {
      const contactSubmissionId = linkSelect === '' ? null : parseInt(linkSelect, 10)
      const res = await fetch(`/api/admin/chat-escalations/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ contact_submission_id: contactSubmissionId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSaveError(data.error || 'Failed to update')
        return
      }
      setEscalation((prev) => (prev ? { ...prev, contact_submission_id: data.contact_submission_id, contact_submissions: data.contact_submissions } : null))
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="admin-console-page min-h-screen p-6 text-foreground">
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={32} className="animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!escalation) {
    return (
      <div className="admin-console-page min-h-screen p-6 text-foreground">
        <div className="max-w-4xl mx-auto">
          <div className="admin-console-card rounded-lg border p-6">
            <p className="text-muted-foreground">Escalation not found.</p>
          <Link href={backUrl} className="admin-console-button-secondary mt-4 inline-flex">
            <ArrowLeft size={16} /> Back
          </Link>
          </div>
        </div>
      </div>
    )
  }

  const linkedLead = escalation.contact_submissions

  return (
    <div className="admin-console-page min-h-screen px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Lead Pipeline', href: '/admin/outreach' },
            { label: 'Escalations', href: '/admin/outreach?tab=escalations' },
            { label: `Escalation #${escalation.id}`, href: '#' },
          ]}
        />

        <div className="mt-6 flex items-center justify-between">
          <Link
            href={backUrl}
            className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={18} />
            Back
          </Link>
        </div>

        <div className="mt-8 space-y-6">
          <div className="admin-console-surface-header rounded-xl border p-5 sm:p-6">
            <div className="admin-console-eyebrow mb-2 flex items-center gap-2">
              <AlertTriangle size={16} className="text-radiant-gold" />
              Outreach Escalation
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Chat escalation #{escalation.id}</h1>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User size={14} />
                <span>{escalation.visitor_name || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail size={14} />
                <span>{escalation.visitor_email || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Source:</span>{' '}
                <span className="capitalize">{escalation.source}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Reason:</span>{' '}
                <span>{escalation.reason ?? '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Date:</span>{' '}
                {new Date(escalation.escalated_at).toLocaleString()}
              </div>
              <div>
                <span className="text-muted-foreground">Session:</span>{' '}
                <Link href={`/admin/chat-eval/${escalation.session_id}`} className="text-radiant-gold hover:text-amber-300 text-xs">
                  {escalation.session_id}
                </Link>
              </div>
              {escalation.slack_sent_at && (
                <div className="text-muted-foreground text-xs">
                  Slack notified {new Date(escalation.slack_sent_at).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          <div className="admin-console-card rounded-lg border p-4">
            <h2 className="admin-console-eyebrow mb-2">Link to lead</h2>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={linkSelect}
                onChange={(e) => setLinkSelect(e.target.value)}
                className="min-w-[200px] rounded-lg border border-white/10 bg-silicon-slate/50 px-3 py-2 text-foreground"
                disabled={leadsLoading}
              >
                <option value="">Not linked</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name || l.email} ({l.email})
                  </option>
                ))}
              </select>
              <button
                onClick={handleSaveLink}
                disabled={saving || (linkSelect === '' ? escalation.contact_submission_id === null : String(escalation.contact_submission_id) === linkSelect)}
                className="admin-console-button-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {linkedLead && (
                <Link
                  href={`/admin/outreach?tab=leads&id=${escalation.contact_submission_id}`}
                  className="text-sm text-radiant-gold hover:text-amber-300"
                >
                  View lead →
                </Link>
              )}
            </div>
            {saveError && <p className="mt-2 text-sm text-red-400">{saveError}</p>}
          </div>

          <div className="admin-console-card rounded-lg border p-4">
            <h2 className="admin-console-eyebrow mb-2 flex items-center gap-2">
              <MessageSquare size={14} />
              Transcript
            </h2>
            <pre className="max-h-[400px] overflow-y-auto whitespace-pre-wrap rounded border border-white/10 bg-background/50 p-3 font-sans text-sm text-foreground/90">
              {escalation.transcript || '(No transcript)'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
