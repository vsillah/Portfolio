'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Calendar,
  ChevronDown,
  CheckCircle,
  FileText,
  Loader2,
  Mail,
  X,
  AlertCircle,
  RotateCcw,
  ExternalLink,
  Sparkles,
  MessageSquare,
  HelpCircle,
  Eye,
} from 'lucide-react'
import { PipelineProgressBar } from '@/components/admin/ExtractionStatusChip'
import { getCurrentSession } from '@/lib/auth'
import { useOutreachGeneration } from '@/lib/hooks/useOutreachGeneration'
import {
  EMAIL_TEMPLATE_KEYS,
  LINKEDIN_TEMPLATE_KEYS,
  getPromptDisplayName,
  type EmailTemplateKey,
  type LinkedInTemplateKey,
  type OutreachChannel,
} from '@/lib/constants/prompt-keys'
import { estimateMilestoneProgress, type PipelineStage } from '@/lib/pipeline-progress'
import WhyThisDraftModal, {
  type WhyThisDraftRequest,
} from '@/components/admin/outreach/WhyThisDraftModal'

// Generation pipeline stages used by the in-flight progress bar. The same
// labels apply to the in-app path because /generate is now the in-app generator.
const GENERATE_STAGES: PipelineStage[] = [
  { label: 'Building prompt', startsAt: 0 },
  { label: 'Calling model', startsAt: 3 },
  { label: 'Saving draft', startsAt: 20 },
]
const GENERATE_TYPICAL_S = 45

const INAPP_STAGES: PipelineStage[] = [
  { label: 'Loading lead context', startsAt: 0 },
  { label: 'Calling model', startsAt: 4 },
  { label: 'Saving draft', startsAt: 20 },
]
const INAPP_TYPICAL_S = 42

type Channel = OutreachChannel

type SuggestedReason =
  | 'converted_client'
  | 'proposal_sent'
  | 'meeting_delivered'
  | 'post_meeting'
  | 'has_assets'
  | 'cold'

const REASON_LABELS: Record<SuggestedReason, string> = {
  converted_client: 'converted client — welcome onboarding',
  proposal_sent: 'proposal sent — follow up on delivery',
  meeting_delivered: 'delivery sent — follow up',
  post_meeting: 'post-meeting — keep momentum',
  has_assets: 'assets ready — deliver them',
  cold: 'cold lead — first touch',
}

/** Shown on hover of the run cancel (X) control only. */
const CANCEL_BUTTON_HELP =
  'Stops this screen from waiting. The model may still finish in the background and the draft can show up in the queue.'

