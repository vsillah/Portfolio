'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  CheckCircle,
  XCircle,
  Search,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  X,
  Plus,
  Cpu,
  Loader2,
  FileText,
  CalendarCheck,
  RefreshCw,
} from 'lucide-react'
import { getCurrentSession } from '@/lib/auth'
import {
  type AdminMeetingContextItem,
  mapDbMeetingRowsToContextItems,
  mergeDbFirstWithReadAi,
  isMeetingRecordContextId,
  meetingRecordUuidFromContextId,
} from '@/lib/admin-meeting-context-items'

const READAI_CACHE_TTL_MS = 5 * 60 * 1000

type PendingExtractSuggestion = {
  field: 'pain_points' | 'quick_wins'
  content: string
}

/** Read.ai / DB meetings may use text, action, title, etc.; omit empty and literal "undefined". */
function formatMeetingActionItemsAsBullets(actionItems: unknown[] | null | undefined): string {
  if (!actionItems?.length) return ''
  const lines: string[] = []
  for (const ai of actionItems) {
    let text = ''
    if (typeof ai === 'string') text = ai.trim()
    else if (ai && typeof ai === 'object') {
      const o = ai as Record<string, unknown>
      const t = o.text ?? o.action ?? o.title ?? o.description ?? o.body
      text = typeof t === 'string' ? t.trim() : ''
    }
    if (text && text !== 'undefined') lines.push(`• ${text}`)
  }
  return lines.join('\n')
}

export interface AddLeadModalProps {
  open: boolean
  onClose: () => void
  onLeadAdded: (leadId: number) => void
  onOutreachGenerated: () => void
}

