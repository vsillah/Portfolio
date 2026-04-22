'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
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
} from 'lucide-react'
import { PipelineProgressBar } from '@/components/admin/ExtractionStatusChip'
import { getCurrentSession } from '@/lib/auth'
import { useOutreachGeneration } from '@/lib/hooks/useOutreachGeneration'
import {
  EMAIL_TEMPLATE_KEYS,
  getPromptDisplayName,
  type EmailTemplateKey,
} from '@/lib/constants/prompt-keys'

const N8N_STAGES: { label: string; startsAt: number }[] = [
  { label: 'Contacting n8n', startsAt: 0 },
  { label: 'Queuing & generating', startsAt: 3 },
  { label: 'Saving to queue', startsAt: 20 },
]
const N8N_TYPICAL_S = 50

const INAPP_STAGES: { label: string; startsAt: number }[] = [
  { label: 'Loading lead context', startsAt: 0 },
  { label: 'Calling model', startsAt: 4 },
  { label: 'Saving draft', startsAt: 20 },
]
const INAPP_TYPICAL_S = 42

type Channel = 'email' | 'sms' | 'phone'

function estimateMilestoneProgress(
  stages: { label: string; startsAt: number }[],
  typicalS: number,
  elapsedMs: number,
): { currentStageLabel: string; progressPct: number; stepIndex: number; stepTotal: number } {
  const stagesDef = stages
  const elapsedS = elapsedMs / 1000
  let currentLabel = stagesDef[0].label
  let stageIdx = 0
  for (let i = stagesDef.length - 1; i >= 0; i--) {
    if (elapsedS >= stagesDef[i].startsAt) {
      currentLabel = stagesDef[i].label
      stageIdx = i
      break
    }
  }
  const nextStart =
    stageIdx + 1 < stagesDef.length ? stagesDef[stageIdx + 1].startsAt : typicalS
  const segStart = stagesDef[stageIdx].startsAt
  const segLen = Math.max(5, nextStart - segStart)
  const t = Math.min(1, Math.max(0, (elapsedS - segStart) / segLen))
  const eased = 1 - Math.exp(-2.8 * t)
  const base = (stageIdx / stagesDef.length) * 88
  const span = (1 / stagesDef.length) * 88
  const progressPct = Math.round(Math.min(94, Math.max(3, base + eased * span * 0.92)))
  return {
    currentStageLabel: currentLabel,
    progressPct,
    stepIndex: stageIdx + 1,
    stepTotal: stagesDef.length,
  }
}

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

const CANCEL_HONEST =
  'Stops this screen from waiting. n8n or the model may still finish; check Email center for the row when it appears.'

const CANCEL_BUTTON_HELP =
  'Stops this UI from waiting. Does not cancel the job in n8n or the model. Check Email center if a draft appears.'

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
}

export interface OutreachEmailGenerateRowProps {
  lead: {
    id: number
    name: string
    messages_count: number
    messages_sent?: number
    do_not_contact?: boolean
    removed_at?: string | null
    recent_email_drafts?: RecentEmailDraftItem[]
  }
  onToast?: (msg: string) => void
  onFallbackAvailable?: () => void
  onSettled?: () => void
  onFallbackCleared?: () => void
  n8nFallback?: boolean
}

