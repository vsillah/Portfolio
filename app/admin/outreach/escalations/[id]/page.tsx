'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, User, Mail, MessageSquare, AlertTriangle } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'

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
  const id = params?.id as string
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
      <div className="min-h-screen bg-background p-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={32} className="animate-spin text-platinum-white/80" />
        </div>
      </div>
    )
  }

  if (!escalation) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-platinum-white/80">Escalation not found.</p>
          <Link href="/admin/outreach?tab=escalations" className="mt-4 inline-flex items-center gap-2 text-radiant-gold hover:text-amber-400">
            <ArrowLeft size={16} /> Back to Escalations
          </Link>
        </div>
      </div>
    )
  }

  const linkedLead = escalation.contact_submissions

  return (
    <div className="min-h-screen bg-background p-6">
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
            href="/admin/outreach?tab=escalations"
            className="inline-flex items-center gap-2 text-platinum-white/80 hover:text-foreground transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Escalations
          </Link>
        </div>

        <div className="mt-8 space-y-6">
          <div className="p-4 rounded-lg border border-silicon-slate bg-silicon-slate/30">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <AlertTriangle size={22} className="text-orange-400" />
              Chat escalation
            </h1>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-platinum-white/80">
                <User size={14} />
                <span>{escalation.visitor_name || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-platinum-white/80">
                <Mail size={14} />
                <span>{escalation.visitor_email || '—'}</span>
              </div>
              <div>
                <span className="text-platinum-white/60">Source:</span>{' '}
                <span className="capitalize">{escalation.source}</span>
              </div>
              <div>
                <span className="text-platinum-white/60">Reason:</span>{' '}
                <span>{escalation.reason ?? '—'}</span>
              </div>
              <div>
                <span className="text-platinum-white/60">Date:</span>{' '}
                {new Date(escalation.escalated_at).toLocaleString()}
              </div>
              <div>
                <span className="text-platinum-white/60">Session:</span>{' '}
                <Link href={`/admin/chat-eval/${escalation.session_id}`} className="text-purple-400 hover:text-purple-300 text-xs">
                  {escalation.session_id}
                </Link>
              </div>
              {escalation.slack_sent_at && (
                <div className="text-platinum-white/60 text-xs">
                  Slack notified {new Date(escalation.slack_sent_at).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 rounded-lg border border-silicon-slate bg-silicon-slate/30">
            <h2 className="text-sm font-medium text-platinum-white/80 uppercase tracking-wide mb-2">Link to lead</h2>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={linkSelect}
                onChange={(e) => setLinkSelect(e.target.value)}
                className="bg-silicon-slate border border-silicon-slate rounded-lg px-3 py-2 text-foreground min-w-[200px]"
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
                className="px-4 py-2 bg-radiant-gold text-imperial-navy rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {linkedLead && (
                <Link
                  href={`/admin/outreach?tab=leads&id=${escalation.contact_submission_id}`}
                  className="text-sm text-purple-400 hover:text-purple-300"
                >
                  View lead →
                </Link>
              )}
            </div>
            {saveError && <p className="mt-2 text-sm text-red-400">{saveError}</p>}
          </div>

          <div className="p-4 rounded-lg border border-silicon-slate bg-silicon-slate/30">
            <h2 className="text-sm font-medium text-platinum-white/80 uppercase tracking-wide mb-2 flex items-center gap-2">
              <MessageSquare size={14} />
              Transcript
            </h2>
            <pre className="text-sm text-platinum-white/90 whitespace-pre-wrap font-sans max-h-[400px] overflow-y-auto p-3 rounded bg-imperial-navy/50 border border-silicon-slate">
              {escalation.transcript || '(No transcript)'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
