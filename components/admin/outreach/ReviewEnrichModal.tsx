'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Loader2,
  CalendarCheck,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  Cpu,
} from 'lucide-react'
import { getCurrentSession } from '@/lib/auth'
import { inputTypeFromLeadSource } from '@/lib/constants/lead-source'
import { quickWinsToEditableString } from '@/lib/quick-wins-display'
import {
  type AdminMeetingContextItem,
  mapDbMeetingRowsToContextItems,
  mergeDbFirstWithReadAi,
  isMeetingRecordContextId,
  meetingRecordUuidFromContextId,
} from '@/lib/admin-meeting-context-items'
import { PipelineProgressBar } from '@/components/admin/ExtractionStatusChip'
import { estimateMilestoneProgress, type PipelineStage } from '@/lib/pipeline-progress'

const READAI_CACHE_TTL_MS = 5 * 60 * 1000

// Value Evidence pipeline progress stages.
// Step 1 ("Push to VEP") fires n8n WF-VEP-001; typical run is ~25–35s end-to-end.
// Step 2 ("Classify & Store Evidence") is an in-app call to
// /api/admin/meetings/classify-pain-points which invokes an LLM and inserts
// rows into value_evidence; typical run is ~10–20s.
// The "typical" totals err long so the bar eases toward 94% rather than
// stalling at 100% when a run takes longer than the baseline.
const VEP_PUSH_STAGES: PipelineStage[] = [
  { label: 'Contacting n8n workflow', startsAt: 0 },
  { label: 'Fetching source rows', startsAt: 3 },
  { label: 'Classifying pain points in n8n', startsAt: 10 },
  { label: 'Writing evidence rows', startsAt: 22 },
]
const VEP_PUSH_TYPICAL_S = 32

const CLASSIFY_STAGES: PipelineStage[] = [
  { label: 'Submitting text to classifier', startsAt: 0 },
  { label: 'Classifying pain points', startsAt: 3 },
  { label: 'Storing evidence rows', startsAt: 12 },
]
const CLASSIFY_TYPICAL_S = 18

type PendingMeetingImport = {
  meetingId: string
  meetingTitle: string
  meetingDate: string
  type: 'pain_points' | 'quick_wins'
  content: string
}

type ClassifiedPainPoint = {
  text: string
  categoryId: string
  categoryName: string
  categoryDisplayName: string
  confidence: number
  method: 'keyword' | 'ai'
}

type EnrichLeadData = {
  id: number
  name: string
  email: string | null
  company: string | null
  company_domain: string | null
  industry: string | null
  job_title: string | null
  phone_number: string | null
  linkedin_url: string | null
  lead_source: string | null
  employee_count: string | null
  message: string | null
  quick_wins: string | null
  full_report: string | null
  rep_pain_points: string | null
  has_diagnostic: boolean
  has_extractable_text: boolean
  evidence_count?: number
}

type EnrichFormFields = {
  name?: string
  email?: string
  company?: string
  company_domain?: string
  linkedin_url?: string
  job_title?: string
  industry?: string
  phone_number?: string
  input_type?: string
  message?: string
  rep_pain_points?: string
  quick_wins?: string
  employee_count?: string
}

