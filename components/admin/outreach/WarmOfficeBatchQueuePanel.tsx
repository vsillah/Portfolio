'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  LockKeyhole,
  Mail,
  MessageSquare,
  RefreshCw,
  Smartphone,
  UserRoundCheck,
} from 'lucide-react'
import type {
  WarmOutreachOfficeBatchQueue,
  WarmOutreachOfficeBatchQueueCandidate,
  WarmOutreachOfficeBatchQueueState,
} from '@/lib/warm-outreach-shortlist'

const STATE_ORDER: WarmOutreachOfficeBatchQueueState[] = [
  'ready_gmail_draft',
  'ready_manual_social',
  'needs_relationship_review',
  'waiting_on_response',
  'suppressed_blocked',
  'sms_parked',
]

interface WarmOfficeBatchQueuePanelProps {
  queue: WarmOutreachOfficeBatchQueue
  activeState: WarmOutreachOfficeBatchQueueState | 'all'
  loading: boolean
  error: string | null
  onStateChange: (state: WarmOutreachOfficeBatchQueueState | 'all') => void
  onPrepareBatch: () => void
  onOpenCandidate: (candidate: WarmOutreachOfficeBatchQueueCandidate) => void
}

function channelLabel(channel: WarmOutreachOfficeBatchQueueCandidate['recommendedChannel']) {
  if (channel === 'gmail') return 'Gmail'
  if (channel === 'linkedin') return 'LinkedIn'
  if (channel === 'facebook') return 'Facebook'
  if (channel === 'phone_contact') return 'Phone'
  return 'SMS'
}

function compactLabel(value: string) {
  return value.replace(/_/g, ' ')
}

function stateClasses(state: WarmOutreachOfficeBatchQueueState) {
  if (state === 'ready_gmail_draft') return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
  if (state === 'ready_manual_social') return 'border-sky-500/35 bg-sky-500/10 text-sky-100'
  if (state === 'waiting_on_response') return 'border-violet-500/35 bg-violet-500/10 text-violet-100'
  if (state === 'sms_parked') return 'border-silicon-slate/80 bg-background/40 text-muted-foreground'
  return 'border-amber-500/35 bg-amber-500/10 text-amber-100'
}

function StateIcon({ state }: { state: WarmOutreachOfficeBatchQueueState }) {
  if (state === 'ready_gmail_draft') return <Mail size={14} aria-hidden />
  if (state === 'ready_manual_social') return <UserRoundCheck size={14} aria-hidden />
  if (state === 'waiting_on_response') return <MessageSquare size={14} aria-hidden />
  if (state === 'sms_parked') return <Smartphone size={14} aria-hidden />
  return <AlertTriangle size={14} aria-hidden />
}

function candidatePrimaryState(candidate: WarmOutreachOfficeBatchQueueCandidate) {
  return candidate.states.find((state) => state !== 'sms_parked') ?? candidate.states[0] ?? 'needs_relationship_review'
}

export default function WarmOfficeBatchQueuePanel({
  queue,
  activeState,
  loading,
  error,
  onStateChange,
  onPrepareBatch,
  onOpenCandidate,
}: WarmOfficeBatchQueuePanelProps) {
  const visibleCandidates =
    activeState === 'all'
      ? queue.candidates
      : queue.candidates.filter((candidate) => candidate.states.includes(activeState))

  return (
    <section
      className="mb-4 rounded-lg border border-radiant-gold/30 bg-radiant-gold/5 p-3 sm:p-4"
      aria-label="Office-week warm outreach batch queue"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(13rem,auto)] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-radiant-gold">
              Office-week queue
            </p>
            <span className="rounded-full border border-silicon-slate/70 bg-background/45 px-2 py-0.5 text-xs text-muted-foreground">
              {queue.weekLabel}
            </span>
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-100">
              external requests {queue.executionBoundary.externalRequests.length}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {STATE_ORDER.map((state) => {
              const active = activeState === state
              return (
                <button
                  key={state}
                  type="button"
                  onClick={() => onStateChange(active ? 'all' : state)}
                  className={`min-w-0 rounded-md border px-2.5 py-2 text-left transition-colors ${
                    active
                      ? 'border-radiant-gold bg-radiant-gold/15 text-radiant-gold'
                      : 'border-silicon-slate/70 bg-background/40 text-muted-foreground hover:border-radiant-gold/50 hover:text-foreground'
                  }`}
                  aria-pressed={active}
                  aria-label={`Show ${queue.filterLabels[state]} candidates`}
                >
                  <span className="block truncate text-[10px] font-semibold uppercase tracking-wide">
                    {queue.filterLabels[state]}
                  </span>
                  <span className="mt-1 block text-lg font-semibold">{queue.counts[state]}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="min-w-0">
          <button
            type="button"
            disabled={!queue.currentCta.enabled || loading}
            onClick={onPrepareBatch}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 text-sm font-semibold text-radiant-gold transition-colors hover:bg-radiant-gold/15 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
          >
            {loading ? (
              <RefreshCw size={15} className="animate-spin" aria-hidden />
            ) : (
              <ClipboardCheck size={15} aria-hidden />
            )}
            {loading ? 'Preparing plan...' : queue.currentCta.label}
          </button>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {queue.currentCta.reason}
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
              className="grid gap-3 rounded-md border border-silicon-slate/70 bg-background/45 p-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(16rem,0.9fr)_minmax(10rem,auto)] lg:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${stateClasses(primaryState)}`}>
                    <StateIcon state={primaryState} />
                    {queue.filterLabels[primaryState]}
                  </span>
                  {candidate.states.includes('sms_parked') && primaryState !== 'sms_parked' && (
                    <span className="rounded-full border border-silicon-slate/80 bg-background/35 px-2 py-0.5 text-[11px] text-muted-foreground">
                      SMS parked
                    </span>
                  )}
                  <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">
                    {candidate.contactName}
                  </h3>
                  {candidate.company && (
                    <span className="truncate text-xs text-muted-foreground">{candidate.company}</span>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {candidate.relationshipBasis}
                </p>
              </div>
              <div className="min-w-0 text-xs leading-5 text-muted-foreground">
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-sky-100">
                    {channelLabel(candidate.recommendedChannel)}
                  </span>
                  <span className="rounded-full border border-silicon-slate/70 bg-background/35 px-2 py-0.5">
                    Draft: {compactLabel(candidate.draftReadiness)}
                  </span>
                  <span className="rounded-full border border-silicon-slate/70 bg-background/35 px-2 py-0.5">
                    Approval: {compactLabel(candidate.approvalState)}
                  </span>
                  <span className="rounded-full border border-silicon-slate/70 bg-background/35 px-2 py-0.5">
                    Response: {compactLabel(candidate.responseStatus)}
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
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-silicon-slate/80 bg-silicon-slate/35 px-3 text-sm font-medium text-foreground transition-colors hover:bg-silicon-slate/55 lg:w-auto"
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
            No candidates match this queue state.
          </div>
        )}
      </div>
    </section>
  )
}
