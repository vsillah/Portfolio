'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, RefreshCw, Calendar, Clock, Video,
  CheckSquare, Lightbulb, AlertTriangle, MessageSquare,
  ChevronDown, ChevronUp, Users, ExternalLink, ListChecks,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import { getBackUrl, buildLinkWithReturn } from '@/lib/admin-return-context'

interface MeetingTaskRow {
  id: string
  title: string
  description: string | null
  status: 'pending' | 'in_progress' | 'complete' | 'cancelled'
  task_category: 'internal' | 'outreach'
  owner: string | null
  due_date: string | null
  contact_submission_id: number | null
  outreach_queue_id: string | null
  lead?: { name?: string | null; email?: string | null } | null
}

interface MeetingDetail {
  id: string
  title: string
  meeting_type: string
  meeting_date: string
  duration_minutes: number | null
  start_time_ms: number
  summary: string | null
  transcript: string | null
  action_items: Array<{ text: string }> | null
  key_decisions: string[]
  open_questions: string[]
  risks_identified: string[]
  attendees: Array<{ name?: string; email?: string }>
  recording_url: string | null
  contact_submission_id: number | null
  client_project_id: string | null
  structured_notes: Record<string, unknown> | null
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function meetingTypeLabel(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string
  icon: typeof CheckSquare
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-200">
          <Icon size={16} className="text-gray-400" />
          {title}
        </span>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>
      {open && <div className="px-5 pb-5 pt-0">{children}</div>}
    </div>
  )
}

