'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  ClipboardCheck,
  CalendarDays,
  CheckCircle2,
  LockKeyhole,
  Mail,
  MessageSquare,
  RefreshCw,
  Smartphone,
  UserRoundCheck,
} from 'lucide-react'
import type {
  WarmOutreachDailyActionKind,
  WarmOutreachDailyLoopStatus,
  WarmOutreachPlanningBacklog,
  WarmOutreachPlanningBacklogCandidate,
  WarmOutreachPlanningBacklogState,
} from '@/lib/warm-outreach-shortlist'

const STATE_ORDER: WarmOutreachPlanningBacklogState[] = [
  'ready_gmail_draft',
  'ready_manual_social',
  'needs_relationship_review',
  'waiting_on_response',
  'suppressed_blocked',
  'sms_parked',
]

interface WarmPlanningBacklogPanelProps {
  backlog: WarmOutreachPlanningBacklog
  activeState: WarmOutreachPlanningBacklogState | 'all'
  loading: boolean
  error: string | null
  onStateChange: (state: WarmOutreachPlanningBacklogState | 'all') => void
  onPrepareBatch: () => void | Promise<void>
  onPrepareCandidateReview: (candidate: WarmOutreachPlanningBacklogCandidate) => void | Promise<void>
  onOpenCandidate: (candidate: WarmOutreachPlanningBacklogCandidate) => void | Promise<void>
}

function channelLabel(channel: WarmOutreachPlanningBacklogCandidate['recommendedChannel']) {
  if (channel === 'gmail') return 'Gmail'
  if (channel === 'linkedin') return 'LinkedIn'
  if (channel === 'facebook') return 'Facebook'
  if (channel === 'phone_contact') return 'Phone'
  return 'SMS'
}

function planningFilterLabel(state: WarmOutreachPlanningBacklogState) {
  if (state === 'ready_gmail_draft') return 'Ready Gmail'
  if (state === 'ready_manual_social') return 'Manual'
  if (state === 'needs_relationship_review') return 'Relationship'
  if (state === 'waiting_on_response') return 'Responses'
  if (state === 'suppressed_blocked') return 'Blocked'
  return 'SMS parked'
}

function draftReadinessLabel(value: WarmOutreachPlanningBacklogCandidate['draftReadiness']) {
  if (value === 'ready_for_review_batch') return 'Draft ready'
  if (value === 'existing_draft') return 'Draft exists'
  if (value === 'approval_needed') return 'Approval needed'
  if (value === 'response_waiting') return 'Response follow-up'
  if (value === 'relationship_review_needed') return 'Relationship review'
  if (value === 'blocked') return 'Blocked'
  return 'Parked'
}

function approvalStateLabel(value: WarmOutreachPlanningBacklogCandidate['approvalState']) {
  if (value === 'needs_approval') return 'Needs approval'
  if (value === 'approved') return 'Approved'
  if (value === 'submitted_evidence_recorded') return 'Evidence recorded'
  if (value === 'blocked') return 'Blocked'
  return 'No approval request'
}

function responseStatusLabel(value: WarmOutreachPlanningBacklogCandidate['responseStatus']) {
  if (value === 'reply_detected') return 'Reply detected'
  if (value === 'waiting') return 'Waiting response'
  if (value === 'blocked') return 'Blocked'
  return 'No response'
}

function stateClasses(state: WarmOutreachPlanningBacklogState) {
  if (state === 'ready_gmail_draft') return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
  if (state === 'ready_manual_social') return 'border-sky-500/35 bg-sky-500/10 text-sky-100'
  if (state === 'waiting_on_response') return 'border-violet-500/35 bg-violet-500/10 text-violet-100'
  if (state === 'sms_parked') return 'border-silicon-slate/80 bg-background/40 text-muted-foreground'
  return 'border-amber-500/35 bg-amber-500/10 text-amber-100'
}

function StateIcon({ state }: { state: WarmOutreachPlanningBacklogState }) {
  if (state === 'ready_gmail_draft') return <Mail size={14} aria-hidden />
  if (state === 'ready_manual_social') return <UserRoundCheck size={14} aria-hidden />
  if (state === 'waiting_on_response') return <MessageSquare size={14} aria-hidden />
  if (state === 'sms_parked') return <Smartphone size={14} aria-hidden />
  return <AlertTriangle size={14} aria-hidden />
}

function candidatePrimaryState(candidate: WarmOutreachPlanningBacklogCandidate) {
  return candidate.states.find((state) => state !== 'sms_parked') ?? candidate.states[0] ?? 'needs_relationship_review'
}