function timeAgo(date: string): string {
  const ms = Date.now() - new Date(date).getTime()
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export interface RecentEmailDraftItem {
  id: string
  subject: string | null
  status: string
  created_at: string
  /**
   * Optional email_messages.id so the Outreach menu can deep-link each recent
   * row to /admin/email-messages/[id]. Null when no email_messages row has
   * been indexed yet (e.g. workflow still running or indexer hasn't caught up).
   */
  email_message_id?: string | null
}

export interface OutreachEmailGenerateRowProps {
  lead: {
    id: number
    name: string
    messages_count: number
    messages_sent?: number
    do_not_contact?: boolean
    removed_at?: string | null
    /** Server state (DB); mirrors value-evidence VEP last_vep_* pattern */
    last_n8n_outreach_status?: 'pending' | 'success' | 'failed' | null
    last_n8n_outreach_triggered_at?: string | null
    last_n8n_outreach_template_key?: string | null
    recent_email_drafts?: RecentEmailDraftItem[]
  }
  onToast?: (msg: string) => void
  onFallbackAvailable?: () => void
  onSettled?: () => void
  /** Fire when the Outreach menu opens so the parent can refetch queue rows (Email — recent). */
  onOutreachOpen?: () => void
  onFallbackCleared?: () => void
  n8nFallback?: boolean
}

export function OutreachEmailGenerateRow({
  lead,
  onToast,
  onFallbackAvailable,
  onSettled,
  onOutreachOpen,
  onFallbackCleared,
  n8nFallback = false,
}: OutreachEmailGenerateRowProps) {
  const { state, elapsedMs, phaseLabel, start, cancel, retry, dismissResult } = useOutreachGeneration({
    leadId: lead.id,
    leadName: lead.name,
    messagesCount: lead.messages_count,
    n8nStatus: lead.last_n8n_outreach_status ?? null,
    n8nTriggeredAt: lead.last_n8n_outreach_triggered_at ?? null,
    onToast,
    onFallbackAvailable,
    onSettled,
    onFallbackCleared,
  })

  const [panelOpen, setPanelOpen] = useState(false)
  const [channel, setChannel] = useState<Channel>('email')
  const [suggested, setSuggested] = useState<{ template: EmailTemplateKey; reason: SuggestedReason } | null>(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const panelWasOpenRef = useRef(false)
  const inAppAbortRef = useRef<AbortController | null>(null)
  const [inAppRunning, setInAppRunning] = useState(false)
  const inAppStartRef = useRef<number | null>(null)
  const [inAppElapsedMs, setInAppElapsedMs] = useState(0)
  const [inAppLoading, setInAppLoading] = useState(false)
  const [whyRequest, setWhyRequest] = useState<WhyThisDraftRequest | null>(null)

  /** `meeting_records.id` for prompt + dedup; empty = server uses latest meeting for this lead. */
  const [outreachMeetingId, setOutreachMeetingId] = useState('')
  const [meetingsList, setMeetingsList] = useState<
    { id: string; meeting_date: string; meeting_type: string | null }[]
  >([])
  const [meetingsLoading, setMeetingsLoading] = useState(false)
  const [meetingsError, setMeetingsError] = useState(false)

  const loadMeetingsForLead = useCallback(async () => {
    setMeetingsLoading(true)
    setMeetingsError(false)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) {
        setMeetingsList([])
        return
      }
      const res = await fetch(
        `/api/admin/meetings?contact_submission_id=${lead.id}&limit=50&offset=0`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      )
      if (!res.ok) {
        setMeetingsError(true)
        setMeetingsList([])
        return
      }
      const data = (await res.json()) as {
        meetings?: { id: string; meeting_date: string; meeting_type: string | null }[]
      }
      setMeetingsList(data.meetings ?? [])
    } catch {
      setMeetingsError(true)
      setMeetingsList([])
    } finally {
      setMeetingsLoading(false)
    }
  }, [lead.id])

  useEffect(() => {
    setOutreachMeetingId('')
    setMeetingsList([])
  }, [lead.id])

  useEffect(() => {
    void loadMeetingsForLead()
  }, [loadMeetingsForLead])

  useEffect(() => {
    if (panelOpen) void loadMeetingsForLead()
  }, [panelOpen, loadMeetingsForLead])

  const recent = lead.recent_email_drafts ?? []
  const dnc = Boolean(lead.do_not_contact || lead.removed_at)
  const serverN8nPending = lead.last_n8n_outreach_status === 'pending'
  const serverN8nSuccess = lead.last_n8n_outreach_status === 'success'
  const serverN8nFailed = lead.last_n8n_outreach_status === 'failed'
  const n8nActive = (state === 'running' || serverN8nPending) && !inAppRunning
  const anyRun = n8nActive || inAppRunning
  const [, bumpServerN8nProgress] = useState(0)
  useEffect(() => {
    if (!serverN8nPending || inAppRunning) return
    const id = window.setInterval(() => bumpServerN8nProgress((n) => n + 1), 300)
    return () => window.clearInterval(id)
  }, [serverN8nPending, inAppRunning])
  const n8nEffectiveElapsed =
    serverN8nPending && lead.last_n8n_outreach_triggered_at
      ? Date.now() - new Date(lead.last_n8n_outreach_triggered_at).getTime()
      : elapsedMs
  // Do not use serverN8nSuccess alone while the hook is in `running` — a new run
  // can start before the lead refetch clears last_n8n, which produced "Draft ready"
  // plus "Generating…" and misled users that Email center should already show the new draft.
  const showN8nBarSuccess =
    (state === 'succeeded' || (serverN8nSuccess && state === 'idle')) && !inAppRunning
  const progressN8n = useMemo(
    () => (n8nActive ? estimateMilestoneProgress(GENERATE_STAGES, GENERATE_TYPICAL_S, n8nEffectiveElapsed) : null),
    [n8nActive, n8nEffectiveElapsed],
  )
  const progressInApp = useMemo(
    () => (inAppRunning ? estimateMilestoneProgress(INAPP_STAGES, INAPP_TYPICAL_S, inAppElapsedMs) : null),
    [inAppRunning, inAppElapsedMs],
  )
  const progress = inAppRunning ? progressInApp : progressN8n
  const phaseDisplay = inAppRunning
    ? (progressInApp?.currentStageLabel ?? 'Working…')
    : serverN8nPending && state !== 'running'
      ? (progressN8n?.currentStageLabel ?? phaseLabel)
      : phaseLabel
  const messagesSent = lead.messages_sent ?? 0
  /** One line for n8n vs in-app; keep in sync across split control, menu, and compact card. */
  const runningHeadline = inAppRunning ? 'Generating draft' : 'Running outreach'

  const fetchSuggested = useCallback(async () => {
    setSuggestLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const res = await fetch(`/api/admin/outreach/leads/${lead.id}/suggested-template`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const data = (await res.json()) as { template: EmailTemplateKey; reason: SuggestedReason }
      if (data?.template) setSuggested(data)
    } catch {
      // non-fatal
    } finally {
      setSuggestLoading(false)
    }
  }, [lead.id])

  /** Open (idle) or toggle (while a run is active) the same outreach + queue menu. */
  const openOrToggleOutreach = useCallback(() => {
    if (anyRun) {
      setPanelOpen((o) => !o)
      return
    }
    setChannel('email')
    setPanelOpen(true)
    void fetchSuggested()
  }, [anyRun, fetchSuggested])

  useEffect(() => {
    if (!inAppRunning || !inAppStartRef.current) {
      inAppStartRef.current = null
      setInAppElapsedMs(0)
      return
    }
    const t = () => {
      if (inAppStartRef.current) setInAppElapsedMs(Date.now() - inAppStartRef.current)
    }
    t()
    const id = window.setInterval(t, 300)
    return () => window.clearInterval(id)
  }, [inAppRunning])

  useEffect(() => {
    if (panelOpen && !panelWasOpenRef.current) {
      onOutreachOpen?.()
    }
    panelWasOpenRef.current = panelOpen
  }, [panelOpen, onOutreachOpen])

  useEffect(() => {
    if (!panelOpen) return
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setPanelOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [panelOpen])

  const runInApp = useCallback(
    async (force?: boolean) => {
      if (dnc) return
      inAppAbortRef.current?.abort()
      const ac = new AbortController()
      inAppAbortRef.current = ac
      setInAppLoading(true)
      inAppStartRef.current = Date.now()
      setInAppRunning(true)
      setInAppElapsedMs(0)
      setPanelOpen(true)
      try {
        const session = await getCurrentSession()
        if (!session?.access_token) {
          onToast?.('Please sign in to continue.')
          return
        }
        const res = await fetch(`/api/admin/outreach/leads/${lead.id}/generate-in-app`, {
          method: 'POST',
          signal: ac.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(
            force
              ? {
                  force: true,
                  ...(outreachMeetingId ? { meeting_record_id: outreachMeetingId } : {}),
                }
              : {
                  ...(outreachMeetingId ? { meeting_record_id: outreachMeetingId } : {}),
                },
          ),
        })
        const data = (await res.json().catch(() => ({}))) as {
          outcome?: string
          error?: string
          openDraftUrl?: string
        }
        if (ac.signal.aborted) return
        if (res.ok && data.outcome === 'existing' && data.openDraftUrl) {
          if (typeof window !== 'undefined') {
            window.open(data.openDraftUrl, '_blank', 'noopener,noreferrer')
          }
          onToast?.(
            `A draft for this template and meeting already exists for ${lead.name} — opening it in a new tab.`,
          )
          onSettled?.()
        } else if (res.ok && data.outcome === 'created') {
          onToast?.(`Draft saved for ${lead.name} — check Email center`)
          onFallbackCleared?.()
          onSettled?.()
        } else if (res.status === 409 && data.error) {
          onToast?.(data.error)
        } else if (data.error) {
          onToast?.(data.error)
        } else {
          onToast?.('We could not create that draft. Please try again.')
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        onToast?.('We could not create that draft. Please try again.')
      } finally {
        if (inAppAbortRef.current === ac) inAppAbortRef.current = null
        inAppStartRef.current = null
        setInAppRunning(false)
        setInAppLoading(false)
        setInAppElapsedMs(0)
      }
    },
    [dnc, lead.id, lead.name, onFallbackCleared, onSettled, onToast, outreachMeetingId],
  )

  const onCancel = useCallback(async () => {
    if (inAppRunning && inAppAbortRef.current) {
      inAppAbortRef.current.abort()
      onToast?.('Stopped the in-app request. If a row appears, check the queue.')
      inAppStartRef.current = null
      setInAppRunning(false)
      setInAppLoading(false)
      return
    }
    if (serverN8nPending) {
      const session = await getCurrentSession()
      if (session?.access_token) {
        const res = await fetch(`/api/admin/outreach/leads/${lead.id}/n8n-outreach-pending-cancel`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) {
          onToast?.('Could not update status. Try again.')
          return
        }
        onSettled?.()
      }
    }
    if (state === 'running') {
      cancel()
    }
  }, [cancel, inAppRunning, lead.id, onSettled, onToast, serverN8nPending, state])

  const contactHref = `/admin/contacts/${lead.id}?focus=compose${
    suggested?.template ? `&template=${suggested.template}` : ''
  }#compose`
  const emailCenterHref = `/admin/email-center?contact=${lead.id}`

  const meetingIdForRequest = outreachMeetingId.trim() || undefined

  const runGenerate = (
    key?: EmailTemplateKey | LinkedInTemplateKey,
    targetChannel: Channel = channel,
  ) => {
    void start(key, targetChannel, meetingIdForRequest)
  }

  const pickTemplate = (
    key: EmailTemplateKey | LinkedInTemplateKey,
    targetChannel: Channel = channel,
  ) => {
    runGenerate(key, targetChannel)
  }

  const activitySummary = useMemo(() => {
    if (anyRun && progress) {
      return `${runningHeadline} — ${progress.currentStageLabel}`
    }
    if (state === 'succeeded' || serverN8nSuccess) return 'Draft created'
    if (state === 'cancelled') return 'Stopped'
    if (state === 'failed' && n8nFallback) return 'Generation failed'
    if (state === 'failed' || serverN8nFailed) return 'Generation failed'
    if (lead.messages_count === 0) return 'No activity yet'
    if (messagesSent > 0) {
      return `${lead.messages_count} in queue, ${messagesSent} sent`
    }
    return `${lead.messages_count} in queue`
  }, [anyRun, progress, state, n8nFallback, serverN8nSuccess, serverN8nFailed, lead.messages_count, messagesSent, runningHeadline])

  const queueCountLabel = useMemo(() => {
    if (lead.messages_count === 0) return null
    if (messagesSent > 0) {
      return `${lead.messages_count} in queue, ${messagesSent} sent`
    }
    return `${lead.messages_count} in queue`
  }, [lead.messages_count, messagesSent])

  const dismissN8nBar = useCallback(async () => {
    const session = await getCurrentSession()
    if (session?.access_token) {
      const res = await fetch(`/api/admin/outreach/leads/${lead.id}/n8n-outreach-ack`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        onToast?.('Could not dismiss. Try again.')
        return
      }
    }
    onSettled?.()
    dismissResult()
  }, [dismissResult, lead.id, onSettled, onToast])

  if (dnc) return null

  const showProgressCard = Boolean(anyRun && progress && !panelOpen)

  let outreachBar: ReactNode
  if (showN8nBarSuccess) {
    outreachBar = (
      <div
        className="inline-flex h-9 min-h-11 w-full min-w-0 max-w-sm items-stretch justify-between gap-0 overflow-hidden rounded-lg bg-emerald-600/90 text-sm font-medium text-white"
        role="status"
      >
        <button
          type="button"
          className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 bg-transparent py-1.5 pl-2.5 pr-1 text-white hover:underline"
          onClick={() => {
            setPanelOpen(true)
          }}
          title="Outreach options and email history for this lead"
          aria-label={`Draft ready for ${lead.name} — open Outreach panel`}
        >
          <CheckCircle size={14} className="shrink-0" />
          <span className="truncate">Draft ready</span>
          {queueCountLabel && (
            <span className="ml-0.5 hidden truncate text-xs font-normal text-white/80 sm:inline" title={queueCountLabel}>
              · {queueCountLabel}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/85" aria-hidden />
        </button>
        <Link
          href={emailCenterHref}
          className="inline-flex max-w-[45%] shrink-0 items-center justify-center gap-1 border-l border-white/20 px-2.5 text-xs font-semibold text-white/95 no-underline hover:bg-white/10"
          title="View this lead in Email center (queue and send history)"
          onClick={() => {
            setPanelOpen(false)
          }}
        >
          <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">Email center</span>
        </Link>
        <button
          type="button"
          className="shrink-0 border-l border-white/20 px-1.5 text-white/90 hover:bg-white/15"
          title="Clear this success state (draft stays in the queue)"
          aria-label="Dismiss draft ready"
          onClick={() => {
            void dismissN8nBar()
          }}
        >
          <X size={16} className="mx-0.5" />
        </button>
      </div>
    )
  } else if (state === 'cancelled') {
    outreachBar = (
      <div className="inline-flex h-9 min-h-11 w-full min-w-0 max-w-sm items-center gap-2 rounded-lg border border-silicon-slate bg-silicon-slate/40 px-3 text-sm text-muted-foreground">
        <X size={14} className="shrink-0" />
        <span>Stopped</span>
        {queueCountLabel && <span className="truncate text-xs">· {queueCountLabel}</span>}
      </div>
    )
  } else if (
    (state === 'failed' && !n8nActive && !inAppRunning && !n8nFallback) ||
    (serverN8nFailed && !n8nActive && !inAppRunning)
  ) {
    outreachBar = (
      <div className="flex w-full min-w-0 max-w-sm flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
        <button
          type="button"
          onClick={() => {
            void retry()
          }}
          className="inline-flex h-9 min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-red-700/60 bg-red-950/40 px-3 text-sm font-medium text-red-200 hover:bg-red-950/60"
        >
          <RotateCcw size={14} className="shrink-0" />
          <span>Retry generation</span>
          <AlertCircle size={12} className="opacity-70" />
        </button>
        {queueCountLabel && (
          <span
            className="inline-flex min-w-0 items-center gap-1.5 pl-0.5 text-left text-xs text-muted-foreground sm:pl-0"
            title={queueCountLabel}
          >
            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{queueCountLabel}</span>
          </span>
        )}
      </div>
    )
  } else if (anyRun) {
    const phase = progress?.currentStageLabel ?? phaseDisplay
    const runningTitle = queueCountLabel
      ? `${runningHeadline} — ${phase} · ${queueCountLabel} · open for details`
      : `${runningHeadline} — ${phase} · open for details`
    outreachBar = (
      <div
        className="flex w-full min-w-0 max-w-sm overflow-hidden rounded-lg border border-amber-500/50 min-h-11"
        role="group"
        aria-label={`${runningHeadline} for ${lead.name}`}
      >
        <button
          type="button"
          onClick={openOrToggleOutreach}
          className="inline-flex min-w-0 flex-1 items-center gap-1.5 bg-amber-950/40 pl-2.5 pr-1.5 text-left text-sm font-medium text-amber-100 transition-colors hover:bg-amber-950/60"
          title={runningTitle}
          aria-expanded={panelOpen}
          aria-haspopup="dialog"
        >
          <Loader2 size={16} className="shrink-0 animate-spin" />
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate font-medium">{runningHeadline}</span>
            <span className="block truncate text-xs font-normal text-amber-100/85">{phase}</span>
            {queueCountLabel && (
              <span className="mt-0.5 block truncate text-[10px] text-amber-100/75 sm:hidden">
                <FileText className="mb-0.5 mr-0.5 inline h-3 w-3 opacity-70" aria-hidden />
                {queueCountLabel}
              </span>
            )}
          </span>
          {queueCountLabel && (
            <span
              className="hidden min-w-0 max-w-[9.5rem] items-center gap-0.5 truncate sm:inline-flex"
              title={queueCountLabel}
            >
              <FileText className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              <span className="text-[10px] opacity-90">{queueCountLabel}</span>
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-amber-200/80 transition-transform ${
              panelOpen ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 border-l border-amber-500/30 bg-amber-950/50 px-2.5 text-amber-200 transition-colors hover:bg-amber-950/75"
          title={CANCEL_BUTTON_HELP}
          aria-label={CANCEL_BUTTON_HELP}
        >
          <X size={16} className="mx-auto" />
        </button>
      </div>
    )
  } else {
    outreachBar = (
      <button
        type="button"
        onClick={openOrToggleOutreach}
        onMouseEnter={() => {
          void fetchSuggested()
        }}
        className="inline-flex h-9 min-h-11 w-full min-w-0 max-w-sm items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:from-emerald-600 hover:to-teal-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        title={
          queueCountLabel
            ? `Outreach, templates, and queue for ${lead.name} (${queueCountLabel})`
            : `Outreach, templates, and history for ${lead.name}`
        }
        aria-expanded={panelOpen}
        aria-haspopup="dialog"
        aria-label={`Outreach. ${queueCountLabel ?? 'Open menu'}. ${activitySummary}.`}
      >
        <MessageSquare size={16} className="shrink-0" aria-hidden />
        <span className="shrink-0 font-semibold">Outreach</span>
        {queueCountLabel && (
          <>
            <span className="shrink-0 text-white/35" aria-hidden>
              |
            </span>
            <FileText className="h-3.5 w-3.5 shrink-0 text-white/85" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left text-xs font-medium text-white/90 sm:max-w-[10rem]">
              {queueCountLabel}
            </span>
          </>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/80 transition-transform ${
            panelOpen ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
    )
  }

  return (
    <div className="relative w-full min-w-0 max-w-md" ref={panelRef}>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">{outreachBar}</div>

      <div className="mt-1.5 w-full min-w-0 max-w-sm">
        <label
          htmlFor={`outreach-meeting-${lead.id}`}
          className="mb-0.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/90"
        >
          <Calendar className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
          Meeting for drafts
        </label>
        <select
          id={`outreach-meeting-${lead.id}`}
          className="h-9 w-full min-w-0 max-w-sm rounded-md border border-silicon-slate/90 bg-silicon-slate/30 px-2 pr-6 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50"
          value={outreachMeetingId}
          onChange={(e) => {
            setOutreachMeetingId(e.target.value)
          }}
          disabled={anyRun || inAppLoading}
          title="Which meeting’s notes to use for this draft. Default: latest by date for this lead."
        >
          <option value="">
            {meetingsLoading ? 'Loading meetings…' : 'Latest meeting (by date)'}
          </option>
          {meetingsList.map((m) => {
            const when = m.meeting_date
              ? new Date(m.meeting_date).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : '—'
            const type = (m.meeting_type && m.meeting_type.trim()) || 'Meeting'
            return (
              <option key={m.id} value={m.id}>
                {when} · {type}
              </option>
            )
          })}
        </select>
        {meetingsError && (
          <p className="mt-0.5 text-[10px] text-amber-200/90">Could not load meetings. Using latest is still available.</p>
        )}
      </div>

      {showProgressCard && (
        <div
          className="mt-1.5 w-full min-w-0 max-w-sm rounded-md border border-emerald-500/30 bg-emerald-950/20 p-2"
          aria-label={`Outreach: ${runningHeadline}`}
        >
          <p className="mb-1.5 text-[11px] font-medium leading-snug text-emerald-100/90">
            <span className="text-foreground/95">{runningHeadline}</span>
            {queueCountLabel && (
              <span className="font-normal text-muted-foreground">
                {' '}
                · {queueCountLabel}
              </span>
            )}
          </p>
          <PipelineProgressBar
            progressPct={progress!.progressPct}
            stageLabel={phaseDisplay}
            stale={false}
            barOnly
          />
        </div>
      )}

      <AnimatePresence>
        {panelOpen && (
          <motion.div
            key="outreach-panel"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full z-40 mt-1.5 w-[min(100vw-1.5rem,22rem)] overflow-hidden rounded-lg border border-silicon-slate bg-imperial-navy text-foreground shadow-2xl"
            role="dialog"
            aria-label="Outreach options"
          >
            <div className="border-b border-silicon-slate px-3 py-2.5">
              <p className="text-sm font-medium text-foreground">Outreach</p>
              <p className="text-[11px] text-muted-foreground">{lead.name}</p>
            </div>
            {anyRun && progress && (
              <div
                className="border-b border-amber-500/35 bg-amber-950/25 px-3 py-2.5"
                aria-live="polite"
                aria-label={`${runningHeadline} for ${lead.name}`}
              >
                <p className="mb-0.5 text-[11px] font-semibold text-amber-100/95">
                  {runningHeadline}
                  {queueCountLabel && (
                    <span className="ml-1 font-normal text-amber-100/75">· {queueCountLabel}</span>
                  )}
                </p>
                <p className="mb-1.5 text-[10px] text-amber-100/70">{phaseDisplay}</p>
                <PipelineProgressBar
                  progressPct={progress.progressPct}
                  stageLabel={phaseDisplay}
                  stale={false}
                  barOnly
                />
              </div>
            )}
            {showN8nBarSuccess && !anyRun && (
              <div
                className="border-b border-emerald-500/25 bg-emerald-950/20 px-3 py-2"
                role="status"
              >
                <p className="text-[11px] leading-relaxed text-emerald-100/90">
                  <Link
                    href={emailCenterHref}
                    onClick={() => {
                      setPanelOpen(false)
                    }}
                    className="font-medium text-sky-300/95 underline decoration-sky-400/35 underline-offset-2 hover:decoration-sky-300/60"
                  >
                    Open Email center
                  </Link>
                  <span className="text-emerald-100/75">
                    {" — this contact's email queue. Refresh the list below if the new row is still syncing."}
                  </span>
                </p>
              </div>
            )}
            <div
              className="flex border-b border-silicon-slate/80"
              role="tablist"
              aria-label="Channel"
            >
              {(
                [
                  { id: 'email' as const, label: 'Email' },
                  { id: 'linkedin' as const, label: 'LinkedIn' },
                ] as const
              ).map((tab) => {
                const active = channel === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    disabled={anyRun}
                    title={
                      anyRun
                        ? 'Wait for the current run to finish'
                        : `Channel: ${tab.label}`
                    }
                    onClick={() => {
                      if (!anyRun) setChannel(tab.id)
                    }}
                    className={`min-h-9 flex-1 border-b-2 px-0.5 py-1.5 text-center text-xs font-medium leading-tight transition-colors ${
                      anyRun
                        ? 'cursor-not-allowed border-transparent text-muted-foreground/60'
                        : active
                          ? 'border-emerald-500 text-foreground'
                          : 'border-transparent text-muted-foreground hover:text-foreground/90'
                    }`}
                  >
                    <span className="block">{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {channel === 'email' && (
              <div className="p-0">
                {n8nFallback && !inAppLoading && !anyRun && (
                  <div className="m-2 rounded-md border border-violet-500/30 bg-violet-950/25 p-2 text-[12px] text-violet-100/95">
                    <p className="mb-0.5 font-medium">Generation failed for this run</p>
                    <p className="text-[11px] text-violet-200/80">Try again with the cold draft below.</p>
                    <button
                      type="button"
                      disabled={anyRun}
                      onClick={() => {
                        void runInApp()
                      }}
                      className="mt-2 flex w-full min-h-9 items-center justify-center gap-1.5 rounded-md border border-violet-400/40 bg-violet-500/20 px-2 text-xs font-medium text-violet-100 hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Sparkles size={14} />
                      Draft in app
                    </button>
                  </div>
                )}

                <div className="px-3 pt-2.5">
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
                    Email templates
                  </p>
                  {suggestLoading && (
                    <p className="mb-1.5 text-[11px] text-muted-foreground">
                      <Loader2 size={11} className="mr-1 inline animate-spin" />
                      Suggested…
                    </p>
                  )}
                </div>

                {suggested && (
                  <div className="px-2.5 pb-2">
                    <button
                      type="button"
                      disabled={anyRun}
                      onClick={() => {
                        pickTemplate(suggested.template, 'email')
                      }}
                      className="flex w-full min-h-11 items-center justify-between gap-2 rounded-md border border-emerald-500/30 bg-gradient-to-r from-emerald-600/20 to-teal-600/15 px-2.5 py-2 text-left text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>Generate: {getPromptDisplayName(suggested.template)}</span>
                      <span
                        className="shrink-0 rounded border border-white/20 px-1.5 text-[9px] font-semibold uppercase text-emerald-200/90"
                        title={REASON_LABELS[suggested.reason]}
                      >
                        Suggested
                      </span>
                    </button>
                  </div>
                )}

                <ul
                  className="max-h-32 space-y-0.5 overflow-y-auto px-1.5 py-0.5 text-xs"
                  aria-label="Email templates"
                >
                  {EMAIL_TEMPLATE_KEYS.map((key) => {
                    const isSug = suggested?.template === key
                    return (
                      <li key={key} className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={anyRun}
                          className="flex min-h-9 flex-1 items-center justify-between gap-2 rounded-md px-2.5 text-left text-foreground hover:bg-silicon-slate/50 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => {
                            pickTemplate(key, 'email')
                          }}
                        >
                          <span className="truncate">{getPromptDisplayName(key)}</span>
                          {isSug && <span className="shrink-0 text-[9px] text-purple-300">★</span>}
                        </button>
                        <button
                          type="button"
                          disabled={anyRun}
                          onClick={() => {
                            setWhyRequest({
                              mode: 'preview',
                              leadId: lead.id,
                              leadName: lead.name,
                              channel: 'email',
                              templateKey: key,
                            })
                          }}
                          title={`Preview the assembled prompt for ${getPromptDisplayName(key)} (no LLM call, no draft saved)`}
                          aria-label={`Preview prompt for ${getPromptDisplayName(key)}`}
                          className="flex min-h-9 shrink-0 items-center justify-center rounded-md px-1.5 text-muted-foreground transition-colors hover:bg-silicon-slate/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Eye size={12} />
                        </button>
                      </li>
                    )
                  })}
                </ul>

                <div className="h-px bg-border/50" />
                <p className="px-3 pt-1.5 text-[10px] text-muted-foreground">Quick draft — cold outreach</p>
                <div className="px-2.5 pb-2">
                  <button
                    type="button"
                    className="flex w-full min-h-11 items-center justify-center gap-2 rounded-md border border-silicon-slate/80 bg-silicon-slate/30 px-2.5 text-sm text-foreground hover:bg-silicon-slate/50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={inAppLoading || anyRun}
                    onClick={() => {
                      void runInApp()
                    }}
                  >
                    {inAppLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    Draft cold email
                  </button>
                </div>

                <div className="border-t border-silicon-slate bg-muted/15 px-2.5 py-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-medium uppercase text-muted-foreground/80">Email — recent</p>
                    <button
                      type="button"
                      onClick={() => {
                        onOutreachOpen?.()
                      }}
                      className="inline-flex min-h-6 items-center gap-1 rounded px-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-silicon-slate/40 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
                      title="Refresh recent emails"
                      aria-label="Refresh recent emails"
                    >
                      <RotateCcw size={11} className="shrink-0" aria-hidden />
                      Refresh
                    </button>
                  </div>
                  {recent.length === 0 && (state === 'succeeded' || serverN8nSuccess) && (
                    <p className="mb-1.5 text-[11px] leading-relaxed text-emerald-200/90">
                      Draft is in the queue. This list updates when the row syncs — tap Refresh or use View all if you
                      do not see it yet.
                    </p>
                  )}
                  {recent.length === 0 && !serverN8nSuccess && state !== 'succeeded' && (
                    <p className="text-[12px] text-muted-foreground">No email rows yet</p>
                  )}
                  {recent.length > 0 ? (
                    <ul
                      className="mb-2 max-h-40 overflow-y-auto text-[12px]"
                      aria-label={`Recent emails for ${lead.name}`}
                    >
                      {recent.map((r) => {
                        const href = r.email_message_id
                          ? `/admin/email-messages/${r.email_message_id}`
                          : emailCenterHref
                        const itemTitle = r.email_message_id
                          ? `Open ${r.subject || 'this draft'} in the email viewer`
                          : `View ${r.subject || 'this draft'} in the Email Center (indexer has not caught up yet)`
                        return (
                          <li key={r.id} className="border-b border-border/20 last:border-0">
                            <div className="flex items-start gap-1">
                              <Link
                                href={href}
                                onClick={() => {
                                  setPanelOpen(false)
                                }}
                                className="block min-h-9 flex-1 rounded px-1 py-1.5 transition-colors hover:bg-silicon-slate/40 focus:bg-silicon-slate/40 focus:outline-none"
                                title={itemTitle}
                              >
                                <p
                                  className="truncate font-medium text-foreground"
                                  title={r.subject ?? 'No subject'}
                                >
                                  {r.subject || '(no subject)'}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {r.status} · {timeAgo(r.created_at)}
                                  {!r.email_message_id && (
                                    <span className="ml-1 text-muted-foreground/70">· indexing…</span>
                                  )}
                                </p>
                              </Link>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setWhyRequest({
                                    mode: 'inputs',
                                    queueId: r.id,
                                    subject: r.subject,
                                  })
                                }}
                                title="Why this draft? — show the prompt + model + context blocks recorded at generation time"
                                aria-label={`Why this draft for ${r.subject ?? 'no subject'}`}
                                className="mt-1 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-silicon-slate/40 hover:text-foreground"
                              >
                                <HelpCircle size={12} />
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                  <div className="flex flex-col gap-0.5 text-[11px]">
                    <a
                      href={emailCenterHref}
                      className="inline-flex min-h-8 min-w-0 max-w-full items-center gap-1.5 text-primary hover:underline"
                      title="View all outreach and email history for this lead (Email center, filtered to this contact)"
                      aria-label={`View all outreach and email history for ${lead.name}`}
                      onClick={() => {
                        setPanelOpen(false)
                      }}
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0 truncate">View all</span>
                    </a>
                    <Link
                      href={contactHref}
                      onClick={() => {
                        setPanelOpen(false)
                      }}
                      className="inline-flex min-h-8 items-center gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink size={12} className="shrink-0" />
                      Contact — compose
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {channel === 'linkedin' && (
              <div className="p-0">
                <div className="px-3 pt-2.5">
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
                    LinkedIn templates
                  </p>
                  <p className="mb-2 text-[11px] leading-snug text-muted-foreground/80">
                    Generates a connection note plus a follow-up DM. Send the note via LinkedIn manually,
                    then queue the DM 3–7 days after the invite is accepted.
                  </p>
                </div>

                <ul
                  className="max-h-32 space-y-0.5 overflow-y-auto px-1.5 py-0.5 text-xs"
                  aria-label="LinkedIn templates"
                >
                  {LINKEDIN_TEMPLATE_KEYS.map((key) => (
                    <li key={key} className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={anyRun}
                        className="flex min-h-9 flex-1 items-center justify-between gap-2 rounded-md px-2.5 text-left text-foreground hover:bg-silicon-slate/50 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => {
                          pickTemplate(key, 'linkedin')
                        }}
                      >
                        <span className="truncate">{getPromptDisplayName(key)}</span>
                      </button>
                      <button
                        type="button"
                        disabled={anyRun}
                        onClick={() => {
                          setWhyRequest({
                            mode: 'preview',
                            leadId: lead.id,
                            leadName: lead.name,
                            channel: 'linkedin',
                            templateKey: key,
                          })
                        }}
                        title={`Preview the assembled prompt for ${getPromptDisplayName(key)} (no LLM call, no draft saved)`}
                        aria-label={`Preview prompt for ${getPromptDisplayName(key)}`}
                        className="flex min-h-9 shrink-0 items-center justify-center rounded-md px-1.5 text-muted-foreground transition-colors hover:bg-silicon-slate/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Eye size={12} />
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="border-t border-silicon-slate bg-muted/15 px-2.5 py-2">
                  <p className="text-[10px] font-medium uppercase text-muted-foreground/80">
                    Where drafts go
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                    LinkedIn drafts land in the outreach queue with a CONNECTION NOTE + FOLLOW-UP DM
                    block. Review them in the lead&apos;s Outreach panel before sending.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <WhyThisDraftModal
        request={whyRequest}
        onClose={() => setWhyRequest(null)}
      />
    </div>
  )
}

export default OutreachEmailGenerateRow