function MeetingDetailContent() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const backUrl = getBackUrl(searchParams, '/admin/meetings')

  const [meeting, setMeeting] = useState<MeetingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<MeetingTaskRow[]>([])
  const [tasksLoading, setTasksLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) { setTasksLoading(false); return }
      const res = await fetch(
        `/api/meeting-action-tasks?meeting_record_id=${encodeURIComponent(id)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      )
      if (res.ok) {
        const data = await res.json()
        setTasks(Array.isArray(data.tasks) ? data.tasks : [])
      }
    } catch {
      // Silent — tasks section will simply show empty state.
    } finally {
      setTasksLoading(false)
    }
  }, [id])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const fetchMeeting = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) { setError('Not authenticated'); return }
      const res = await fetch(`/api/admin/meetings/${id}?detail=true`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Failed to load meeting')
        return
      }
      const data = await res.json()
      setMeeting(data.meeting)
    } catch {
      setError('Failed to load meeting')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchMeeting() }, [fetchMeeting])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    )
  }

  if (error || !meeting) {
    return (
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-red-400 mb-4">{error || 'Meeting not found'}</p>
          <Link href={backUrl} className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300">
            <ArrowLeft size={16} /> Back
          </Link>
        </div>
      </div>
    )
  }

  const hasNotes = meeting.structured_notes && Object.keys(meeting.structured_notes).length > 0
  const notesSections = hasNotes
    ? Object.entries(meeting.structured_notes!).filter(
        ([k, v]) => !['summary', 'highlights', 'action_items'].includes(k) && v != null && v !== ''
      )
    : []

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Meetings', href: '/admin/meetings' },
            { label: meetingTypeLabel(meeting.meeting_type) },
          ]}
        />

        <div className="mt-6 flex items-center justify-between">
          <Link
            href={backUrl}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={18} />
            Back
          </Link>
          {meeting.recording_url && (
            <a
              href={meeting.recording_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-violet-300 border border-gray-700"
            >
              <Video size={14} /> Recording <ExternalLink size={12} />
            </a>
          )}
        </div>

        {/* Header card */}
        <div className="mt-6 bg-gray-900 rounded-lg border border-gray-800 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-violet-900/50 text-violet-300 border border-violet-800 mb-3">
                {meetingTypeLabel(meeting.meeting_type)}
              </span>
              <h1 className="text-xl font-semibold text-white">{meeting.title}</h1>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1.5">
              <Calendar size={14} />
              {formatDate(meeting.meeting_date)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} />
              {formatTime(meeting.meeting_date)}
            </span>
            {meeting.duration_minutes != null && (
              <span className="flex items-center gap-1.5">
                <Clock size={14} />
                {meeting.duration_minutes} min
              </span>
            )}
            {meeting.attendees.length > 0 && (
              <span className="flex items-center gap-1.5">
                <Users size={14} />
                {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Context links */}
          <div className="mt-4 flex flex-wrap gap-3">
            {meeting.contact_submission_id != null && (
              <Link
                href={buildLinkWithReturn(
                  `/admin/outreach?tab=leads&id=${meeting.contact_submission_id}`,
                  `/admin/meetings/${meeting.id}`
                )}
                className="inline-flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300"
              >
                <Users size={14} /> View lead
              </Link>
            )}
            {meeting.client_project_id && (
              <Link
                href={`/admin/client-projects/${meeting.client_project_id}`}
                className="inline-flex items-center gap-1.5 text-sm text-teal-400 hover:text-teal-300"
              >
                <ExternalLink size={14} /> Client project
              </Link>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {/* Summary */}
          {meeting.summary && (
            <Section title="Summary" icon={MessageSquare}>
              <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                {meeting.summary}
              </p>
            </Section>
          )}

          {/* Action Items (raw extract from transcript) */}
          {meeting.action_items && meeting.action_items.length > 0 && (
            <Section title={`Action Items (${meeting.action_items.length})`} icon={CheckSquare}>
              <ul className="space-y-2">
                {meeting.action_items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <CheckSquare size={14} className="mt-0.5 text-emerald-500 shrink-0" />
                    {item.text}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Tasks (promoted into meeting_action_tasks for tracking + attribution) */}
          {(tasksLoading || tasks.length > 0) && (
            <Section
              title={`Tasks${tasks.length > 0 ? ` (${tasks.length})` : ''}`}
              icon={ListChecks}
            >
              {tasksLoading ? (
                <p className="text-sm text-gray-500">Loading tasks...</p>
              ) : (
                <div className="space-y-2">
                  <ul className="space-y-2">
                    {tasks.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-start justify-between gap-3 rounded border border-gray-800 bg-gray-950 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-gray-200 truncate">{t.title}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide ${
                              t.status === 'complete'
                                ? 'bg-emerald-900/40 text-emerald-300'
                                : t.status === 'cancelled'
                                ? 'bg-gray-800 text-gray-500'
                                : t.status === 'in_progress'
                                ? 'bg-blue-900/40 text-blue-300'
                                : 'bg-amber-900/40 text-amber-300'
                            }`}>
                              {t.status.replace('_', ' ')}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide ${
                              t.task_category === 'outreach'
                                ? 'bg-violet-900/40 text-violet-300'
                                : 'bg-gray-800 text-gray-400'
                            }`}>
                              {t.task_category}
                            </span>
                          </div>
                          {(t.owner || t.lead?.name || t.lead?.email) && (
                            <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-x-3">
                              {t.owner && <span>Owner: <span className="text-gray-400">{t.owner}</span></span>}
                              {(t.lead?.name || t.lead?.email) && (
                                <span>
                                  Attributed to:{' '}
                                  <span className="text-gray-400">{t.lead?.name || t.lead?.email}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-1">
                    <Link
                      href={buildLinkWithReturn(
                        `/admin/meeting-tasks?meeting_record_id=${id}`,
                        `/admin/meetings/${id}`
                      )}
                      className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
                    >
                      <ListChecks size={12} aria-hidden />
                      Manage tasks (edit, attribute, send to outreach)
                    </Link>
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Key Decisions */}
          {meeting.key_decisions.length > 0 && (
            <Section title={`Key Decisions (${meeting.key_decisions.length})`} icon={Lightbulb}>
              <ul className="space-y-2">
                {meeting.key_decisions.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <Lightbulb size={14} className="mt-0.5 text-amber-400 shrink-0" />
                    {d}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Open Questions */}
          {meeting.open_questions.length > 0 && (
            <Section title={`Open Questions (${meeting.open_questions.length})`} icon={MessageSquare}>
              <ul className="space-y-2">
                {meeting.open_questions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <MessageSquare size={14} className="mt-0.5 text-blue-400 shrink-0" />
                    {q}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Risks */}
          {meeting.risks_identified.length > 0 && (
            <Section title={`Risks (${meeting.risks_identified.length})`} icon={AlertTriangle}>
              <ul className="space-y-2">
                {meeting.risks_identified.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <AlertTriangle size={14} className="mt-0.5 text-orange-400 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Additional structured notes sections */}
          {notesSections.length > 0 && (
            <Section title="Additional Notes" icon={MessageSquare} defaultOpen={false}>
              <div className="space-y-3">
                {notesSections.map(([key, value]) => (
                  <div key={key}>
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      {key.replace(/_/g, ' ')}
                    </h4>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">
                      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Attendees */}
          {meeting.attendees.length > 0 && (
            <Section title={`Attendees (${meeting.attendees.length})`} icon={Users} defaultOpen={false}>
              <ul className="space-y-1">
                {meeting.attendees.map((a, i) => (
                  <li key={i} className="text-sm text-gray-300">
                    {(a as { name?: string }).name || (a as { email?: string }).email || `Attendee ${i + 1}`}
                    {(a as { email?: string }).email && (a as { name?: string }).name && (
                      <span className="text-gray-500 ml-2">({(a as { email?: string }).email})</span>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Transcript */}
          {meeting.transcript && (
            <Section title="Transcript" icon={MessageSquare} defaultOpen={false}>
              <pre className="text-sm text-gray-400 whitespace-pre-wrap font-sans max-h-[500px] overflow-y-auto p-4 rounded bg-gray-950 border border-gray-800">
                {meeting.transcript}
              </pre>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MeetingDetailPage() {
  return (
    <ProtectedRoute requireAdmin>
      <MeetingDetailContent />
    </ProtectedRoute>
  )
}