function stateSummaryLabel(backlog: WarmOutreachPlanningBacklog) {
  const ready = backlog.counts.ready_gmail_draft + backlog.counts.ready_manual_social
  if (ready > 0) return `${ready} action-ready`
  if (backlog.counts.waiting_on_response > 0) return `${backlog.counts.waiting_on_response} waiting`
  if (backlog.counts.needs_relationship_review > 0) return `${backlog.counts.needs_relationship_review} context review`
  return `${backlog.counts.sms_parked} SMS parked`
}

function loopStepClasses(state: WarmOutreachPlanningBacklog['executionLoop']['steps'][number]['state']) {
  if (state === 'active') return 'border-radiant-gold/35 bg-radiant-gold/10 text-radiant-gold'
  if (state === 'parked') return 'border-silicon-slate/80 bg-background/35 text-muted-foreground'
  return 'border-sky-500/25 bg-sky-500/10 text-sky-100'
}

function dailyActionClasses(kind: WarmOutreachDailyActionKind) {
  if (kind === 'gmail_draft_review') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
  if (kind === 'manual_social_handoff') return 'border-sky-500/25 bg-sky-500/10 text-sky-100'
  if (kind === 'reply_follow_up') return 'border-violet-500/25 bg-violet-500/10 text-violet-100'
  if (kind === 'sms_parked') return 'border-silicon-slate/80 bg-background/35 text-muted-foreground'
  return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
}

function loopStatusClasses(status: WarmOutreachDailyLoopStatus) {
  if (status === 'ready') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
  if (status === 'review_needed') return 'border-radiant-gold/25 bg-radiant-gold/10 text-radiant-gold'
  if (status === 'completed') return 'border-sky-500/25 bg-sky-500/10 text-sky-100'
  if (status === 'blocked') return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
  return 'border-silicon-slate/80 bg-background/35 text-muted-foreground'
}

function dailyActionCardClasses(status: WarmOutreachDailyLoopStatus) {
  if (status === 'ready') return 'border-emerald-500/25 bg-emerald-500/5'
  if (status === 'review_needed') return 'border-radiant-gold/25 bg-radiant-gold/5'
  if (status === 'completed') return 'border-sky-500/20 bg-sky-500/5'
  if (status === 'blocked') return 'border-amber-500/25 bg-amber-500/5'
  return 'border-silicon-slate/70 bg-background/35'
}

function LoopStatusIcon({ status }: { status: WarmOutreachDailyLoopStatus }) {
  if (status === 'completed') return <CheckCircle2 size={14} aria-hidden />
  if (status === 'blocked') return <AlertTriangle size={14} aria-hidden />
  if (status === 'parked') return <LockKeyhole size={14} aria-hidden />
  return <ClipboardCheck size={14} aria-hidden />
}

function DailyActionIcon({ kind }: { kind: WarmOutreachDailyActionKind }) {
  if (kind === 'gmail_draft_review') return <Mail size={14} aria-hidden />
  if (kind === 'manual_social_handoff') return <UserRoundCheck size={14} aria-hidden />
  if (kind === 'reply_follow_up') return <MessageSquare size={14} aria-hidden />
  if (kind === 'sms_parked') return <Smartphone size={14} aria-hidden />
  return <AlertTriangle size={14} aria-hidden />
}

function preparesReviewBatch(action: WarmOutreachPlanningBacklogCandidate['reviewLoopAction']) {
  return action.key === 'start_gmail_review_batch' || action.key === 'start_manual_social_batch'
}

function openedActionLabel(action: WarmOutreachPlanningBacklogCandidate['reviewLoopAction']) {
  if (preparesReviewBatch(action)) return 'Review opened'
  if (action.key === 'open_manual_social_handoff') return 'Workroom opened'
  if (action.key === 'open_response_review') return 'Response opened'
  if (action.key === 'open_gmail_draft_review') return 'Draft opened'
  return 'Selected'
}

function destinationSelector(action: WarmOutreachPlanningBacklogCandidate['reviewLoopAction']) {
  if (preparesReviewBatch(action)) return '#gmail-batch-draft-plan, [aria-label="Warm batch review"]'
  if (action.key === 'open_manual_social_handoff') return '#warm-manual-social-handoff'
  if (action.key === 'open_response_review') return '#warm-response-lifecycle'
  if (action.key === 'open_gmail_draft_review') return '#warm-gmail-draft-review'
  return '[data-testid="outreach-generator"]'
}

