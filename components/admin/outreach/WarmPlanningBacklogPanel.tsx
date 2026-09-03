'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  CalendarDays,
  LockKeyhole,
  Mail,
  MessageSquare,
  RefreshCw,
  Smartphone,
  UserRoundCheck,
} from 'lucide-react'
import type {
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
  onPrepareBatch: () => void
  onOpenCandidate: (candidate: WarmOutreachPlanningBacklogCandidate) => void
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

export default function WarmPlanningBacklogPanel({
  backlog,
  activeState,
  loading,
  error,
  onStateChange,
  onPrepareBatch,
  onOpenCandidate,
}: WarmPlanningBacklogPanelProps) {
  const visibleCandidates =
    activeState === 'all'
      ? backlog.candidates
      : backlog.candidates.filter((candidate) => candidate.states.includes(activeState))
  const totalCandidates = backlog.candidates.length

  return (
    <section
      className="mb-4 rounded-lg border border-radiant-gold/30 bg-radiant-gold/5 p-3 sm:p-4"
      aria-label="Warm outreach planning backlog"
    >
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(13rem,auto)] 2xl:items-start">
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
        </div>
        <div className="min-w-0">
          <button
            type="button"
            disabled={!backlog.currentCta.enabled || loading}
            onClick={onPrepareBatch}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 text-sm font-semibold text-radiant-gold transition-colors hover:bg-radiant-gold/15 disabled:cursor-not-allowed disabled:opacity-50 2xl:w-auto"
          >
            {loading ? (
              <RefreshCw size={15} className="animate-spin" aria-hidden />
            ) : (
              <ClipboardCheck size={15} aria-hidden />
            )}
            {loading ? 'Preparing plan...' : backlog.currentCta.label}
          </button>
          <p className="mt-2.5 text-xs leading-6 text-muted-foreground">
            {backlog.currentCta.reason}
          </p>
          {error && (
            <p role="alert" className="mt-2 rounded-md border border-red-500/25 bg-red-500/10 p-2 text-xs leading-5 text-red-100">
              {error}
            </p>
          )}
        </div>
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
      </div>

      <div className="mt-3 grid gap-2">
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
                    {candidate.campaignAlignment.phase}
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
                aria-label={`${candidate.nextActionLabel} for ${candidate.contactName}`}
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