export function OutreachEmailGenerateRow({
  lead,
  onToast,
  onFallbackAvailable,
  onSettled,
  onFallbackCleared,
  n8nFallback = false,
}: OutreachEmailGenerateRowProps) {
  const { state, elapsedMs, phaseLabel, start, cancel, retry } = useOutreachGeneration({
    leadId: lead.id,
    leadName: lead.name,
    messagesCount: lead.messages_count,
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
  const inAppAbortRef = useRef<AbortController | null>(null)
  const [inAppRunning, setInAppRunning] = useState(false)
  const inAppStartRef = useRef<number | null>(null)
  const [inAppElapsedMs, setInAppElapsedMs] = useState(0)
  const [inAppLoading, setInAppLoading] = useState(false)

  const recent = lead.recent_email_drafts ?? []
  const dnc = Boolean(lead.do_not_contact || lead.removed_at)
  const n8nActive = state === 'running' && !inAppRunning
  const anyRun = n8nActive || inAppRunning
  const progressN8n = useMemo(
    () => (n8nActive ? estimateMilestoneProgress(N8N_STAGES, N8N_TYPICAL_S, elapsedMs) : null),
    [n8nActive, elapsedMs],
  )
  const progressInApp = useMemo(
    () => (inAppRunning ? estimateMilestoneProgress(INAPP_STAGES, INAPP_TYPICAL_S, inAppElapsedMs) : null),
    [inAppRunning, inAppElapsedMs],
  )
  const progress = inAppRunning ? progressInApp : progressN8n
  const phaseDisplay = inAppRunning ? (progressInApp?.currentStageLabel ?? 'Working…') : phaseLabel
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
          body: JSON.stringify(force ? { force: true } : {}),
        })
        const data = (await res.json().catch(() => ({}))) as { outcome?: string; error?: string }
        if (ac.signal.aborted) return
        if (res.ok && data.outcome === 'created') {
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
    [dnc, lead.id, lead.name, onFallbackCleared, onSettled, onToast],
  )

  const onCancel = useCallback(() => {
    if (inAppRunning && inAppAbortRef.current) {
      inAppAbortRef.current.abort()
      onToast?.('Stopped the in-app request. If a row appears, check the queue.')
      inAppStartRef.current = null
      setInAppRunning(false)
      setInAppLoading(false)
      return
    }
    cancel()
  }, [cancel, inAppRunning, onToast])

  const contactHref = `/admin/contacts/${lead.id}?focus=compose${
    suggested?.template ? `&template=${suggested.template}` : ''
  }#compose`

  const runN8n = (key?: EmailTemplateKey) => {
    void start(key)
  }

  const pickTemplateN8n = (key: EmailTemplateKey) => {
    runN8n(key)
  }

  const activitySummary = useMemo(() => {
    if (anyRun && progress) {
      return `${runningHeadline} — ${progress.currentStageLabel}`
    }
    if (state === 'succeeded') return 'Draft created'
    if (state === 'cancelled') return 'Stopped'
    if (state === 'failed' && n8nFallback) return 'Automation down'
    if (state === 'failed') return 'n8n issue'
    if (lead.messages_count === 0) return 'No activity yet'
    if (messagesSent > 0) {
      return `${lead.messages_count} in queue, ${messagesSent} sent`
    }
    return `${lead.messages_count} in queue`
  }, [anyRun, progress, state, n8nFallback, lead.messages_count, messagesSent, runningHeadline])

  const queueCountLabel = useMemo(() => {
    if (lead.messages_count === 0) return null
    if (messagesSent > 0) {
      return `${lead.messages_count} in queue, ${messagesSent} sent`
    }
    return `${lead.messages_count} in queue`
  }, [lead.messages_count, messagesSent])

  if (dnc) return null

  const showProgressCard = Boolean(anyRun && progress && !panelOpen)

  let outreachBar: ReactNode
  if (state === 'succeeded') {
    outreachBar = (
      <div
        className="inline-flex h-9 min-h-11 w-full min-w-0 max-w-sm items-center justify-center gap-2 rounded-lg bg-emerald-600/90 px-3 text-sm font-medium text-white"
        role="status"
        title="Draft ready — open Email center for this lead"
      >
        <CheckCircle size={14} className="shrink-0" />
        <span>Check Email center</span>
        {queueCountLabel && (
          <span className="ml-0.5 truncate text-xs font-normal text-white/80" title={queueCountLabel}>
            · {queueCountLabel}
          </span>
        )}
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
  } else if (state === 'failed' && !n8nActive && !inAppRunning && !n8nFallback) {
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
          <span>Retry n8n</span>
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
    const runningTitle = `${runningHeadline} — ${phase}${
      queueCountLabel
        ? `. ${queueCountLabel} — tap to open details, or Cancel to stop waiting.`
        : ' — tap to open details, or Cancel to stop waiting.'
    }`
    outreachBar = (
      <div
        className="flex w-full min-w-0 max-w-sm overflow-hidden rounded-lg border border-amber-500/50 min-h-11"
        title={CANCEL_HONEST}
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
          aria-label="Cancel: stop this screen from waiting. Does not cancel the job in n8n or the model."
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
          <p className="mt-1 text-[10px] text-muted-foreground" title={CANCEL_HONEST}>
            {CANCEL_HONEST}
          </p>
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
                <p className="mt-1.5 text-[10px] text-muted-foreground" title={CANCEL_HONEST}>
                  {CANCEL_HONEST}
                </p>
              </div>
            )}
            {anyRun && (
              <p
                className="border-b border-amber-500/15 bg-amber-950/10 px-3 py-1.5 text-[10px] leading-relaxed text-amber-100/80"
                role="status"
              >
                Finish or cancel this run to change channel or start another template. Cancel stops this screen
                from waiting, not the job in n8n or the model.
              </p>
            )}
            <div
              className="flex border-b border-silicon-slate/80"
              role="tablist"
              aria-label="Channel"
            >
              {(
                [
                  { id: 'email' as const, label: 'Email' },
                  { id: 'sms' as const, label: 'SMS' },
                  { id: 'phone' as const, label: 'Phone' },
                ] as const
              ).map((tab) => {
                const active = channel === tab.id
                const isSoon = tab.id !== 'email'
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    disabled={isSoon || anyRun}
                    title={
                      isSoon
                        ? 'Coming soon'
                        : anyRun
                          ? 'Wait for the current run to finish'
                          : `Channel: ${tab.label}`
                    }
                    onClick={() => {
                      if (!isSoon && !anyRun) setChannel(tab.id)
                    }}
                    className={`min-h-9 flex-1 border-b-2 px-0.5 py-1.5 text-center text-xs font-medium leading-tight transition-colors ${
                      isSoon || anyRun
                        ? 'cursor-not-allowed border-transparent text-muted-foreground/60'
                        : active
                          ? 'border-emerald-500 text-foreground'
                          : 'border-transparent text-muted-foreground hover:text-foreground/90'
                    }`}
                  >
                    <span className="block">{tab.label}</span>
                    {isSoon && (
                      <span className="mt-0.5 block text-[9px] font-normal normal-case text-muted-foreground/70">soon</span>
                    )}
                  </button>
                )
              })}
            </div>

            {channel === 'email' && (
              <div className="p-0">
                {n8nFallback && !inAppLoading && !inAppRunning && (
                  <div className="m-2 rounded-md border border-violet-500/30 bg-violet-950/25 p-2 text-[12px] text-violet-100/95">
                    <p className="mb-0.5 font-medium">n8n is unavailable for this run</p>
                    <p className="text-[11px] text-violet-200/80">Use the OpenAI cold draft below.</p>
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
                    n8n — quick generate
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
                        pickTemplateN8n(suggested.template)
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
                  aria-label="n8n email templates"
                >
                  {EMAIL_TEMPLATE_KEYS.map((key) => {
                    const isSug = suggested?.template === key
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          disabled={anyRun}
                          className="flex w-full min-h-9 items-center justify-between gap-2 rounded-md px-2.5 text-left text-foreground hover:bg-silicon-slate/50 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => {
                            pickTemplateN8n(key)
                          }}
                        >
                          <span className="truncate">{getPromptDisplayName(key)}</span>
                          {isSug && <span className="shrink-0 text-[9px] text-purple-300">★</span>}
                        </button>
                      </li>
                    )
                  })}
                </ul>

                <div className="h-px bg-border/50" />
                <p className="px-3 pt-1.5 text-[10px] text-muted-foreground">In-app (OpenAI) — cold outreach</p>
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
                    Draft in app
                  </button>
                </div>

                <div className="border-t border-silicon-slate bg-muted/15 px-2.5 py-2">
                  <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground/80">Email — recent</p>
                  {recent.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground">No email rows yet</p>
                  ) : (
                    <ul className="mb-2 max-h-24 overflow-y-auto text-[12px]">
                      {recent.map((r) => (
                        <li
                          key={r.id}
                          className="border-b border-border/20 py-1.5 last:border-0"
                        >
                          <p className="truncate" title={r.subject ?? 'No subject'}>
                            {r.subject || '(no subject)'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {r.status} · {timeAgo(r.created_at)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-col gap-0.5 text-[11px]">
                    <a
                      href={`/admin/email-center?contact=${lead.id}`}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default OutreachEmailGenerateRow
