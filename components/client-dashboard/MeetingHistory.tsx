'use client'

import { useState, useEffect } from 'react'
import {
  Video,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  MessageSquare,
  HelpCircle,
  ExternalLink,
  Loader2,
} from 'lucide-react'

interface Meeting {
  id: string
  meeting_type: string
  meeting_date: string
  duration_minutes: number | null
  structured_notes: Record<string, unknown> | null
  key_decisions: string[] | null
  action_items: Array<{ task: string; owner?: string; status?: string }> | null
  open_questions: string[] | null
  recording_url: string | null
}

interface MeetingHistoryProps {
  token: string
}

const MEETINGS_PAGE_SIZE = 4

export default function MeetingHistory({ token }: MeetingHistoryProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    async function fetchMeetings() {
      try {
        const res = await fetch(`/api/client/dashboard/${token}/meetings`)
        if (res.ok) {
          const data = await res.json()
          setMeetings(data.meetings || [])
          setCurrentPage(1)
          setExpandedId(null)
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchMeetings()
  }, [token])

  if (loading) {
    return (
      <div className="rounded-lg border border-radiant-gold/15 bg-silicon-slate/35 p-5">
        <div className="flex items-center gap-2 text-platinum-white/55 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading meetings...
        </div>
      </div>
    )
  }

  if (meetings.length === 0) return null

  const totalPages = Math.ceil(meetings.length / MEETINGS_PAGE_SIZE)
  const hasPagination = meetings.length > MEETINGS_PAGE_SIZE
  const pageStartIndex = (currentPage - 1) * MEETINGS_PAGE_SIZE
  const pageEndIndex = Math.min(pageStartIndex + MEETINGS_PAGE_SIZE, meetings.length)
  const visibleMeetings = meetings.slice(pageStartIndex, pageEndIndex)

  const goToPage = (page: number) => {
    setCurrentPage(page)
    setExpandedId(null)
  }

  return (
    <div className="rounded-lg border border-radiant-gold/15 bg-silicon-slate/35 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium text-radiant-gold uppercase tracking-wider flex items-center gap-2">
          <Video className="w-4 h-4" />
          Meeting History
        </h3>
        {hasPagination && (
          <p className="text-xs text-platinum-white/45">
            Showing {pageStartIndex + 1} to {pageEndIndex} of {meetings.length} meetings
          </p>
        )}
      </div>

      <div className="space-y-2">
        {visibleMeetings.map((meeting) => {
          const isExpanded = expandedId === meeting.id
          const hasDetails =
            (meeting.key_decisions && meeting.key_decisions.length > 0) ||
            (meeting.action_items && meeting.action_items.length > 0) ||
            (meeting.open_questions && meeting.open_questions.length > 0) ||
            meeting.structured_notes

          return (
            <div
              key={meeting.id}
              className="border border-radiant-gold/10 rounded-lg overflow-hidden bg-imperial-navy/40"
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : meeting.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-radiant-gold/10 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-radiant-gold/10 border border-radiant-gold/20 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 text-radiant-gold" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-platinum-white capitalize">
                      {meeting.meeting_type?.replace(/_/g, ' ') || 'Meeting'}
                    </p>
                    <p className="text-xs text-platinum-white/45">
                      {new Date(meeting.meeting_date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      {meeting.duration_minutes !== null && meeting.duration_minutes > 0 && (
                        <> &middot; {meeting.duration_minutes}min</>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {meeting.recording_url && (
                    <a
                      href={meeting.recording_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-md bg-silicon-slate/60 hover:bg-radiant-gold/10 transition-colors"
                      title="View recording"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-radiant-gold/75" />
                    </a>
                  )}
                  {hasDetails && (
                    isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-radiant-gold/60" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-radiant-gold/60" />
                    )
                  )}
                </div>
              </button>

              {isExpanded && hasDetails && (
                <div className="px-3 pb-3 space-y-3 border-t border-radiant-gold/10 pt-3">
                  {meeting.key_decisions && meeting.key_decisions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-platinum-white/50 uppercase mb-1.5 flex items-center gap-1">
                        <CheckSquare className="w-3 h-3" /> Key Decisions
                      </p>
                      <ul className="space-y-1">
                        {meeting.key_decisions.map((d, i) => (
                          <li key={i} className="text-xs text-platinum-white/75 pl-3 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:rounded-full before:bg-radiant-gold/70">
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {meeting.action_items && meeting.action_items.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-platinum-white/50 uppercase mb-1.5">
                        Action Items
                      </p>
                      <ul className="space-y-1">
                        {meeting.action_items.map((item, i) => (
                          <li key={i} className="text-xs text-platinum-white/75 flex items-start gap-2">
                            <span className={`shrink-0 mt-0.5 w-3 h-3 rounded border ${
                              item.status === 'done'
                                ? 'bg-radiant-gold/30 border-radiant-gold/60'
                                : 'border-platinum-white/25'
                            }`} />
                            <span>
                              {item.task}
                              {item.owner && (
                                <span className="text-platinum-white/45 ml-1">({item.owner})</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {meeting.open_questions && meeting.open_questions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-platinum-white/50 uppercase mb-1.5 flex items-center gap-1">
                        <HelpCircle className="w-3 h-3" /> Open Questions
                      </p>
                      <ul className="space-y-1">
                        {meeting.open_questions.map((q, i) => (
                          <li key={i} className="text-xs text-platinum-white/65 pl-3 relative before:content-['?'] before:absolute before:left-0 before:text-radiant-gold/70">
                            {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {hasPagination && (
        <div className="mt-4 flex flex-col gap-3 border-t border-radiant-gold/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-platinum-white/45">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-radiant-gold/20 px-3 py-1.5 text-xs font-medium text-platinum-white/70 transition hover:border-radiant-gold/45 hover:text-radiant-gold disabled:cursor-not-allowed disabled:border-platinum-white/10 disabled:text-platinum-white/25"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => goToPage(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="rounded-md border border-radiant-gold/20 px-3 py-1.5 text-xs font-medium text-platinum-white/70 transition hover:border-radiant-gold/45 hover:text-radiant-gold disabled:cursor-not-allowed disabled:border-platinum-white/10 disabled:text-platinum-white/25"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