export interface ReviewEnrichModalProps {
  open: boolean
  onClose: () => void
  leadIds: number[]
  pushLoading: boolean
  setPushLoading: (v: boolean) => void
  fetchLeads: () => Promise<unknown>
  startVepPolling: () => void
  onSelectedLeadsClear: () => void
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

type StepState = 'idle' | 'running' | 'done' | 'skipped' | 'failed' | 'locked'

/**
 * Small pipeline-step card used inside the Value Evidence panel. Matches the
 * visual language of the outreach progress bar (amber for running, green for
 * done, muted for idle) so the two pipelines read as clearly distinct yet
 * related.
 */
function StepCard({
  index,
  title,
  subtitle,
  state,
}: {
  index: number
  title: string
  subtitle: string
  state: StepState
}) {
  const ring =
    state === 'running'
      ? 'border-amber-500/50 bg-amber-950/25'
      : state === 'done'
      ? 'border-green-600/50 bg-green-950/25'
      : state === 'failed'
      ? 'border-red-600/50 bg-red-950/25'
      : state === 'skipped'
      ? 'border-silicon-slate/70 bg-silicon-slate/20'
      : state === 'locked'
      ? 'border-silicon-slate/60 bg-silicon-slate/10 opacity-60'
      : 'border-silicon-slate bg-silicon-slate/30'
  const indexColor =
    state === 'running'
      ? 'bg-amber-500 text-imperial-navy'
      : state === 'done'
      ? 'bg-green-600 text-white'
      : state === 'failed'
      ? 'bg-red-600 text-white'
      : state === 'locked'
      ? 'bg-silicon-slate/60 text-muted-foreground/70'
      : 'bg-silicon-slate text-muted-foreground'
  return (
    <div className={`flex-1 min-w-0 rounded-md border px-3 py-2 ${ring}`}>
      <div className="flex items-center gap-2 mb-0.5">
        <span
          className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${indexColor}`}
          aria-hidden
        >
          {state === 'done' ? <CheckCircle size={12} /> : state === 'running' ? <Loader2 size={10} className="animate-spin" /> : index}
        </span>
        <p className="text-[12px] font-medium text-white truncate">{title}</p>
      </div>
      <p className="text-[11px] text-muted-foreground truncate" title={subtitle}>
        {subtitle}
      </p>
    </div>
  )
}

export default function ReviewEnrichModal({
  open,
  onClose,
  leadIds,
  pushLoading,
  setPushLoading,
  fetchLeads,
  startVepPolling,
  onSelectedLeadsClear,
}: ReviewEnrichModalProps) {
  // Modal-internal state
  const [enrichModalLeads, setEnrichModalLeads] = useState<EnrichLeadData[]>([])
  const [enrichModalForm, setEnrichModalForm] = useState<Record<number, EnrichFormFields>>({})
  const [unifiedModalReRunEnrichment, setUnifiedModalReRunEnrichment] = useState(true)
  const [unifiedModalSaveLoading, setUnifiedModalSaveLoading] = useState(false)
  const [unifiedModalSaveError, setUnifiedModalSaveError] = useState<string | null>(null)
  const [enrichModalVepPushCompleted, setEnrichModalVepPushCompleted] = useState(false)

  // Read.ai cache
  const readAiCacheRef = useRef<Record<string, { meetings: AdminMeetingContextItem[]; fetchedAt: number }>>({})
  const [, setReadAiCacheTick] = useState(0)

  // Meeting context state
  const [meetingsByLead, setMeetingsByLead] = useState<Record<number, AdminMeetingContextItem[]>>({})
  const [meetingsLoading, setMeetingsLoading] = useState<Record<number, boolean>>({})
  const [selectedMeetingIds, setSelectedMeetingIds] = useState<Record<number, Set<string>>>({})
  const [meetingImportLoading, setMeetingImportLoading] = useState(false)
  const [meetingSectionExpanded, setMeetingSectionExpanded] = useState<Record<number, boolean>>({})
  const [pendingMeetingImports, setPendingMeetingImports] = useState<Record<number, PendingMeetingImport[]>>({})

  // Pain-point classification
  const [enrichClassifiedItems, setEnrichClassifiedItems] = useState<Record<number, ClassifiedPainPoint[]>>({})
  const [enrichClassifyLoading, setEnrichClassifyLoading] = useState<Record<number, boolean>>({})
  const [enrichClassifyError, setEnrichClassifyError] = useState<string | null>(null)

  // Value Evidence pipeline progress tracking.
  // We stamp `*StartedAt` when either phase kicks off and clear it when the
  // phase settles. A shared 500ms ticker (`nowTick`) drives progress-bar
  // re-renders so `estimateMilestoneProgress` can ease forward even while no
  // other state changes.
  const [vepPushStartedAt, setVepPushStartedAt] = useState<number | null>(null)
  const [classifyStartedAt, setClassifyStartedAt] = useState<number | null>(null)
  const [nowTick, setNowTick] = useState(() => Date.now())

  // Track the leadIds we last loaded so we don't re-fetch on every render
  const prevLeadIdsRef = useRef<string>('')

  const getReadAiCacheAge = useCallback((email: string): string | null => {
    const cached = readAiCacheRef.current[email.toLowerCase().trim()]
    if (!cached) return null
    const seconds = Math.floor((Date.now() - cached.fetchedAt) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ago`
  }, [])

  const bustReadAiCache = useCallback((email: string) => {
    delete readAiCacheRef.current[email.toLowerCase().trim()]
  }, [])