function focusActionDestination(action: WarmOutreachPlanningBacklogCandidate['reviewLoopAction']) {
  const selector = destinationSelector(action)
  const tryFocus = (attempt = 0) => {
    const element = document.querySelector(selector)
    if (element instanceof HTMLElement) {
      if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1')
      element.scrollIntoView({ block: 'start', behavior: 'smooth' })
      element.focus({ preventScroll: true })
      return
    }
    if (attempt < 8) {
      window.setTimeout(() => tryFocus(attempt + 1), 100)
    }
  }
  window.setTimeout(() => tryFocus(), 0)
}

export default function WarmPlanningBacklogPanel({
  backlog,
  activeState,
  loading,
  error,
  onStateChange,
  onPrepareBatch,
  onPrepareCandidateReview,
  onOpenCandidate,
}: WarmPlanningBacklogPanelProps) {
  const [openedDailyActionKey, setOpenedDailyActionKey] = useState<string | null>(null)
  const visibleCandidates =
    activeState === 'all'
      ? backlog.candidates
      : backlog.candidates.filter((candidate) => candidate.states.includes(activeState))
  const totalCandidates = backlog.candidates.length
  const primaryDailyAction = backlog.dailyActions.currentSafestAction
  const primaryDailyCandidate = primaryDailyAction.key === 'open_daily_action'
    ? backlog.candidates.find((candidate) => candidate.contactId === primaryDailyAction.contactIds[0])
    : null
  const primaryActionEnabled = primaryDailyAction.key === 'open_daily_action'
    ? primaryDailyAction.enabled && Boolean(primaryDailyCandidate)
    : backlog.currentCta.enabled
  const visibleDailyActions = backlog.dailyActions.rows.slice(0, 6)
  const handlePrimaryAction = () => {
    if (primaryDailyCandidate) {
      onOpenCandidate(primaryDailyCandidate)
      return
    }
    onPrepareBatch()
  }

  return (
    <section
      id="warm-planning-backlog"
      className="mb-4 rounded-lg border border-radiant-gold/30 bg-radiant-gold/5 p-3 sm:p-4"
      aria-label="Warm outreach planning backlog"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,auto)] lg:items-start">
        <div className="min-w-0">
          <div>
            <p className="text-xs font-semibold uppercase leading-5 tracking-wide text-radiant-gold">
              Warm planning backlog
            </p>
            <div className="mt-2 flex max-w-full flex-wrap items-center gap-x-2 gap-y-2">
              <span className="inline-flex max-w-full items-center rounded-full border border-silicon-slate/70 bg-background/45 px-2.5 py-0.5 text-left text-xs leading-5 text-muted-foreground">
                {backlog.planningWindowLabel}
              </span>
              <span className="inline-flex min-w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-xs leading-5 text-emerald-100">
                external requests {backlog.executionBoundary.externalRequests.length}
              </span>
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <button
            type="button"
            disabled={!primaryActionEnabled || loading}
            onClick={handlePrimaryAction}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 text-sm font-semibold text-radiant-gold transition-colors hover:bg-radiant-gold/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw size={15} className="animate-spin" aria-hidden />
            ) : (
              <ClipboardCheck size={15} aria-hidden />
            )}
            {loading ? 'Preparing plan...' : primaryDailyAction.label}
          </button>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {primaryDailyAction.reason}
          </p>
          {error && (
            <p role="alert" className="mt-2 rounded-md border border-red-500/25 bg-red-500/10 p-2 text-xs leading-5 text-red-100">
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-2">
            <div className="min-w-0 rounded-md border border-radiant-gold/25 bg-background/35 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-md border border-radiant-gold/30 bg-radiant-gold/10 px-2 text-[11px] font-semibold uppercase leading-5 tracking-wide text-radiant-gold">
                  <CalendarDays size={12} aria-hidden />
                  Today / This week
                </span>
                <span className="inline-flex min-h-7 shrink-0 items-center whitespace-nowrap rounded-md border border-silicon-slate/70 bg-background/45 px-2 text-[11px] leading-5 text-muted-foreground">
                  {backlog.campaignAlignment.plannedWindowLabel}
                </span>
                <span className="inline-flex min-h-7 shrink-0 items-center whitespace-nowrap rounded-md border border-silicon-slate/70 bg-background/45 px-2 text-[11px] leading-5 text-muted-foreground">
                  {stateSummaryLabel(backlog)}
                </span>
                <span className="inline-flex min-h-7 shrink-0 items-center whitespace-nowrap rounded-md border border-silicon-slate/70 bg-background/45 px-2 text-[11px] leading-5 text-muted-foreground">
                  Today {backlog.operatingWindow.todayLabel}
                </span>
                <span className="inline-flex min-h-7 shrink-0 items-center whitespace-nowrap rounded-md border border-silicon-slate/70 bg-background/45 px-2 text-[11px] leading-5 text-muted-foreground">
                  Week {backlog.operatingWindow.weekLabel}
                </span>
                <span
                  className="inline-flex min-h-7 min-w-0 max-w-full items-center rounded-md border border-sky-500/25 bg-sky-500/10 px-2 text-[11px] leading-5 text-sky-100"
                  title={`${backlog.campaignAlignment.currentCalendarChannelLabel}: ${backlog.campaignAlignment.currentMilestoneTitle}`}
                >
                  <span className="truncate">Calendar {backlog.campaignAlignment.currentCalendarChannelLabel}</span>
                </span>
                <span
                  className="inline-flex min-h-7 min-w-0 max-w-full items-center rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 text-[11px] leading-5 text-emerald-100"
                  title={backlog.campaignAlignment.currentProofPoint}
                >
                  <span className="truncate">Proof {backlog.campaignAlignment.currentProofPoint}</span>
                </span>
                <span
                  className="inline-flex min-h-7 min-w-0 max-w-full items-center rounded-md border border-silicon-slate/70 bg-background/45 px-2 text-[11px] leading-5 text-muted-foreground"
                  title={backlog.campaignAlignment.currentSourceLabel}
                >
                  <span className="truncate">Source {backlog.campaignAlignment.currentSourceLabel}</span>
                </span>
                <span
                  className="inline-flex min-h-7 min-w-0 max-w-full items-center rounded-md border border-radiant-gold/25 bg-radiant-gold/10 px-2 text-[11px] leading-5 text-radiant-gold"
                  title={backlog.campaignAlignment.currentCadenceLabel}
                >
                  <span className="truncate">Cadence {backlog.campaignAlignment.currentCadenceLabel}</span>
                </span>
                <span
                  className="inline-flex min-h-7 min-w-0 max-w-full items-center rounded-md border border-amber-500/25 bg-amber-500/10 px-2 text-[11px] leading-5 text-amber-100"
                  title={backlog.campaignAlignment.currentApprovalGateLabel}
                >
                  <span className="truncate">Gate {backlog.campaignAlignment.currentApprovalGateLabel}</span>
                </span>
              </div>
              <p className="mt-2 text-[11px] font-semibold uppercase leading-5 tracking-wide text-muted-foreground/80">
                {backlog.campaignAlignment.campaignTheme}
              </p>
              <p className="text-sm font-semibold leading-5 text-foreground">
                {backlog.campaignAlignment.currentPhaseLabel}: {backlog.campaignAlignment.currentMilestoneTitle}
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {backlog.campaignAlignment.whyThisBacklogIsNext}
              </p>
              <details className="mt-2 text-xs leading-5 text-muted-foreground">
                <summary className="cursor-pointer text-radiant-gold/90">Campaign source</summary>
                <p className="mt-1">{backlog.campaignAlignment.drillIn}</p>
              </details>
            </div>
            <div
              className="min-w-0 rounded-md border border-emerald-500/25 bg-emerald-500/5 p-3"
              aria-label="Warm daily operating actions"
            >
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(14rem,auto)] xl:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 text-[11px] font-semibold uppercase leading-5 tracking-wide text-emerald-100">
                      <ClipboardCheck size={12} aria-hidden />
                      Today&apos;s actions
                    </span>
                    <span className="inline-flex min-h-7 max-w-full items-center rounded-md border border-silicon-slate/70 bg-background/45 px-2 text-[11px] leading-5 text-muted-foreground">
                      {backlog.dailyActions.campaignPhaseLabel}
                    </span>
                    <span className="inline-flex min-h-7 min-w-fit shrink-0 items-center whitespace-nowrap rounded-md border border-silicon-slate/70 bg-background/45 px-2 text-[11px] leading-5 text-muted-foreground">
                      {backlog.dailyActions.operatingDateLabel}
                    </span>
                    <span
                      className="inline-flex min-h-7 min-w-0 max-w-full items-center rounded-md border border-radiant-gold/25 bg-radiant-gold/10 px-2 text-[11px] leading-5 text-radiant-gold"
                      title={backlog.campaignAlignment.sourceContextLabel}
                    >
                      <span className="truncate">Source {backlog.campaignAlignment.sourceContextLabel}</span>
                    </span>
                    <span
                      className="inline-flex min-h-7 min-w-0 max-w-full items-center rounded-md border border-silicon-slate/70 bg-background/45 px-2 text-[11px] leading-5 text-muted-foreground"
                      title={backlog.campaignAlignment.currentCadenceLabel}
                    >
                      <span className="truncate">{backlog.campaignAlignment.currentCadenceLabel}</span>
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-5 text-foreground">
                    {backlog.dailyActions.currentSafestAction.label}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {backlog.dailyActions.currentSafestAction.reason}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground">
                    {backlog.dailyActions.campaignMilestoneTitle}
                  </p>
                </div>
                <div className="grid min-w-0 grid-cols-[repeat(2,minmax(0,1fr))] gap-1.5 text-[11px] leading-5 text-muted-foreground sm:grid-cols-[repeat(3,minmax(0,1fr))] xl:grid-cols-[repeat(2,minmax(0,1fr))]">
                  <span className="inline-flex min-w-0 items-center justify-between gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-emerald-100">
                    Gmail <b className="tabular-nums">{backlog.dailyActions.summary.gmailDraftReviewCount}</b>
                  </span>
                  <span className="inline-flex min-w-0 items-center justify-between gap-2 rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-0.5 text-sky-100">
                    Manual <b className="tabular-nums">{backlog.dailyActions.summary.manualSocialHandoffCount}</b>
                  </span>
                  <span className="inline-flex min-w-0 items-center justify-between gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-0.5 text-violet-100">
                    Replies <b className="tabular-nums">{backlog.dailyActions.summary.replyFollowUpCount}</b>
                  </span>
                  <span className="inline-flex min-w-0 items-center justify-between gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-amber-100">
                    Recovery <b className="tabular-nums">{backlog.dailyActions.summary.relationshipRecoveryCount}</b>
                  </span>
                  <span className="inline-flex min-w-0 items-center justify-between gap-2 rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-0.5 text-red-100">
                    Blocked <b className="tabular-nums">{backlog.dailyActions.summary.blockedSuppressedCount}</b>
                  </span>
                  <span className="inline-flex min-w-0 items-center justify-between gap-2 rounded-full border border-silicon-slate/80 bg-background/35 px-2.5 py-0.5">
                    SMS parked <b className="tabular-nums">{backlog.dailyActions.summary.smsParkedCount}</b>
                  </span>
                </div>
              </div>
              <div className="mt-3 grid gap-2 xl:grid-cols-2">
                {visibleDailyActions.map((action) => {
                  const candidate = backlog.candidates.find((row) => row.contactId === action.contactId)
                  const loopAction = action.reviewLoopAction
                  const actionOpened = openedDailyActionKey === action.key
                  const actionDisabled = !action.enabled || !candidate || actionOpened
                  return (
                    <article
                      key={action.key}
                      className={`grid min-w-0 gap-2 rounded-md border p-2.5 ${dailyActionCardClasses(action.loopStatus)}`}
                      aria-label={`Daily warm action for ${action.contactName}`}
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current/25 bg-background/25 text-[11px] font-semibold tabular-nums">
                          {action.priorityRank}
                        </span>
                        <span className={`inline-flex min-w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-5 ${dailyActionClasses(action.kind)}`}>
                          <DailyActionIcon kind={action.kind} />
                          {action.stateLabel}
                        </span>
                        <span className={`inline-flex min-w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-5 ${loopStatusClasses(action.loopStatus)}`}>
                          <LoopStatusIcon status={action.loopStatus} />
                          {action.loopStatusLabel}
                        </span>
                        {action.smsParked && action.kind !== 'sms_parked' && (
                          <span className="inline-flex max-w-full items-center rounded-full border border-silicon-slate/80 bg-background/35 px-2 py-0.5 text-[11px] leading-5 text-muted-foreground">
                            SMS parked
                          </span>
                        )}
                        <span className="inline-flex max-w-full items-center rounded-full border border-silicon-slate/70 bg-background/35 px-2 py-0.5 text-[11px] leading-5 text-muted-foreground">
                          {loopAction.statusLabel}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold leading-5 text-foreground">
                          {action.contactName}
                        </p>
                        <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {action.label}: {action.reason}
                        </p>
                        <div className="mt-1 flex min-w-0 flex-wrap gap-1.5 text-[11px] leading-5 text-muted-foreground">
                          <span
                            className="inline-flex min-w-0 max-w-full items-center rounded-full border border-sky-500/25 bg-sky-500/10 px-2 text-sky-100"
                            title={action.campaignSignal}
                          >
                            <span className="truncate">Calendar {backlog.campaignAlignment.currentPhaseLabel}</span>
                          </span>
                          <span
                            className="inline-flex min-w-0 max-w-full items-center rounded-full border border-radiant-gold/25 bg-radiant-gold/10 px-2 text-radiant-gold"
                            title={action.cadenceSignal}
                          >
                            <span className="truncate">Cadence {action.cadenceSignal}</span>
                          </span>
                          <span
                            className="inline-flex min-w-0 max-w-full items-center rounded-full border border-sky-500/25 bg-sky-500/10 px-2 text-sky-100"
                            title={action.sourceSignal}
                          >
                            <span className="truncate">Source {action.sourceSignal}</span>
                          </span>
                          <span
                            className="inline-flex min-w-0 max-w-full items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 text-emerald-100"
                            title={action.contentProofPoint}
                          >
                            <span className="truncate">Proof {action.contentProofPoint}</span>
                          </span>
                          <span
                            className="inline-flex min-w-0 max-w-full items-center rounded-full border border-amber-500/25 bg-amber-500/10 px-2 text-amber-100"
                            title={action.approvalGateSignal}
                          >
                            <span className="truncate">Gate {action.approvalGateSignal}</span>
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground">
                          Safe next: {action.afterAction}
                        </p>
                        {loopAction.blockerReason && (
                          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-amber-100">
                            Blocked: {loopAction.blockerReason}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={actionDisabled}
                        onClick={async () => {
                          if (!candidate) return
                          if (preparesReviewBatch(loopAction)) {
                            await onPrepareCandidateReview(candidate)
                            setOpenedDailyActionKey(action.key)
                            focusActionDestination(loopAction)
                            return
                          }
                          await onOpenCandidate(candidate)
                          setOpenedDailyActionKey(action.key)
                          focusActionDestination(loopAction)
                        }}
                        className={`inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium leading-5 transition-colors disabled:cursor-not-allowed ${
                          actionOpened
                            ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
                            : 'border-silicon-slate/80 bg-silicon-slate/35 text-foreground hover:bg-silicon-slate/55 disabled:opacity-50'
                        }`}
                        aria-label={`${action.ctaLabel} for ${action.contactName}`}
                      >
                        {actionOpened ? (
                          <CheckCircle2 size={14} aria-hidden />
                        ) : action.loopStatus === 'completed' || action.loopStatus === 'parked' ? (
                          <LoopStatusIcon status={action.loopStatus} />
                        ) : (
                          <DailyActionIcon kind={action.kind} />
                        )}
                        {actionOpened ? openedActionLabel(loopAction) : action.ctaLabel}
                      </button>
                    </article>
                  )
                })}
              </div>
              {backlog.dailyActions.rows.length > visibleDailyActions.length && (
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                  {backlog.dailyActions.rows.length - visibleDailyActions.length} more warm action{backlog.dailyActions.rows.length - visibleDailyActions.length === 1 ? '' : 's'} stay in the filtered candidate list below.
                </p>
              )}
            </div>
            <div
              className="min-w-0 rounded-md border border-silicon-slate/70 bg-background/35 p-3"
              aria-label="Warm office execution loop"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-md border border-radiant-gold/30 bg-radiant-gold/10 px-2 text-[11px] font-semibold uppercase leading-5 tracking-wide text-radiant-gold">
                  <CheckCircle2 size={12} aria-hidden />
                  Campaign cadence
                </span>
                <span className="inline-flex min-h-7 min-w-fit shrink-0 items-center whitespace-nowrap rounded-md border border-silicon-slate/70 bg-background/45 px-2 text-[11px] leading-5 text-muted-foreground">
                  {backlog.executionLoop.officeWindowLabel}
                </span>
                <span className="inline-flex min-h-7 min-w-fit shrink-0 items-center whitespace-nowrap rounded-md border border-silicon-slate/70 bg-background/45 px-2 text-[11px] leading-5 text-muted-foreground">
                  {backlog.executionLoop.focusLabel}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] leading-5 text-muted-foreground">
                <span className="inline-flex min-w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-emerald-100">
                  Gmail {backlog.executionLoop.gmailReadyCount}
                </span>
                <span className="inline-flex min-w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-0.5 text-sky-100">
                  Manual {backlog.executionLoop.manualSocialReadyCount}
                </span>
                <span className="inline-flex min-w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-0.5 text-violet-100">
                  Recovery {backlog.executionLoop.responseRecoveryCount + backlog.executionLoop.blockerRecoveryCount}
                </span>
                <span className="inline-flex min-w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-silicon-slate/80 bg-background/35 px-2.5 py-0.5">
                  SMS parked {backlog.executionLoop.smsParkedCount}
                </span>
              </div>
              <ol className="mt-3 grid gap-2 md:grid-cols-3">
                {backlog.executionLoop.steps.map((step, index) => (
                  <li
                    key={step.key}
                    className={`min-w-0 rounded-md border p-2.5 ${loopStepClasses(step.state)}`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current/25 bg-background/25 text-[11px] font-semibold tabular-nums">
                        {index + 1}
                      </span>
                      <p className="min-w-0 truncate text-xs font-semibold leading-5">{step.label}</p>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-5 opacity-85">{step.detail}</p>
                  </li>
                ))}
              </ol>
              <details className="mt-2 text-xs leading-5 text-muted-foreground">
                <summary className="cursor-pointer text-radiant-gold/90">Recovery paths</summary>
                <p className="mt-1">
                  {backlog.executionLoop.responseRecoveryCount} waiting response, {backlog.executionLoop.blockerRecoveryCount} relationship or suppression blocker, {backlog.executionLoop.smsParkedCount} SMS parked.
                </p>
              </details>
            </div>
          </div>
          <div
            className="mt-3 flex max-w-full flex-wrap gap-1.5"
            role="group"
            aria-label="Warm planning state filters"
          >
            <button
              type="button"
              onClick={() => onStateChange('all')}
              className={`inline-flex min-h-8 max-w-full min-w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium leading-5 transition-colors ${
                activeState === 'all'
                  ? 'border-radiant-gold bg-radiant-gold/15 text-radiant-gold'
                  : 'border-silicon-slate/70 bg-background/40 text-muted-foreground hover:border-radiant-gold/50 hover:text-foreground'
              }`}
              aria-pressed={activeState === 'all'}
              aria-label={`Show all warm planning candidates (${totalCandidates})`}
            >
              <span data-planning-filter-label className="whitespace-nowrap">
                All
              </span>
              <span
                data-planning-filter-count
                className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-current/25 bg-background/30 px-1.5 text-[10px] font-semibold leading-none tabular-nums"
              >
                {totalCandidates}
              </span>
            </button>
            {STATE_ORDER.map((state) => {
              const active = activeState === state
              return (
                <button
                  key={state}
                  type="button"
                  onClick={() => onStateChange(active ? 'all' : state)}
                  className={`inline-flex min-h-8 max-w-full min-w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium leading-5 transition-colors ${
                    active
                      ? 'border-radiant-gold bg-radiant-gold/15 text-radiant-gold'
                      : 'border-silicon-slate/70 bg-background/40 text-muted-foreground hover:border-radiant-gold/50 hover:text-foreground'
                  }`}
                  aria-pressed={active}
                  aria-label={`Show ${backlog.filterLabels[state]} candidates (${backlog.counts[state]})`}
                >
                  <span className="shrink-0">
                    <StateIcon state={state} />
                  </span>
                  <span data-planning-filter-label className="shrink-0 whitespace-nowrap">
                    {planningFilterLabel(state)}
                  </span>
                  <span
                    data-planning-filter-count
                    className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-current/25 bg-background/30 px-1.5 text-[10px] font-semibold leading-none tabular-nums"
                  >
                    {backlog.counts[state]}
                  </span>
                </button>
              )
            })}
          </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex min-h-7 items-center gap-1 rounded-md border border-silicon-slate/70 bg-background/35 px-2">
          <LockKeyhole size={12} aria-hidden />
          Gmail drafts: off
        </span>
        <span className="inline-flex min-h-7 items-center gap-1 rounded-md border border-silicon-slate/70 bg-background/35 px-2">
          <LockKeyhole size={12} aria-hidden />
          Sends/Slack/social/SMS: off
        </span>
        <span className="inline-flex min-h-7 items-center gap-1 rounded-md border border-silicon-slate/70 bg-background/35 px-2">
          <Smartphone size={12} aria-hidden />
          SMS parked
        </span>
        <span className="inline-flex min-h-7 items-center gap-1 rounded-md border border-silicon-slate/70 bg-background/35 px-2">
          <CalendarDays size={12} aria-hidden />
          Existing Lead Pipeline only
        </span>
      </div>

      <div className="mt-3 grid gap-2" aria-label="Warm planning candidates">
        {visibleCandidates.slice(0, 8).map((candidate) => {
          const primaryState = candidatePrimaryState(candidate)
          return (
            <article
              key={candidate.contactId}
              className="grid gap-3.5 rounded-md border border-silicon-slate/70 bg-background/45 p-3 2xl:grid-cols-[minmax(0,1.1fr)_minmax(16rem,0.9fr)_minmax(10rem,auto)] 2xl:items-center"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                  <h3 className="min-w-0 text-sm font-semibold leading-5 text-foreground">
                    {candidate.contactName}
                  </h3>
                  {candidate.company && (
                    <span className="min-w-0 text-xs leading-5 text-muted-foreground">{candidate.company}</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2">
                  <span className={`inline-flex min-w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5 ${stateClasses(primaryState)}`}>
                    <StateIcon state={primaryState} />
                    {backlog.filterLabels[primaryState]}
                  </span>
                  {candidate.states.includes('sms_parked') && primaryState !== 'sms_parked' && (
                    <span className="inline-flex min-w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-silicon-slate/80 bg-background/35 px-2.5 py-0.5 text-[11px] leading-5 text-muted-foreground">
                      SMS parked
                    </span>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {candidate.relationshipBasis}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  <span className="font-medium text-foreground">Why next:</span> {candidate.campaignAlignment.whyNext}
                </p>
              </div>
              <div className="min-w-0 text-xs leading-5 text-muted-foreground">
                <div className="flex flex-wrap gap-x-1.5 gap-y-2">
                  <span className="inline-flex min-w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-radiant-gold/25 bg-radiant-gold/10 px-2.5 py-0.5 leading-5 text-radiant-gold">
                    {candidate.campaignAlignment.phaseLabel}
                  </span>
                  <span
                    className="inline-flex min-w-0 max-w-full items-center rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-0.5 leading-5 text-sky-100"
                    title={candidate.campaignAlignment.calendarSignal}
                  >
                    <span className="truncate">Calendar {candidate.campaignAlignment.phaseLabel}</span>
                  </span>
                  <span className="inline-flex min-w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-0.5 leading-5 text-sky-100">
                    {channelLabel(candidate.recommendedChannel)}
                  </span>
                  <span className="inline-flex min-w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-silicon-slate/70 bg-background/35 px-2.5 py-0.5 leading-5">
                    {draftReadinessLabel(candidate.draftReadiness)}
                  </span>
                  <span className="inline-flex min-w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-silicon-slate/70 bg-background/35 px-2.5 py-0.5 leading-5">
                    {approvalStateLabel(candidate.approvalState)}
                  </span>
                  <span className="inline-flex min-w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-silicon-slate/70 bg-background/35 px-2.5 py-0.5 leading-5">
                    {responseStatusLabel(candidate.responseStatus)}
                  </span>
                </div>
                <div className="mt-1 grid min-w-0 gap-1 text-[11px] leading-5">
                  <p className="truncate" title={candidate.campaignAlignment.sourceLabel}>
                    <span className="font-medium text-foreground">Source:</span> {candidate.campaignAlignment.sourceLabel}
                  </p>
                  <p className="truncate" title={candidate.campaignAlignment.cadenceSignal}>
                    <span className="font-medium text-foreground">Cadence:</span> {candidate.campaignAlignment.cadenceSignal}
                  </p>
                  <p className="truncate" title={candidate.campaignAlignment.contentProofPoint}>
                    <span className="font-medium text-foreground">Proof:</span> {candidate.campaignAlignment.contentProofPoint}
                  </p>
                  <p className="truncate" title={candidate.campaignAlignment.approvalGateLabel}>
                    <span className="font-medium text-foreground">Gate:</span> {candidate.campaignAlignment.approvalGateLabel}
                  </p>
                  <p className="truncate" title={candidate.campaignAlignment.safeNextAction}>
                    <span className="font-medium text-foreground">Safe next:</span> {candidate.campaignAlignment.safeNextAction}
                  </p>
                </div>
                {candidate.blockers.length > 0 && (
                  <p className="mt-1 truncate text-amber-100" title={candidate.blockers.join(' / ')}>
                    {candidate.blockers[0]}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onOpenCandidate(candidate)}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-silicon-slate/80 bg-silicon-slate/35 px-3 text-sm font-medium text-foreground transition-colors hover:bg-silicon-slate/55 2xl:w-auto"
                aria-label={`Open candidate review: ${candidate.nextActionLabel} for ${candidate.contactName}`}
              >
                <MessageSquare size={15} aria-hidden />
                {candidate.nextActionLabel}
              </button>
            </article>
          )
        })}
        {visibleCandidates.length === 0 && (
          <div className="rounded-md border border-silicon-slate/70 bg-background/35 p-3 text-sm text-muted-foreground">
            No candidates match this planning state.
          </div>
        )}
      </div>
    </section>
  )
}
