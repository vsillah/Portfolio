'use client'

import { Fragment, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Video,
  Loader2,
  RefreshCw,
  Link2,
  ChevronDown,
  Calendar,
  User,
  Building,
  FileText,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'

interface MeetingRow {
  id: string
  meeting_type: string | null
  meeting_date: string | null
  duration_minutes: number | null
  contact_submission_id: number | null
  client_project_id: string | null
  transcript_preview: string | null
  transcript_length: number
  summary: string | null
  lead_name: string | null
  lead_email: string | null
  project_name: string | null
  client_name: string | null
  created_at: string
}

interface LeadOption {
  id: number
  name: string
  email: string | null
}

export default function AdminMeetingsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <MeetingsContent />
    </ProtectedRoute>
  )
}

function MeetingsContent() {
  const [meetings, setMeetings] = useState<MeetingRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [unlinkedOnly, setUnlinkedOnly] = useState(true)
  const [search, setSearch] = useState('')
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([])
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [assignValue, setAssignValue] = useState('')
  const [assigningInProgress, setAssigningInProgress] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const getHeaders = useCallback(async () => {
    const session = await getCurrentSession()
    return { Authorization: `Bearer ${session?.access_token ?? ''}` }
  }, [])

  const fetchMeetings = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (unlinkedOnly) params.set('unlinked_only', 'true')
      if (search.trim()) params.set('q', search.trim())
      params.set('limit', '50')
      const headers = await getHeaders()
      const res = await fetch(`/api/admin/meetings?${params}`, { headers })
      if (res.ok) {
        const data = await res.json()
        setMeetings(data.meetings ?? [])
        setTotal(data.total ?? 0)
      }
    } catch (err) {
      console.error('Failed to fetch meetings:', err)
    } finally {
      setLoading(false)
    }
  }, [getHeaders, unlinkedOnly, search])

  const fetchLeadOptions = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const res = await fetch('/api/admin/contact-submissions?limit=200', { headers })
      if (res.ok) {
        const data = await res.json()
        setLeadOptions((data.submissions || []).map((s: { id: number; name: string; email: string | null }) => ({
          id: s.id,
          name: s.name,
          email: s.email,
        })))
      }
    } catch {
      setLeadOptions([])
    }
  }, [getHeaders])

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  const handleAssignLead = async () => {
    if (!assigningId || !assignValue) return
    setAssigningInProgress(true)
    try {
      const headers = await getHeaders()
      const csId = assignValue === 'null' ? null : Number(assignValue)
      const res = await fetch(`/api/meetings/${assigningId}/assign-lead`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ contact_submission_id: csId }),
      })
      if (res.ok) {
        setAssigningId(null)
        setAssignValue('')
        await fetchMeetings()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to assign lead')
      }
    } catch (err) {
      console.error('Failed to assign lead:', err)
      alert('Something went wrong. Please try again.')
    } finally {
      setAssigningInProgress(false)
    }
  }

  const openAssign = (meetingId: string) => {
    setAssigningId(meetingId)
    setAssignValue('')
    fetchLeadOptions()
  }

  return (
    <div id="admin-main" className="min-h-screen bg-gray-950 text-gray-100">
      <Breadcrumbs
        items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Meetings', href: '/admin/meetings' },
        ]}
      />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Video className="w-7 h-7 text-violet-400" />
              Meeting records
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Attribute transcripts to a lead so they show up in the sales conversation. Link a meeting to a contact using <strong>Assign lead</strong>.
            </p>
          </div>
          <button
            onClick={() => fetchMeetings()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-600 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={unlinkedOnly}
              onChange={(e) => setUnlinkedOnly(e.target.checked)}
              className="rounded border-gray-600 bg-gray-800 text-violet-500"
            />
            Unlinked only
          </label>
          <input
            type="text"
            placeholder="Search type or transcript…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchMeetings()}
            className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 w-64"
          />
          <button
            onClick={() => fetchMeetings()}
            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm"
          >
            Search
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          </div>
        ) : meetings.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-12 text-center text-gray-500">
            <Video className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No meetings found</p>
            <p className="text-sm mt-1">
              {unlinkedOnly
                ? 'No unlinked meeting records. Clear "Unlinked only" to see all.'
                : 'Meeting records appear here when created by your ingest (e.g. Calendly, n8n).'}
            </p>
            <p className="text-xs mt-3 text-gray-600">
              After linking a meeting to a lead (e.g. Neil Rhein), it will show in that lead’s sales conversation under &quot;Previous meetings & tasks&quot;.
            </p>
          </div>
        ) : (
          <div className="border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900/80 text-gray-400 text-left">
                    <th className="px-4 py-3 font-medium">Date / Type</th>
                    <th className="px-4 py-3 font-medium">Transcript</th>
                    <th className="px-4 py-3 font-medium">Attributed to</th>
                    <th className="px-4 py-3 font-medium w-40">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {meetings.map((m) => (
                    <Fragment key={m.id}>
                      <tr className="hover:bg-gray-900/30">
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-2 text-gray-300">
                            <Calendar size={14} className="text-gray-500 shrink-0" />
                            {m.meeting_date
                              ? new Date(m.meeting_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : '—'}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 capitalize">
                            {(m.meeting_type ?? 'meeting').replace(/_/g, ' ')}
                            {m.duration_minutes != null && m.duration_minutes > 0 && ` · ${m.duration_minutes} min`}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top max-w-md">
                          {m.summary && (
                            <p className="text-gray-400 text-xs mb-1 line-clamp-2">{m.summary}</p>
                          )}
                          {m.transcript_preview ? (
                            <button
                              type="button"
                              onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                              className="text-left text-gray-500 text-xs block hover:text-gray-400"
                            >
                              {expandedId === m.id ? m.transcript_preview : m.transcript_preview}
                              {m.transcript_length > 200 && (
                                <span className="text-violet-400 ml-1">
                                  {expandedId === m.id ? ' (collapse)' : '… (expand)'}
                                </span>
                              )}
                            </button>
                          ) : (
                            <span className="text-gray-600 text-xs">No transcript</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {m.contact_submission_id ? (
                            <div className="flex items-center gap-1.5 text-violet-400">
                              <Link2 size={12} />
                              <span>{m.lead_name ?? 'Lead'}</span>
                              {m.lead_email && (
                                <span className="text-gray-500 text-xs">({m.lead_email})</span>
                              )}
                            </div>
                          ) : m.client_project_id ? (
                            <div className="flex items-center gap-1.5 text-gray-400">
                              <Building size={12} />
                              {m.client_name || m.project_name || 'Project'}
                            </div>
                          ) : (
                            <span className="text-amber-500/80 text-xs">Not attributed</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {assigningId === m.id ? (
                            <div className="flex flex-col gap-2">
                              <select
                                value={assignValue}
                                onChange={(e) => setAssignValue(e.target.value)}
                                className="rounded bg-gray-800 border border-gray-700 text-gray-200 text-xs py-1.5 px-2 w-full"
                                autoFocus
                              >
                                <option value="">Select lead…</option>
                                <option value="null">— Clear lead —</option>
                                {leadOptions.map((l) => (
                                  <option key={l.id} value={String(l.id)}>
                                    {l.name} {l.email ? `(${l.email})` : ''}
                                  </option>
                                ))}
                              </select>
                              <div className="flex gap-1">
                                <button
                                  onClick={handleAssignLead}
                                  disabled={!assignValue || assigningInProgress}
                                  className="flex-1 py-1 rounded text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white"
                                >
                                  {assigningInProgress ? '…' : 'Save'}
                                </button>
                                <button
                                  onClick={() => { setAssigningId(null); setAssignValue(''); }}
                                  className="py-1 px-2 rounded text-xs bg-gray-700 text-gray-300 hover:bg-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => openAssign(m.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
                            >
                              <User size={12} />
                              Assign lead
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedId === m.id && m.transcript_preview && (
                        <tr>
                          <td colSpan={4} className="px-4 py-2 bg-gray-900/50">
                            <div className="flex items-start gap-2">
                              <FileText size={14} className="text-gray-500 shrink-0 mt-0.5" />
                              <pre className="text-xs text-gray-500 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">
                                {m.transcript_preview}
                                {m.transcript_length > 200 && ` … (${m.transcript_length} chars total)`}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {total > meetings.length && (
              <div className="px-4 py-2 bg-gray-900/50 text-xs text-gray-500 border-t border-gray-800">
                Showing {meetings.length} of {total} meetings
              </div>
            )}
          </div>
        )}

        <p className="mt-4 text-xs text-gray-500">
          Linked meetings appear in the contact’s sales conversation (
          <Link href="/admin/sales" className="text-violet-400 hover:text-violet-300">
            Sales Dashboard
          </Link>
          ) under &quot;Previous meetings & tasks&quot;. You can also assign from{' '}
          <Link href="/admin/meeting-tasks" className="text-violet-400 hover:text-violet-300">
            Meeting Tasks
          </Link>{' '}
          when a meeting has action items.
        </p>
      </div>
    </div>
  )
}