  const fetchMeetingsForLead = useCallback(async (leadId: number, email: string | null, accessToken: string, forceRefresh?: boolean) => {
    const cacheKey = (email ?? '').toLowerCase().trim()
    const canReadAi = cacheKey.length > 0

    setMeetingsLoading((prev) => ({ ...prev, [leadId]: true }))
    try {
      const needReadAiFetch =
        canReadAi &&
        (forceRefresh ||
          !readAiCacheRef.current[cacheKey] ||
          Date.now() - readAiCacheRef.current[cacheKey].fetchedAt >= READAI_CACHE_TTL_MS)

      const dbPromise = fetch(
        `/api/admin/meetings?contact_submission_id=${leadId}&limit=50`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      ).then(async (r) => (r.ok ? r.json() : { meetings: [] }))

      const readAiPromise = needReadAiFetch
        ? fetch(`/api/admin/read-ai/meetings?email=${encodeURIComponent(email!)}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }).then(async (r) => {
            if (!r.ok) {
              console.warn(`[read-ai/meetings] ${r.status} for lead ${leadId}`)
              return { meetings: [] as AdminMeetingContextItem[] }
            }
            const data = await r.json()
            const meetings: AdminMeetingContextItem[] = data.meetings || []
            readAiCacheRef.current[cacheKey] = { meetings, fetchedAt: Date.now() }
            setReadAiCacheTick((t) => t + 1)
            return { meetings }
          })
        : Promise.resolve({
            meetings: (canReadAi ? readAiCacheRef.current[cacheKey]?.meetings : undefined) ?? ([] as AdminMeetingContextItem[]),
          })

      const [dbData, readAiData] = await Promise.all([dbPromise, readAiPromise])

      const dbRows = (dbData.meetings || []) as Array<{
        id: string
        meeting_type: string
        meeting_date: string
        summary: string | null
      }>

      const dbMapped = mapDbMeetingRowsToContextItems(dbRows)
      const merged = mergeDbFirstWithReadAi(dbMapped, readAiData.meetings)

      setMeetingsByLead((prev) => ({ ...prev, [leadId]: merged }))
      if (merged.length > 0) {
        setMeetingSectionExpanded((prev) => ({ ...prev, [leadId]: true }))
      }
    } catch (err) {
      console.error(`[meetings-context] Failed for lead ${leadId}:`, err)
    } finally {
      setMeetingsLoading((prev) => ({ ...prev, [leadId]: false }))
    }
  }, [])

  const handleToggleMeeting = useCallback((leadId: number, meetingId: string) => {
    setSelectedMeetingIds((prev) => {
      const current = prev[leadId] ?? new Set<string>()
      const next = new Set(current)
      if (next.has(meetingId)) next.delete(meetingId)
      else next.add(meetingId)
      return { ...prev, [leadId]: next }
    })
  }, [])

  const handleImportMeetings = useCallback(async (leadId: number) => {
    const selected = selectedMeetingIds[leadId]
    if (!selected || selected.size === 0) return

    const session = await getCurrentSession()
    if (!session) return

    setMeetingImportLoading(true)
    try {
      const pending: PendingMeetingImport[] = []

      for (const meetingId of selected) {
        const res = isMeetingRecordContextId(meetingId)
          ? await fetch(`/api/admin/meetings/${encodeURIComponent(meetingRecordUuidFromContextId(meetingId))}`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            })
          : await fetch(`/api/admin/read-ai/meetings/${encodeURIComponent(meetingId)}`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            })
        if (!res.ok) continue
        const { meeting } = await res.json()

        const date = new Date(meeting.start_time_ms).toLocaleDateString()

        if (meeting.summary) {
          pending.push({
            meetingId,
            meetingTitle: meeting.title,
            meetingDate: date,
            type: 'pain_points',
            content: meeting.summary,
          })
        }
        if (meeting.action_items?.length) {
          const items = formatMeetingActionItemsAsBullets(meeting.action_items)
          if (!items) continue
          pending.push({
            meetingId,
            meetingTitle: meeting.title,
            meetingDate: date,
            type: 'quick_wins',
            content: items,
          })
        }
      }

      setPendingMeetingImports((prev) => ({
        ...prev,
        [leadId]: [...(prev[leadId] || []), ...pending],
      }))

      setSelectedMeetingIds((prev) => ({ ...prev, [leadId]: new Set<string>() }))
    } catch (err) {
      console.error('[read-ai] Import failed:', err)
    } finally {
      setMeetingImportLoading(false)
    }
  }, [selectedMeetingIds])

  const handleApproveMeetingImport = useCallback((leadId: number, index: number) => {
    const items = pendingMeetingImports[leadId]
    if (!items || !items[index]) return

    const item = items[index]
    const formatted = `--- From meeting: ${item.meetingTitle} (${item.meetingDate}) ---\n${item.content}`

    setEnrichModalForm((prev) => {
      const existing = prev[leadId] || {}
      const field = item.type === 'pain_points' ? 'rep_pain_points' : 'quick_wins'
      const current = existing[field] ?? ''
      return {
        ...prev,
        [leadId]: {
          ...existing,
          [field]: [current, formatted].filter(Boolean).join('\n\n'),
        },
      }
    })

    setPendingMeetingImports((prev) => ({
      ...prev,
      [leadId]: items.filter((_, i) => i !== index),
    }))
  }, [pendingMeetingImports])

  const handleDeclineMeetingImport = useCallback((leadId: number, index: number) => {
    setPendingMeetingImports((prev) => ({
      ...prev,
      [leadId]: (prev[leadId] || []).filter((_, i) => i !== index),
    }))
  }, [])

  const handleApproveAllMeetingImports = useCallback((leadId: number) => {
    const items = pendingMeetingImports[leadId]
    if (!items || items.length === 0) return

    setEnrichModalForm((prev) => {
      const existing = prev[leadId] || {}
      let painPoints = existing.rep_pain_points ?? ''
      let quickWins = existing.quick_wins ?? ''

      for (const item of items) {
        const formatted = `--- From meeting: ${item.meetingTitle} (${item.meetingDate}) ---\n${item.content}`
        if (item.type === 'pain_points') {
          painPoints = [painPoints, formatted].filter(Boolean).join('\n\n')
        } else {
          quickWins = [quickWins, formatted].filter(Boolean).join('\n\n')
        }
      }

      return {
        ...prev,
        [leadId]: { ...existing, rep_pain_points: painPoints, quick_wins: quickWins },
      }
    })

    setPendingMeetingImports((prev) => ({ ...prev, [leadId]: [] }))
  }, [pendingMeetingImports])

  const handleDeclineAllMeetingImports = useCallback((leadId: number) => {
    setPendingMeetingImports((prev) => ({ ...prev, [leadId]: [] }))
  }, [])

  // When the modal opens with new leadIds, run the preflight fetch
  useEffect(() => {
    if (!open || leadIds.length === 0) {
      prevLeadIdsRef.current = ''
      return
    }

    const key = leadIds.slice().sort().join(',')
    if (key === prevLeadIdsRef.current) return
    prevLeadIdsRef.current = key

    let cancelled = false

    async function runPreflight() {
      const session = await getCurrentSession()
      if (!session || cancelled) return

      setPushLoading(true)
      setEnrichModalVepPushCompleted(false)
      try {
        const res = await fetch('/api/admin/value-evidence/extract-leads/preflight', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ contact_submission_ids: leadIds }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Preflight failed')
        if (cancelled) return

        const leads: EnrichLeadData[] = data.leads || []
        setEnrichModalLeads(leads)
        setEnrichModalForm({})
        setUnifiedModalReRunEnrichment(true)
        setUnifiedModalSaveError(null)
        setMeetingsByLead({})
        setSelectedMeetingIds({})
        setMeetingSectionExpanded({})
        setPendingMeetingImports({})
        setEnrichClassifiedItems({})
        setEnrichClassifyLoading({})

        for (const lead of leads) {
          fetchMeetingsForLead(lead.id, lead.email ?? null, session.access_token)
        }
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setPushLoading(false)
      }
    }

    runPreflight()
    return () => { cancelled = true }
  }, [open, leadIds, setPushLoading, fetchMeetingsForLead])

  // Reset internal state when modal closes
  useEffect(() => {
    if (!open) {
      setEnrichModalVepPushCompleted(false)
      setVepPushStartedAt(null)
      setClassifyStartedAt(null)
      setEnrichClassifyError(null)
    }
  }, [open])

  // Tick every 500ms while either VEP phase is active so PipelineProgressBar
  // eases forward between state changes. We stop ticking as soon as both
  // phases are idle to avoid needless renders.
  useEffect(() => {
    if (vepPushStartedAt == null && classifyStartedAt == null) return
    const id = setInterval(() => setNowTick(Date.now()), 500)
    return () => clearInterval(id)
  }, [vepPushStartedAt, classifyStartedAt])

  if (!open || enrichModalLeads.length === 0) return null

  return (
    <AnimatePresence>
      {open && enrichModalLeads.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={() => !pushLoading && !unifiedModalSaveLoading && onClose()}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-background border border-silicon-slate rounded-xl shadow-xl"
          >
            <div className="flex items-center justify-between p-4 border-b border-silicon-slate">
              <h3 className="text-lg font-semibold text-white">
                {enrichModalLeads.length === 1 ? enrichModalLeads[0].name : 'Lead'}
              </h3>
              <button
                type="button"
                onClick={() => !pushLoading && !unifiedModalSaveLoading && onClose()}
                className="p-2 rounded-lg bg-silicon-slate/50 hover:bg-silicon-slate text-muted-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[20rem]">
              {enrichModalLeads.map((l) => (
                <div
                  key={l.id}
                  className={`p-4 rounded-lg border ${l.has_extractable_text ? 'border-silicon-slate bg-silicon-slate/50' : 'border-radiant-gold/50 bg-radiant-gold/10'}`}
                >
                  {enrichModalLeads.length > 1 && (
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-white">{l.name}</span>
                      {!l.has_extractable_text && (
                        <span className="text-xs text-amber-400">Needs enrichment</span>
                      )}
                    </div>
                  )}
                  {/* Lead details section */}
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1">Name *</label>
                      <input
                        type="text"
                        value={enrichModalForm[l.id]?.name ?? l.name ?? ''}
                        onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], name: e.target.value } }))}
                        required
                        className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                        placeholder="Full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
                      <input
                        type="email"
                        value={enrichModalForm[l.id]?.email ?? l.email ?? ''}
                        onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], email: e.target.value } }))}
                        className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                        placeholder="email@company.com"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Company</label>
                        <input
                          type="text"
                          value={enrichModalForm[l.id]?.company ?? l.company ?? ''}
                          onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], company: e.target.value } }))}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="Company name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Company website</label>
                        <input
                          type="text"
                          value={enrichModalForm[l.id]?.company_domain ?? l.company_domain ?? ''}
                          onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], company_domain: e.target.value } }))}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="company.com or https://..."
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">LinkedIn URL</label>
                        <input
                          type="url"
                          value={enrichModalForm[l.id]?.linkedin_url ?? l.linkedin_url ?? ''}
                          onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], linkedin_url: e.target.value } }))}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="https://linkedin.com/in/..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Job title</label>
                        <input
                          type="text"
                          value={enrichModalForm[l.id]?.job_title ?? l.job_title ?? ''}
                          onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], job_title: e.target.value } }))}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="Job title"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Industry</label>
                        <input
                          type="text"
                          value={enrichModalForm[l.id]?.industry ?? l.industry ?? ''}
                          onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], industry: e.target.value } }))}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="e.g. Technology, Healthcare"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Phone</label>
                        <input
                          type="tel"
                          value={enrichModalForm[l.id]?.phone_number ?? l.phone_number ?? ''}
                          onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], phone_number: e.target.value } }))}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="+1 234 567 8900"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1">How did you get this lead?</label>
                      <select
                        value={enrichModalForm[l.id]?.input_type ?? inputTypeFromLeadSource(l.lead_source)}
                        onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], input_type: e.target.value } }))}
                        className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white focus:outline-none focus:border-radiant-gold"
                      >
                        <option value="linkedin">LinkedIn</option>
                        <option value="referral">Referral</option>
                        <option value="business_card">Business card</option>
                        <option value="event">Event</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1">Message / notes</label>
                      <textarea
                        value={enrichModalForm[l.id]?.message ?? l.message ?? ''}
                        onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], message: e.target.value } }))}
                        rows={2}
                        className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold resize-y"
                        placeholder="Optional notes"
                      />
                    </div>
                  </div>
                  {/* Value Evidence section */}
                  <div className="pt-3 border-t border-silicon-slate space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Value Evidence</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Pain points</label>
                        <textarea
                          value={enrichModalForm[l.id]?.rep_pain_points ?? l.rep_pain_points ?? ''}
                          onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], rep_pain_points: e.target.value } }))}
                          rows={2}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold resize-y"
                          placeholder="Known pain points"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Quick wins</label>
                        <textarea
                          value={enrichModalForm[l.id]?.quick_wins ?? quickWinsToEditableString(l.quick_wins as unknown)}
                          onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], quick_wins: e.target.value } }))}
                          rows={2}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold resize-y"
                          placeholder="Quick wins"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Company size</label>
                        <select
                          value={enrichModalForm[l.id]?.employee_count ?? l.employee_count ?? ''}
                          onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], employee_count: e.target.value } }))}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white focus:outline-none focus:border-radiant-gold"
                        >
                          <option value="">Select</option>
                          <option value="1-10">1-10</option>
                          <option value="11-50">11-50</option>
                          <option value="51-200">51-200</option>
                          <option value="201-500">201-500</option>
                          <option value="501-1000">501-1000</option>
                          <option value="1000+">1000+</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Meeting Context: attributed meeting_records + Read.ai */}
                  <div className="pt-3 border-t border-silicon-slate">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMeetingSectionExpanded((prev) => ({ ...prev, [l.id]: !prev[l.id] }))}
                          className="flex items-center gap-2 flex-1 text-left"
                        >
                          <CalendarCheck size={16} className="text-cyan-400" />
                          <h4 className="text-sm font-medium text-muted-foreground flex-1">
                            Meeting Context
                            {(meetingsByLead[l.id]?.length ?? 0) > 0 && (
                              <span className="ml-2 text-xs text-cyan-400">
                                ({meetingsByLead[l.id].length} found)
                              </span>
                            )}
                          </h4>
                          {meetingsLoading[l.id] ? (
                            <Loader2 size={14} className="animate-spin text-muted-foreground" />
                          ) : (
                            <ChevronRight
                              size={14}
                              className={`text-muted-foreground transition-transform ${meetingSectionExpanded[l.id] ? 'rotate-90' : ''}`}
                            />
                          )}
                        </button>
                        {!meetingsLoading[l.id] && (
                          <div className="flex items-center gap-1.5">
                            {l.email && getReadAiCacheAge(l.email) && (
                              <span className="text-[10px] text-muted-foreground/80">{getReadAiCacheAge(l.email)}</span>
                            )}
                            <button
                              type="button"
                              title={l.email ? 'Refresh linked meetings and Read.ai' : 'Refresh linked meetings'}
                              onClick={async (e) => {
                                e.stopPropagation()
                                const session = await getCurrentSession()
                                if (session) {
                                  if (l.email) bustReadAiCache(l.email)
                                  fetchMeetingsForLead(l.id, l.email ?? null, session.access_token, true)
                                }
                              }}
                              className="p-1 rounded hover:bg-silicon-slate/60 text-muted-foreground/80 hover:text-cyan-400 transition-colors"
                            >
                              <RefreshCw size={12} />
                            </button>
                          </div>
                        )}
                      </div>

                      {meetingSectionExpanded[l.id] && (
                        <div className="mt-2 space-y-2">
                          {meetingsLoading[l.id] && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                              <Loader2 size={14} className="animate-spin" />
                              {l.email
                                ? `Loading linked meetings and Read.ai matches for ${l.email}…`
                                : 'Loading linked meetings…'}
                            </div>
                          )}

                          {!meetingsLoading[l.id] && (meetingsByLead[l.id]?.length ?? 0) === 0 && (
                            <p className="text-sm text-muted-foreground/90 py-1">
                              {l.email
                                ? `No meetings are linked to this lead in Meeting records, and nothing turned up in Read.ai for ${l.email} in the last 30 days.`
                                : 'No meetings are linked to this lead in Meeting records.'}
                            </p>
                          )}

                          {(meetingsByLead[l.id] || []).map((m) => {
                            const isSelected = selectedMeetingIds[l.id]?.has(m.id) ?? false
                            const date = new Date(m.start_time_ms)
                            return (
                              <label
                                key={m.id}
                                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'border-cyan-500 bg-cyan-900/20'
                                    : 'border-silicon-slate/60 bg-silicon-slate/30 hover:border-silicon-slate'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleMeeting(l.id, m.id)}
                                  className="mt-1 rounded border-silicon-slate bg-silicon-slate/50 text-cyan-400 focus:ring-cyan-400"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-white truncate">{m.title}</span>
                                    <span className="text-xs text-muted-foreground/90 shrink-0">
                                      {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground/90 mt-0.5">
                                    {m.participants.map((p) => p.name).filter(Boolean).join(', ')}
                                    {m.platform && (
                                      <span className="ml-1 capitalize">
                                        · {m.platform === 'record' ? 'Record' : m.platform}
                                      </span>
                                    )}
                                  </div>
                                  {m.summary && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.summary}</p>
                                  )}
                                </div>
                              </label>
                            )
                          })}

                          {(selectedMeetingIds[l.id]?.size ?? 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => handleImportMeetings(l.id)}
                              disabled={meetingImportLoading}
                              className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {meetingImportLoading ? (
                                <><Loader2 size={14} className="animate-spin" /> Importing...</>
                              ) : (
                                <>Import {selectedMeetingIds[l.id].size} meeting{selectedMeetingIds[l.id].size > 1 ? 's' : ''} into enrichment</>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                  {/* Review Meeting Notes — pending approval */}
                  {(pendingMeetingImports[l.id]?.length ?? 0) > 0 && (
                    <div className="pt-3 border-t border-silicon-slate">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-amber-400 flex items-center gap-2">
                          <AlertTriangle size={14} />
                          Review Meeting Notes ({pendingMeetingImports[l.id].length} pending)
                        </h4>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleApproveAllMeetingImports(l.id)}
                            className="px-2 py-1 text-xs font-medium rounded bg-green-900/50 text-green-400 border border-green-700 hover:bg-green-800/50"
                          >
                            Approve all
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeclineAllMeetingImports(l.id)}
                            className="px-2 py-1 text-xs font-medium rounded bg-red-900/50 text-red-400 border border-red-700 hover:bg-red-800/50"
                          >
                            Decline all
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {pendingMeetingImports[l.id].map((item, idx) => (
                          <div
                            key={`${item.meetingId}-${item.type}-${idx}`}
                            className="p-3 rounded-lg border border-amber-700/50 bg-amber-900/10"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                                  item.type === 'pain_points'
                                    ? 'bg-red-900/50 text-red-400'
                                    : 'bg-green-900/50 text-green-400'
                                }`}>
                                  {item.type === 'pain_points' ? 'Pain point' : 'Quick win'}
                                </span>
                                <span className="text-xs text-muted-foreground/90">
                                  {item.meetingTitle} ({item.meetingDate})
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleApproveMeetingImport(l.id, idx)}
                                  className="p-1 rounded hover:bg-green-900/50 text-green-400 transition-colors"
                                  title="Approve"
                                >
                                  <CheckCircle size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeclineMeetingImport(l.id, idx)}
                                  className="p-1 rounded hover:bg-red-900/50 text-red-400 transition-colors"
                                  title="Decline"
                                >
                                  <XCircle size={16} />
                                </button>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                              {item.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Classified pain points preview */}
                  {(enrichClassifiedItems[l.id]?.length ?? 0) > 0 && (
                    <div className="pt-3 border-t border-silicon-slate">
                      <h4 className="text-sm font-medium text-purple-400 mb-2 flex items-center gap-2">
                        <BarChart3 size={14} />
                        Classified Pain Points ({enrichClassifiedItems[l.id].length})
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {enrichClassifiedItems[l.id].map((item, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 rounded text-xs bg-purple-900/30 text-purple-300 border border-purple-700/50"
                            title={`${item.text}\n\nCategory: ${item.categoryDisplayName}\nConfidence: ${(item.confidence * 100).toFixed(0)}%\nMethod: ${item.method}`}
                          >
                            {item.categoryDisplayName} ({(item.confidence * 100).toFixed(0)}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {enrichModalLeads.length === 1 && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="unified-rerun-enrichment"
                    checked={unifiedModalReRunEnrichment}
                    onChange={(e) => setUnifiedModalReRunEnrichment(e.target.checked)}
                    className="rounded border-silicon-slate bg-silicon-slate/50 text-radiant-gold focus:ring-radiant-gold"
                  />
                  <label htmlFor="unified-rerun-enrichment" className="text-sm text-muted-foreground">
                    Re-run enrichment (send updated data to lead qualification workflow)
                  </label>
                </div>
              )}
              {unifiedModalSaveError && (
                <div className="p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm flex items-center gap-2">
                  <AlertTriangle size={16} />
                  {unifiedModalSaveError}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-silicon-slate flex flex-col gap-3">
              {(() => {
                const allLeadsAlreadyHaveEvidence =
                  enrichModalLeads.length > 0 &&
                  enrichModalLeads.every((l) => (l.evidence_count ?? 0) > 0)
                const showClassifyPrimary =
                  enrichModalVepPushCompleted || allLeadsAlreadyHaveEvidence
                const hasClassifyPayload = enrichModalLeads.some((l) => {
                  const f = enrichModalForm[l.id]
                  const pain = (f?.rep_pain_points ?? l.rep_pain_points ?? '').trim()
                  const qw = (f?.quick_wins ?? quickWinsToEditableString(l.quick_wins as unknown)).trim()
                  return Boolean(pain || qw)
                })
                const anyExtractable = enrichModalLeads.some((l) => l.has_extractable_text)
                const classifyActive = Object.values(enrichClassifyLoading).some(Boolean)
                const classifyDone =
                  enrichModalLeads.length > 0 &&
                  enrichModalLeads.every(
                    (l) => (enrichClassifiedItems[l.id]?.length ?? 0) > 0,
                  )
                const totalClassifiedItems = enrichModalLeads.reduce(
                  (sum, l) => sum + (enrichClassifiedItems[l.id]?.length ?? 0),
                  0,
                )

                // Step 1 — "Push to VEP": skipped when evidence already exists,
                // running while the webhook is in flight, done once the app has
                // received the extract-leads 200, idle otherwise.
                const step1State: StepState = allLeadsAlreadyHaveEvidence
                  ? 'skipped'
                  : pushLoading
                  ? 'running'
                  : enrichModalVepPushCompleted
                  ? 'done'
                  : 'idle'

                // Step 2 — "Classify & Store": locked until step 1 finishes (or
                // evidence is already present), running during the classifier
                // call, done after at least one evidence row is returned.
                const step2State: StepState = classifyActive
                  ? 'running'
                  : classifyDone
                  ? 'done'
                  : showClassifyPrimary
                  ? 'idle'
                  : 'locked'

                const pushProgress =
                  pushLoading && vepPushStartedAt != null
                    ? estimateMilestoneProgress(
                        VEP_PUSH_STAGES,
                        VEP_PUSH_TYPICAL_S,
                        nowTick - vepPushStartedAt,
                      )
                    : null
                const classifyProgress =
                  classifyActive && classifyStartedAt != null
                    ? estimateMilestoneProgress(
                        CLASSIFY_STAGES,
                        CLASSIFY_TYPICAL_S,
                        nowTick - classifyStartedAt,
                      )
                    : null

                return (
                  <>
                    {/* Value Evidence pipeline status panel.
                        Always rendered so users can see — at a glance — that
                        this is a two-step pipeline distinct from email
                        generation, which step is active, and why a button
                        might be disabled (missing payload vs processing). */}
                    <div
                      className="rounded-lg border border-silicon-slate bg-silicon-slate/20 p-3"
                      role="region"
                      aria-label="Value Evidence pipeline status"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <Cpu size={14} className="text-purple-300" aria-hidden />
                        <p className="text-sm font-medium text-white leading-tight">
                          Value Evidence pipeline
                        </p>
                        <span className="text-[11px] font-normal text-muted-foreground">
                          · separate from email generation
                        </span>
                      </div>

                      <div className="flex items-stretch gap-2">
                        <StepCard
                          index={1}
                          title="Push to VEP"
                          state={step1State}
                          subtitle={
                            step1State === 'skipped'
                              ? 'Skipped — evidence already on file'
                              : step1State === 'running'
                              ? pushProgress?.currentStageLabel ?? 'Contacting n8n…'
                              : step1State === 'done'
                              ? 'Pushed · ready to classify'
                              : !anyExtractable
                              ? 'Add notes or diagnostic data above'
                              : 'Send raw notes to n8n WF-VEP-001'
                          }
                        />
                        <StepCard
                          index={2}
                          title="Classify & store"
                          state={step2State}
                          subtitle={
                            step2State === 'running'
                              ? classifyProgress?.currentStageLabel ??
                                'Classifying…'
                              : step2State === 'done'
                              ? `Stored ${totalClassifiedItems} evidence row${totalClassifiedItems === 1 ? '' : 's'}`
                              : step2State === 'locked'
                              ? 'Unlocks after step 1 completes'
                              : !hasClassifyPayload
                              ? 'Add pain points or quick wins above'
                              : 'Classify and save evidence rows'
                          }
                        />
                      </div>

                      {pushProgress && (
                        <div className="mt-3" aria-live="polite">
                          <p className="mb-1 text-[11px] font-medium text-amber-200">
                            Step 1 of 2 · Pushing to Value Evidence
                          </p>
                          <PipelineProgressBar
                            progressPct={pushProgress.progressPct}
                            stageLabel={pushProgress.currentStageLabel}
                            stale={false}
                            barOnly
                          />
                        </div>
                      )}
                      {classifyProgress && (
                        <div className="mt-3" aria-live="polite">
                          <p className="mb-1 text-[11px] font-medium text-purple-200">
                            Step 2 of 2 · Classifying &amp; storing evidence
                          </p>
                          <PipelineProgressBar
                            progressPct={classifyProgress.progressPct}
                            stageLabel={classifyProgress.currentStageLabel}
                            stale={false}
                            barOnly
                          />
                        </div>
                      )}

                      {/* Inline hints that replace the silent "button is grey" state. */}
                      {step2State === 'idle' && !hasClassifyPayload && (
                        <div className="mt-2 flex items-start gap-2 rounded border border-amber-800/60 bg-amber-900/20 px-2 py-1.5 text-[11px] text-amber-200">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden />
                          <span>
                            Add pain points or quick wins above, then click{' '}
                            <span className="font-semibold">Classify &amp; Store Evidence</span> to run the classifier.
                          </span>
                        </div>
                      )}
                      {enrichClassifyError && (
                        <div className="mt-2 flex items-start gap-2 rounded border border-red-800/60 bg-red-900/25 px-2 py-1.5 text-[11px] text-red-300">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden />
                          <span>Classify failed: {enrichClassifyError}</span>
                        </div>
                      )}
                      {step2State === 'done' && !classifyActive && (
                        <div className="mt-2 flex items-start gap-2 rounded border border-green-800/60 bg-green-900/20 px-2 py-1.5 text-[11px] text-green-200">
                          <CheckCircle size={12} className="mt-0.5 shrink-0" aria-hidden />
                          <span>
                            Stored {totalClassifiedItems} evidence row
                            {totalClassifiedItems === 1 ? '' : 's'}. You can close this modal.
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => !pushLoading && !unifiedModalSaveLoading && onClose()}
                        disabled={pushLoading || unifiedModalSaveLoading}
                        className="px-4 py-2 bg-silicon-slate/50 hover:bg-silicon-slate rounded-lg disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={
                          pushLoading ||
                          unifiedModalSaveLoading ||
                          enrichModalLeads.some((l) => !(enrichModalForm[l.id]?.name ?? l.name)?.trim())
                        }
                        onClick={async () => {
                          const session = await getCurrentSession()
                          if (!session) return
                          setUnifiedModalSaveError(null)
                          setUnifiedModalSaveLoading(true)
                          try {
                            for (const l of enrichModalLeads) {
                              const f = enrichModalForm[l.id]
                              const name = (f?.name ?? l.name ?? '').trim()
                              if (!name) continue
                              const payload = {
                                name,
                                email: (f?.email ?? l.email ?? '').trim() || undefined,
                                company: (f?.company ?? l.company ?? '').trim() || undefined,
                                company_domain: (f?.company_domain ?? l.company_domain ?? '').trim() || undefined,
                                linkedin_url: (f?.linkedin_url ?? l.linkedin_url ?? '').trim() || undefined,
                                job_title: (f?.job_title ?? l.job_title ?? '').trim() || undefined,
                                industry: (f?.industry ?? l.industry ?? '').trim() || undefined,
                                phone_number: (f?.phone_number ?? l.phone_number ?? '').trim() || undefined,
                                message: (f?.message ?? l.message ?? '').trim() || undefined,
                                input_type: f?.input_type ?? inputTypeFromLeadSource(l.lead_source),
                                employee_count: (f?.employee_count ?? l.employee_count ?? '').trim() || undefined,
                                quick_wins:
                                  (f?.quick_wins ?? quickWinsToEditableString(l.quick_wins as unknown)).trim() ||
                                  undefined,
                                rep_pain_points: (f?.rep_pain_points ?? l.rep_pain_points ?? '').trim() || undefined,
                                re_run_enrichment: enrichModalLeads.length === 1 ? unifiedModalReRunEnrichment : false,
                              }
                              const res = await fetch(`/api/admin/outreach/leads/${l.id}`, {
                                method: 'PATCH',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${session.access_token}`,
                                },
                                body: JSON.stringify(payload),
                              })
                              const data = await res.json().catch(() => ({}))
                              if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
                            }
                            onClose()
                            onSelectedLeadsClear()
                            await fetchLeads()
                          } catch (err) {
                            setUnifiedModalSaveError(err instanceof Error ? err.message : 'Failed to save')
                          } finally {
                            setUnifiedModalSaveLoading(false)
                          }
                        }}
                        className="px-4 py-2 bg-silicon-slate hover:bg-silicon-slate rounded-lg font-medium disabled:opacity-50"
                      >
                        {unifiedModalSaveLoading ? 'Saving...' : 'Save changes'}
                      </button>
                      {showClassifyPrimary ? (
                        <button
                          type="button"
                          disabled={
                            !hasClassifyPayload ||
                            Object.values(enrichClassifyLoading).some(Boolean) ||
                            pushLoading ||
                            unifiedModalSaveLoading
                          }
                          title={
                            !hasClassifyPayload
                              ? 'Add pain points or quick wins above to classify'
                              : undefined
                          }
                          onClick={async () => {
                            const session = await getCurrentSession()
                            if (!session) return
                            setEnrichClassifyError(null)
                            setClassifyStartedAt(Date.now())
                            try {
                              for (const l of enrichModalLeads) {
                                const form = enrichModalForm[l.id]
                                const painPoints = form?.rep_pain_points ?? l.rep_pain_points ?? ''
                                const quickWins =
                                  form?.quick_wins ?? quickWinsToEditableString(l.quick_wins as unknown)
                                if (!painPoints.trim() && !quickWins.trim()) continue
                                setEnrichClassifyLoading((prev) => ({ ...prev, [l.id]: true }))
                                try {
                                  const res = await fetch('/api/admin/meetings/classify-pain-points', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      Authorization: `Bearer ${session.access_token}`,
                                    },
                                    body: JSON.stringify({
                                      pain_points: painPoints,
                                      quick_wins: quickWins,
                                      contact_submission_id: l.id,
                                      insert_evidence: true,
                                    }),
                                  })
                                  const data = await res.json().catch(() => ({}))
                                  if (!res.ok) {
                                    throw new Error(data.error || `Request failed (${res.status})`)
                                  }
                                  if (data.classified) {
                                    setEnrichClassifiedItems((prev) => ({ ...prev, [l.id]: data.classified }))
                                  }
                                } catch (err) {
                                  console.error('Classify failed:', err)
                                  setEnrichClassifyError(
                                    err instanceof Error ? err.message : 'Unknown error',
                                  )
                                } finally {
                                  setEnrichClassifyLoading((prev) => ({ ...prev, [l.id]: false }))
                                }
                              }
                            } finally {
                              setClassifyStartedAt(null)
                            }
                          }}
                          className="px-4 py-2 bg-purple-600/80 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-2"
                        >
                          {classifyActive ? (
                            <>
                              <Loader2 size={14} className="animate-spin" aria-hidden />
                              Classifying…
                            </>
                          ) : classifyDone ? (
                            'Re-classify'
                          ) : (
                            'Classify & Store Evidence'
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={pushLoading || unifiedModalSaveLoading || !anyExtractable}
                          title={
                            !anyExtractable
                              ? 'Add notes, diagnostic, or report data before pushing'
                              : undefined
                          }
                          onClick={async () => {
                            const session = await getCurrentSession()
                            if (!session) return
                            setPushLoading(true)
                            setVepPushStartedAt(Date.now())
                            try {
                              const leadsPayload = enrichModalLeads.map((l) => {
                                const form = enrichModalForm[l.id]
                                const base = { contact_submission_id: l.id }
                                const vals = {
                                  rep_pain_points: form?.rep_pain_points ?? l.rep_pain_points,
                                  message: form?.message ?? l.message,
                                  quick_wins:
                                    form?.quick_wins ?? quickWinsToEditableString(l.quick_wins as unknown),
                                  industry: form?.industry ?? l.industry,
                                  employee_count: form?.employee_count ?? l.employee_count,
                                  company: form?.company ?? l.company,
                                  company_domain: form?.company_domain ?? l.company_domain,
                                }
                                return {
                                  ...base,
                                  ...Object.fromEntries(
                                    Object.entries(vals).filter(([, v]) => v != null && String(v).trim())
                                  ),
                                }
                              })
                              const res = await fetch('/api/admin/value-evidence/extract-leads', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${session.access_token}`,
                                },
                                body: JSON.stringify({ leads: leadsPayload }),
                              })
                              const data = await res.json()
                              if (!res.ok) throw new Error(data.error || 'Request failed')
                              setEnrichModalVepPushCompleted(true)
                              startVepPolling()
                              onSelectedLeadsClear()
                              await fetchLeads()
                            } catch (e) {
                              console.error(e)
                            } finally {
                              setPushLoading(false)
                              setVepPushStartedAt(null)
                            }
                          }}
                          className="px-4 py-2 btn-gold text-imperial-navy hover:opacity-90 disabled:opacity-50 rounded-lg font-medium flex items-center gap-2"
                        >
                          {pushLoading ? (
                            <>
                              <Loader2 size={14} className="animate-spin" aria-hidden />
                              Pushing…
                            </>
                          ) : (
                            'Push to Value Evidence'
                          )}
                        </button>
                      )}
                    </div>
                  </>
                )
              })()}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