export default function AddLeadModal({ open, onClose, onLeadAdded, onOutreachGenerated }: AddLeadModalProps) {
  // Form fields
  const [addLeadName, setAddLeadName] = useState('')
  const [addLeadEmail, setAddLeadEmail] = useState('')
  const [addLeadCompany, setAddLeadCompany] = useState('')
  const [addLeadCompanyWebsite, setAddLeadCompanyWebsite] = useState('')
  const [addLeadLinkedInUrl, setAddLeadLinkedInUrl] = useState('')
  const [addLeadJobTitle, setAddLeadJobTitle] = useState('')
  const [addLeadIndustry, setAddLeadIndustry] = useState('')
  const [addLeadPhone, setAddLeadPhone] = useState('')
  const [addLeadMessage, setAddLeadMessage] = useState('')
  const [addLeadInputType, setAddLeadInputType] = useState('other')
  const [addLeadLoading, setAddLeadLoading] = useState(false)
  const [addLeadError, setAddLeadError] = useState<string | null>(null)
  const [addLeadSuccessId, setAddLeadSuccessId] = useState<number | null>(null)
  const [addLeadEmployeeCount, setAddLeadEmployeeCount] = useState('')
  const [addLeadQuickWins, setAddLeadQuickWins] = useState('')
  const [addLeadPainPoints, setAddLeadPainPoints] = useState('')
  const [showVepSection, setShowVepSection] = useState(false)
  const [addLeadOutreachToast, setAddLeadOutreachToast] = useState(false)

  // Meeting picker state
  const [addLeadMeetingId, setAddLeadMeetingId] = useState<string | null>(null)
  const [addLeadMeetings, setAddLeadMeetings] = useState<{ id: string; meeting_type: string; meeting_date: string; transcript_preview?: string; contact_name?: string | null; contact_submission_id?: number | null }[]>([])
  const [addLeadMeetingsLoading, setAddLeadMeetingsLoading] = useState(false)
  const [addLeadExtractLoading, setAddLeadExtractLoading] = useState(false)
  const [addLeadMeetingSummary, setAddLeadMeetingSummary] = useState('')
  const [addLeadMeetingPainPoints, setAddLeadMeetingPainPoints] = useState('')
  const [addLeadMeetingTab, setAddLeadMeetingTab] = useState<'select' | 'paste' | 'readai'>('select')

  // Read.ai search state
  const [addLeadReadAiEmail, setAddLeadReadAiEmail] = useState('')
  const [addLeadReadAiMeetings, setAddLeadReadAiMeetings] = useState<AdminMeetingContextItem[]>([])
  const [addLeadReadAiLoading, setAddLeadReadAiLoading] = useState(false)
  const [addLeadReadAiSearched, setAddLeadReadAiSearched] = useState(false)

  // Paste transcript state
  const [addLeadPasteText, setAddLeadPasteText] = useState('')
  const [addLeadPasteTitle, setAddLeadPasteTitle] = useState('')
  const [addLeadPasteAttendeeName, setAddLeadPasteAttendeeName] = useState('')
  const [addLeadPasteAttendeeEmail, setAddLeadPasteAttendeeEmail] = useState('')
  const [addLeadPasteSaving, setAddLeadPasteSaving] = useState(false)

  // Pending extracted suggestions for admin approval
  const [addLeadPendingExtracts, setAddLeadPendingExtracts] = useState<PendingExtractSuggestion[]>([])

  // Read.ai cache (local to this component instance)
  const readAiCacheRef = useRef<Record<string, { meetings: AdminMeetingContextItem[]; fetchedAt: number }>>({})
  const [, setReadAiCacheTick] = useState(0)

  const getReadAiCacheAge = useCallback((email: string): string | null => {
    const cached = readAiCacheRef.current[email.toLowerCase().trim()]
    if (!cached) return null
    const seconds = Math.floor((Date.now() - cached.fetchedAt) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ago`
  }, [])

  const resetAddLeadForm = () => {
    setAddLeadName('')
    setAddLeadEmail('')
    setAddLeadCompany('')
    setAddLeadCompanyWebsite('')
    setAddLeadLinkedInUrl('')
    setAddLeadJobTitle('')
    setAddLeadIndustry('')
    setAddLeadPhone('')
    setAddLeadMessage('')
    setAddLeadInputType('other')
    setAddLeadEmployeeCount('')
    setAddLeadQuickWins('')
    setAddLeadPainPoints('')
    setShowVepSection(false)
    setAddLeadError(null)
    setAddLeadMeetingId(null)
    setAddLeadMeetings([])
    setAddLeadExtractLoading(false)
    setAddLeadMeetingSummary('')
    setAddLeadMeetingPainPoints('')
    setAddLeadMeetingTab('select')
    setAddLeadPasteText('')
    setAddLeadPasteTitle('')
    setAddLeadPasteAttendeeName('')
    setAddLeadPasteAttendeeEmail('')
    setAddLeadPasteSaving(false)
    setAddLeadPendingExtracts([])
  }

  const fetchMeetingsForPicker = async () => {
    setAddLeadMeetingsLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const res = await fetch('/api/admin/meetings?unlinked_only=false&limit=50', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setAddLeadMeetings(data.meetings || [])
      }
    } catch {
      // Silently fail; meeting list is optional
    } finally {
      setAddLeadMeetingsLoading(false)
    }
  }

  const handleExtractFromMeeting = async (meetingId: string) => {
    setAddLeadExtractLoading(true)
    setAddLeadError(null)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const res = await fetch(`/api/admin/meetings/${meetingId}/extract-lead-fields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setAddLeadError(err.error || 'Failed to extract lead fields')
        return
      }
      const { fields } = await res.json()
      if (fields.name) setAddLeadName(fields.name)
      if (fields.email) setAddLeadEmail(fields.email)
      if (fields.company) setAddLeadCompany(fields.company)
      if (fields.company_website) setAddLeadCompanyWebsite(fields.company_website)
      if (fields.linkedin_url) setAddLeadLinkedInUrl(fields.linkedin_url)
      if (fields.job_title) setAddLeadJobTitle(fields.job_title)
      if (fields.industry) setAddLeadIndustry(fields.industry)
      if (fields.phone) setAddLeadPhone(fields.phone)
      const pendingSuggestions: PendingExtractSuggestion[] = []
      if (fields.pain_points) {
        pendingSuggestions.push({ field: 'pain_points', content: fields.pain_points })
        setAddLeadMeetingPainPoints(fields.pain_points)
        setShowVepSection(true)
      }
      if (fields.quick_wins) {
        pendingSuggestions.push({ field: 'quick_wins', content: fields.quick_wins })
        setShowVepSection(true)
      }
      if (pendingSuggestions.length > 0) {
        setAddLeadPendingExtracts((prev) => [...prev, ...pendingSuggestions])
      }
      if (fields.employee_count) {
        setAddLeadEmployeeCount(fields.employee_count)
        setShowVepSection(true)
      }
      if (fields.meeting_context_summary) {
        setAddLeadMessage(fields.meeting_context_summary)
        setAddLeadMeetingSummary(fields.meeting_context_summary)
      }
    } catch {
      setAddLeadError('Failed to extract lead fields from meeting')
    } finally {
      setAddLeadExtractLoading(false)
    }
  }

  const handlePasteAndExtract = async () => {
    const text = addLeadPasteText.trim()
    if (!text) return
    setAddLeadPasteSaving(true)
    setAddLeadError(null)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const ingestRes = await fetch('/api/admin/meetings/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          transcript: text,
          title: addLeadPasteTitle.trim() || undefined,
          attendee_name: addLeadPasteAttendeeName.trim() || undefined,
          attendee_email: addLeadPasteAttendeeEmail.trim() || undefined,
          meeting_type: 'external',
        }),
      })
      if (!ingestRes.ok) {
        const err = await ingestRes.json().catch(() => ({}))
        setAddLeadError(err.error || 'Failed to save transcript')
        return
      }
      const { meeting } = await ingestRes.json()
      const newId = meeting.id as string

      setAddLeadMeetingId(newId)
      setAddLeadMeetings((prev) => [
        { id: newId, meeting_type: 'external', meeting_date: meeting.meeting_date, transcript_preview: text.substring(0, 120) },
        ...prev,
      ])
      setAddLeadMeetingTab('select')

      await handleExtractFromMeeting(newId)
    } catch {
      setAddLeadError('Failed to save and extract from transcript')
    } finally {
      setAddLeadPasteSaving(false)
    }
  }

  const handleAddLeadReadAiSearch = async (forceRefresh?: boolean) => {
    const email = addLeadReadAiEmail.trim()
    if (!email) return

    const cacheKey = email.toLowerCase()
    const needReadAiFetch =
      forceRefresh ||
      !readAiCacheRef.current[cacheKey] ||
      Date.now() - readAiCacheRef.current[cacheKey].fetchedAt >= READAI_CACHE_TTL_MS

    const session = await getCurrentSession()
    if (!session) return
    setAddLeadReadAiLoading(true)
    setAddLeadReadAiSearched(false)
    try {
      const dbPromise = fetch(
        `/api/admin/meetings?match_email=${encodeURIComponent(email)}&limit=50`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      ).then((r) => (r.ok ? r.json() : { meetings: [] }))

      const readAiPromise = needReadAiFetch
        ? fetch(`/api/admin/read-ai/meetings?email=${encodeURIComponent(email)}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }).then(async (r) => {
            if (!r.ok) {
              console.warn(`[read-ai/meetings] Add Lead search ${r.status}`)
              return { meetings: [] as AdminMeetingContextItem[] }
            }
            const data = await r.json()
            const meetings: AdminMeetingContextItem[] = data.meetings || []
            readAiCacheRef.current[cacheKey] = { meetings, fetchedAt: Date.now() }
            setReadAiCacheTick((t) => t + 1)
            return { meetings }
          })
        : Promise.resolve({
            meetings: readAiCacheRef.current[cacheKey]?.meetings ?? ([] as AdminMeetingContextItem[]),
          })

      const [dbData, readAiData] = await Promise.all([dbPromise, readAiPromise])

      const dbRows = (dbData.meetings || []) as Array<{
        id: string
        meeting_type: string
        meeting_date: string
        summary: string | null
      }>
      const dbMapped = mapDbMeetingRowsToContextItems(dbRows)
      setAddLeadReadAiMeetings(mergeDbFirstWithReadAi(dbMapped, readAiData.meetings))
    } catch (err) {
      console.error('[read-ai] Add Lead search failed:', err)
    } finally {
      setAddLeadReadAiLoading(false)
      setAddLeadReadAiSearched(true)
    }
  }

  const handleAddLeadReadAiImport = async (meetingId: string) => {
    const session = await getCurrentSession()
    if (!session) return
    setAddLeadExtractLoading(true)
    try {
      const res = isMeetingRecordContextId(meetingId)
        ? await fetch(`/api/admin/meetings/${encodeURIComponent(meetingRecordUuidFromContextId(meetingId))}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
        : await fetch(`/api/admin/read-ai/meetings/${encodeURIComponent(meetingId)}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
      if (!res.ok) return
      const { meeting } = await res.json()

      if (isMeetingRecordContextId(meetingId)) {
        const rawId = meetingRecordUuidFromContextId(meetingId)
        setAddLeadMeetingId(rawId)
        setAddLeadMeetings((prev) => {
          if (prev.some((x) => x.id === rawId)) return prev
          return [
            {
              id: rawId,
              meeting_type: 'record',
              meeting_date: new Date(meeting.start_time_ms).toISOString(),
            },
            ...prev,
          ]
        })
      } else {
        const ingestRes = await fetch('/api/admin/meetings/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            transcript: meeting.transcript?.text || meeting.summary || '',
            title: meeting.title,
            attendee_email: addLeadReadAiEmail.trim() || undefined,
            meeting_type: 'external',
          }),
        })
        if (ingestRes.ok) {
          const { meeting: saved } = await ingestRes.json()
          setAddLeadMeetingId(saved.id)
          setAddLeadMeetings((prev) => [
            { id: saved.id, meeting_type: 'external', meeting_date: saved.meeting_date },
            ...prev,
          ])
        }
      }

      if (meeting.summary) {
        setAddLeadPainPoints((prev) => [prev, `--- From meeting: ${meeting.title} ---\n${meeting.summary}`].filter(Boolean).join('\n\n'))
      }
      if (meeting.action_items?.length) {
        const items = formatMeetingActionItemsAsBullets(meeting.action_items)
        if (items) {
          setAddLeadQuickWins((prev) => [prev, `--- From meeting: ${meeting.title} ---\n${items}`].filter(Boolean).join('\n\n'))
        }
      }

      if (!isMeetingRecordContextId(meetingId)) {
        const attendee = meeting.participants?.find((p: { email: string | null }) =>
          p.email?.toLowerCase() === addLeadReadAiEmail.trim().toLowerCase()
        )
        if (attendee) {
          if (!addLeadName.trim() && attendee.name) setAddLeadName(attendee.name)
          if (!addLeadEmail.trim() && attendee.email) setAddLeadEmail(attendee.email)
        }
      } else if (addLeadReadAiEmail.trim()) {
        if (!addLeadEmail.trim()) setAddLeadEmail(addLeadReadAiEmail.trim())
      }

      setAddLeadMeetingTab('select')
    } catch (err) {
      console.error('[read-ai] Import to Add Lead failed:', err)
    } finally {
      setAddLeadExtractLoading(false)
    }
  }

  const handleAddLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddLeadError(null)
    setAddLeadLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) {
        setAddLeadError('Not authenticated')
        return
      }
      const payload: Record<string, unknown> = {
        name: addLeadName.trim(),
        email: addLeadEmail.trim() || undefined,
        company: addLeadCompany.trim() || undefined,
        company_domain: addLeadCompanyWebsite.trim() || undefined,
        linkedin_url: addLeadLinkedInUrl.trim() || undefined,
        job_title: addLeadJobTitle.trim() || undefined,
        industry: addLeadIndustry.trim() || undefined,
        phone_number: addLeadPhone.trim() || undefined,
        message: addLeadMessage.trim() || undefined,
        input_type: addLeadInputType,
        employee_count: addLeadEmployeeCount.trim() || undefined,
        quick_wins: addLeadQuickWins.trim() || undefined,
        rep_pain_points: addLeadPainPoints.trim() || undefined,
      }
      if (addLeadMeetingId) {
        payload.meeting_record_id = addLeadMeetingId
        payload.meeting_summary = addLeadMeetingSummary || undefined
        payload.meeting_pain_points = addLeadMeetingPainPoints || undefined
        payload.generate_outreach = true
      }
      const response = await fetch('/api/admin/outreach/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setAddLeadError(data.error || `Request failed (${response.status})`)
        return
      }
      setAddLeadSuccessId(data.id ?? null)
      if (data.outreach_queued) {
        setAddLeadOutreachToast(true)
        setTimeout(() => setAddLeadOutreachToast(false), 8000)
        onOutreachGenerated()
      }
      resetAddLeadForm()
      onLeadAdded(data.id)
    } catch (err) {
      setAddLeadError(err instanceof Error ? err.message : 'Failed to add lead')
    } finally {
      setAddLeadLoading(false)
    }
  }

  return (
    <>
      {/* Add Lead modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
            onClick={() => !addLeadLoading && onClose()}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col bg-background border border-silicon-slate rounded-xl shadow-xl"
            >
              <div className="flex items-center justify-between p-6 pb-4">
                <h3 className="text-lg font-semibold text-white">Add lead</h3>
                <button
                  type="button"
                  onClick={() => !addLeadLoading && onClose()}
                  className="p-2 rounded-lg bg-silicon-slate/50 hover:bg-silicon-slate text-muted-foreground"
                >
                  <X size={18} />
                </button>
              </div>
              <form id="add-lead-form" onSubmit={handleAddLeadSubmit} className="flex-1 overflow-y-auto px-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Name *</label>
                  <input
                    type="text"
                    value={addLeadName}
                    onChange={(e) => setAddLeadName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
                  <input
                    type="email"
                    value={addLeadEmail}
                    onChange={(e) => setAddLeadEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                    placeholder="email@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Company</label>
                  <input
                    type="text"
                    value={addLeadCompany}
                    onChange={(e) => setAddLeadCompany(e.target.value)}
                    className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                    placeholder="Company name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Company website</label>
                  <input
                    type="text"
                    value={addLeadCompanyWebsite}
                    onChange={(e) => setAddLeadCompanyWebsite(e.target.value)}
                    className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                    placeholder="company.com or https://..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">LinkedIn URL</label>
                  <input
                    type="url"
                    value={addLeadLinkedInUrl}
                    onChange={(e) => setAddLeadLinkedInUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Job title</label>
                  <input
                    type="text"
                    value={addLeadJobTitle}
                    onChange={(e) => setAddLeadJobTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                    placeholder="Job title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Industry</label>
                  <input
                    type="text"
                    value={addLeadIndustry}
                    onChange={(e) => setAddLeadIndustry(e.target.value)}
                    className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                    placeholder="e.g. Technology, Healthcare"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Phone</label>
                  <input
                    type="tel"
                    value={addLeadPhone}
                    onChange={(e) => setAddLeadPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                    placeholder="+1 234 567 8900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">How did you get this lead?</label>
                  <select
                    value={addLeadInputType}
                    onChange={(e) => {
                      const val = e.target.value
                      setAddLeadInputType(val)
                      if (val === 'meeting') {
                        setAddLeadMeetingTab('readai')
                        if (addLeadEmail.trim()) setAddLeadReadAiEmail(addLeadEmail.trim())
                        if (addLeadMeetings.length === 0) fetchMeetingsForPicker()
                      }
                      if (val !== 'meeting') {
                        setAddLeadMeetingId(null)
                      }
                    }}
                    className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white focus:outline-none focus:border-radiant-gold"
                  >
                    <option value="linkedin">LinkedIn</option>
                    <option value="referral">Referral</option>
                    <option value="business_card">Business card</option>
                    <option value="event">Event</option>
                    <option value="meeting">Meeting</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                {addLeadInputType === 'meeting' && (
                  <div className="space-y-3 p-3 rounded-lg border border-purple-700/50 bg-purple-900/20">
                    <div className="flex rounded-lg overflow-hidden border border-purple-700/40">
                      <button
                        type="button"
                        onClick={() => setAddLeadMeetingTab('readai')}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${addLeadMeetingTab === 'readai' ? 'bg-cyan-700/60 text-cyan-100' : 'bg-silicon-slate/30 text-muted-foreground/90 hover:text-muted-foreground'}`}
                      >
                        <CalendarCheck size={12} /> Meetings
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddLeadMeetingTab('select')}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${addLeadMeetingTab === 'select' ? 'bg-purple-700/60 text-purple-100' : 'bg-silicon-slate/30 text-muted-foreground/90 hover:text-muted-foreground'}`}
                      >
                        <Search size={12} /> Existing
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddLeadMeetingTab('paste')}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${addLeadMeetingTab === 'paste' ? 'bg-purple-700/60 text-purple-100' : 'bg-silicon-slate/30 text-muted-foreground/90 hover:text-muted-foreground'}`}
                      >
                        <FileText size={12} /> Paste
                      </button>
                    </div>

                    {addLeadMeetingTab === 'readai' && (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input
                            type="email"
                            value={addLeadReadAiEmail}
                            onChange={(e) => setAddLeadReadAiEmail(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddLeadReadAiSearch()}
                            className="flex-1 px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-cyan-500 text-sm"
                            placeholder="Search by attendee email..."
                          />
                          <button
                            type="button"
                            onClick={() => handleAddLeadReadAiSearch()}
                            disabled={!addLeadReadAiEmail.trim() || addLeadReadAiLoading}
                            className="px-3 py-2 rounded-lg bg-cyan-700/50 hover:bg-cyan-700/70 text-cyan-200 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {addLeadReadAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                            Search
                          </button>
                        </div>

                        {addLeadReadAiLoading && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                            <Loader2 size={14} className="animate-spin" />
                            Loading meeting records and Read.ai matches…
                          </div>
                        )}

                        {addLeadReadAiSearched && !addLeadReadAiLoading && addLeadReadAiMeetings.length === 0 && (
                          <p className="text-sm text-muted-foreground/90 py-1">
                            No meeting records matched this email, and nothing was found in Read.ai in the last 30 days.
                          </p>
                        )}

                        {addLeadReadAiSearched && !addLeadReadAiLoading && getReadAiCacheAge(addLeadReadAiEmail) && (
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/80">
                            <span>Fetched {getReadAiCacheAge(addLeadReadAiEmail)}</span>
                            <button
                              type="button"
                              onClick={() => handleAddLeadReadAiSearch(true)}
                              className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
                            >
                              <RefreshCw size={10} /> Refresh
                            </button>
                          </div>
                        )}

                        {addLeadReadAiMeetings.map((m) => {
                          const date = new Date(m.start_time_ms)
                          return (
                            <div
                              key={m.id}
                              className="p-3 rounded-lg border border-silicon-slate/60 bg-silicon-slate/30 space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-white truncate">{m.title}</div>
                                  <div className="text-xs text-muted-foreground/90">
                                    {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    {m.platform && (
                                      <span className="ml-1 capitalize">
                                        · {m.platform === 'record' ? 'Record' : m.platform}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAddLeadReadAiImport(m.id)}
                                  disabled={addLeadExtractLoading}
                                  className="shrink-0 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
                                >
                                  {addLeadExtractLoading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                  Import
                                </button>
                              </div>
                              {m.summary && (
                                <p className="text-xs text-muted-foreground line-clamp-2">{m.summary}</p>
                              )}
                              <div className="text-xs text-muted-foreground/80">
                                {m.participants.map((p) => p.name).filter(Boolean).join(', ')}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {addLeadMeetingTab === 'select' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-purple-300 mb-1">Select meeting</label>
                          {addLeadMeetingsLoading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                              <Loader2 size={14} className="animate-spin" /> Loading meetings...
                            </div>
                          ) : (
                            <select
                              value={addLeadMeetingId || ''}
                              onChange={(e) => setAddLeadMeetingId(e.target.value || null)}
                              className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white focus:outline-none focus:border-purple-500"
                            >
                              <option value="">Choose a meeting...</option>
                              {addLeadMeetings.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.meeting_date ? new Date(m.meeting_date).toLocaleDateString() : 'No date'} — {m.meeting_type}{m.contact_name ? ` (linked: ${m.contact_name})` : ''}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        {addLeadMeetingId && (
                          <button
                            type="button"
                            onClick={() => handleExtractFromMeeting(addLeadMeetingId)}
                            disabled={addLeadExtractLoading}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-700/50 hover:bg-purple-700/70 text-purple-200 text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {addLeadExtractLoading ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                Analyzing transcript...
                              </>
                            ) : (
                              <>
                                <Cpu size={14} />
                                Extract lead info from transcript
                              </>
                            )}
                          </button>
                        )}
                      </>
                    )}

                    {addLeadMeetingTab === 'paste' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-purple-300 mb-1">Meeting title (optional)</label>
                          <input
                            type="text"
                            value={addLeadPasteTitle}
                            onChange={(e) => setAddLeadPasteTitle(e.target.value)}
                            className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-purple-500"
                            placeholder="e.g. Coffee chat with Jane at FinTech Summit"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-sm font-medium text-purple-300 mb-1">Attendee name</label>
                            <input
                              type="text"
                              value={addLeadPasteAttendeeName}
                              onChange={(e) => setAddLeadPasteAttendeeName(e.target.value)}
                              className="w-full px-3 py-1.5 text-sm bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-purple-500"
                              placeholder="Jane Doe"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-purple-300 mb-1">Attendee email</label>
                            <input
                              type="email"
                              value={addLeadPasteAttendeeEmail}
                              onChange={(e) => setAddLeadPasteAttendeeEmail(e.target.value)}
                              className="w-full px-3 py-1.5 text-sm bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-purple-500"
                              placeholder="jane@example.com"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-purple-300 mb-1">Transcript</label>
                          <textarea
                            value={addLeadPasteText}
                            onChange={(e) => setAddLeadPasteText(e.target.value)}
                            rows={6}
                            className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-purple-500 resize-y text-sm"
                            placeholder="Paste your meeting transcript here..."
                          />
                          {addLeadPasteText.trim() && (
                            <p className="text-xs text-muted-foreground/80 mt-1">{addLeadPasteText.trim().length.toLocaleString()} characters</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={handlePasteAndExtract}
                          disabled={!addLeadPasteText.trim() || addLeadPasteSaving || addLeadExtractLoading}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-700/50 hover:bg-purple-700/70 text-purple-200 text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {addLeadPasteSaving || addLeadExtractLoading ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              {addLeadPasteSaving ? 'Saving transcript...' : 'Extracting lead info...'}
                            </>
                          ) : (
                            <>
                              <Cpu size={14} />
                              Save &amp; Extract lead info
                            </>
                          )}
                        </button>
                      </>
                    )}

                    {addLeadExtractLoading && (
                      <div className="space-y-2">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="h-8 rounded bg-silicon-slate/50 animate-pulse" />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Message / notes</label>
                  <textarea
                    value={addLeadMessage}
                    onChange={(e) => setAddLeadMessage(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold resize-y"
                    placeholder="Optional notes"
                  />
                </div>
                {/* Pending AI-extracted suggestions for admin approval */}
                {addLeadPendingExtracts.length > 0 && (
                  <div className="p-3 rounded-lg border border-amber-700/50 bg-amber-900/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-amber-400 flex items-center gap-2">
                        <AlertTriangle size={14} />
                        Review extracted items ({addLeadPendingExtracts.length})
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            for (const item of addLeadPendingExtracts) {
                              if (item.field === 'pain_points') {
                                setAddLeadPainPoints((prev) => [prev, item.content].filter(Boolean).join('\n\n'))
                              } else {
                                setAddLeadQuickWins((prev) => [prev, item.content].filter(Boolean).join('\n\n'))
                              }
                            }
                            setAddLeadPendingExtracts([])
                            setShowVepSection(true)
                          }}
                          className="px-2 py-1 text-xs font-medium rounded bg-green-900/50 text-green-400 border border-green-700 hover:bg-green-800/50"
                        >
                          Approve all
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddLeadPendingExtracts([])}
                          className="px-2 py-1 text-xs font-medium rounded bg-red-900/50 text-red-400 border border-red-700 hover:bg-red-800/50"
                        >
                          Decline all
                        </button>
                      </div>
                    </div>
                    {addLeadPendingExtracts.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 rounded bg-silicon-slate/30">
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                          item.field === 'pain_points'
                            ? 'bg-red-900/50 text-red-400'
                            : 'bg-green-900/50 text-green-400'
                        }`}>
                          {item.field === 'pain_points' ? 'Pain point' : 'Quick win'}
                        </span>
                        <p className="flex-1 text-sm text-muted-foreground line-clamp-2">{item.content}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (item.field === 'pain_points') {
                                setAddLeadPainPoints((prev) => [prev, item.content].filter(Boolean).join('\n\n'))
                              } else {
                                setAddLeadQuickWins((prev) => [prev, item.content].filter(Boolean).join('\n\n'))
                              }
                              setAddLeadPendingExtracts((prev) => prev.filter((_, i) => i !== idx))
                              setShowVepSection(true)
                            }}
                            className="p-1 rounded hover:bg-green-900/50 text-green-400"
                            title="Approve"
                          >
                            <CheckCircle size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddLeadPendingExtracts((prev) => prev.filter((_, i) => i !== idx))}
                            className="p-1 rounded hover:bg-red-900/50 text-red-400"
                            title="Decline"
                          >
                            <XCircle size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border border-silicon-slate rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowVepSection((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-silicon-slate/50 hover:bg-silicon-slate text-left text-sm font-medium text-muted-foreground"
                  >
                    Value Evidence (optional)
                    {showVepSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {showVepSection && (
                    <div className="p-3 space-y-3 border-t border-silicon-slate">
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Company size</label>
                        <select
                          value={addLeadEmployeeCount}
                          onChange={(e) => setAddLeadEmployeeCount(e.target.value)}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white focus:outline-none focus:border-radiant-gold"
                        >
                          <option value="">Select range</option>
                          <option value="1-10">1-10</option>
                          <option value="11-50">11-50</option>
                          <option value="51-200">51-200</option>
                          <option value="201-500">201-500</option>
                          <option value="501-1000">501-1000</option>
                          <option value="1000+">1000+</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Quick wins</label>
                        <textarea
                          value={addLeadQuickWins}
                          onChange={(e) => setAddLeadQuickWins(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold resize-y"
                          placeholder="Quick-win AI opportunities with 90-day ROI potential"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Known pain points</label>
                        <textarea
                          value={addLeadPainPoints}
                          onChange={(e) => setAddLeadPainPoints(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold resize-y"
                          placeholder="Known challenges, bottlenecks, or pain points for this lead"
                        />
                      </div>
                    </div>
                  )}
                </div>
                {addLeadError && (
                  <div className="p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm flex items-center gap-2">
                    <AlertTriangle size={16} />
                    {addLeadError}
                  </div>
                )}
                <div className="h-4" />
              </form>
              <div className="flex gap-3 p-6 pt-4 border-t border-silicon-slate">
                <button
                  type="submit"
                  form="add-lead-form"
                  disabled={addLeadLoading || addLeadExtractLoading || !addLeadName.trim()}
                  className="flex-1 px-4 py-2 btn-gold text-imperial-navy hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                >
                  {addLeadLoading ? 'Adding...' : addLeadInputType === 'meeting' && addLeadMeetingId ? 'Add lead & queue email' : 'Add lead'}
                </button>
                <button
                  type="button"
                  onClick={() => !addLeadLoading && onClose()}
                  className="px-4 py-2 bg-silicon-slate/50 hover:bg-silicon-slate rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success toast when lead was just added */}
      {addLeadSuccessId != null && !open && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-lg bg-green-900/30 border border-green-800 text-green-300 text-sm flex items-center gap-2"
        >
          <CheckCircle size={16} />
          Lead added successfully.
          <button
            type="button"
            onClick={() => setAddLeadSuccessId(null)}
            className="ml-auto p-1 hover:bg-silicon-slate rounded"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
      {addLeadOutreachToast && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mb-4 p-3 rounded-lg bg-purple-900/30 border border-purple-700 text-purple-300 text-sm flex items-center gap-2"
        >
          <Mail size={16} />
          Discovery email is being generated — check Email center in ~30 seconds.
          <button
            type="button"
            onClick={() => setAddLeadOutreachToast(false)}
            className="ml-auto p-1 hover:bg-silicon-slate rounded"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </>
  )
}
