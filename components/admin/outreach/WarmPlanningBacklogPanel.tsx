'use client'

import { useEffect, useState } from 'react'
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
  X,
} from 'lucide-react'
import type {
  WarmOutreachDailyActionRow,
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
  selectedContactId?: number | null
  openedContactId?: number | null
  onStateChange: (state: WarmOutreachPlanningBacklogState | 'all') => void
  onSelectedContactChange?: (contactId: number | null) => void
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

const DAILY_ACTION_FILTERS: WarmOutreachDailyActionKind[] = [
  'gmail_draft_review',
  'manual_social_handoff',
  'reply_follow_up',
  'relationship_recovery',
  'blocked_suppressed',
  'sms_parked',
]

function dailyActionFilterLabel(kind: WarmOutreachDailyActionKind) {
  if (kind === 'gmail_draft_review') return 'Gmail'
  if (kind === 'manual_social_handoff') return 'Manual'
  if (kind === 'reply_follow_up') return 'Replies'
  if (kind === 'relationship_recovery') return 'Recovery'
  if (kind === 'blocked_suppressed') return 'Blocked'
  return 'SMS parked'
}

function dailyActionFilterAriaLabel(kind: WarmOutreachDailyActionKind) {
  if (kind === 'gmail_draft_review') return 'Show Gmail draft review actions'
  if (kind === 'manual_social_handoff') return 'Show manual social handoff actions'
  if (kind === 'reply_follow_up') return 'Show reply follow-up actions'
  if (kind === 'relationship_recovery') return 'Show relationship recovery actions'
  if (kind === 'blocked_suppressed') return 'Show blocked or suppressed actions'
  return 'Show SMS parked actions'
}

function dailyActionFilterCount(
  summary: WarmOutreachPlanningBacklog['dailyActions']['summary'],
  kind: WarmOutreachDailyActionKind,
) {
  if (kind === 'gmail_draft_review') return summary.gmailDraftReviewCount
  if (kind === 'manual_social_handoff') return summary.manualSocialHandoffCount
  if (kind === 'reply_follow_up') return summary.replyFollowUpCount
  if (kind === 'relationship_recovery') return summary.relationshipRecoveryCount
  if (kind === 'blocked_suppressed') return summary.blockedSuppressedCount
  return summary.smsParkedCount
}

function dailyActionFilterEmptyLabel(kind: WarmOutreachDailyActionKind) {
  if (kind === 'gmail_draft_review') return 'No Gmail draft reviews today.'
  if (kind === 'manual_social_handoff') return 'No manual handoffs today.'
  if (kind === 'reply_follow_up') return 'No replies today.'
  if (kind === 'relationship_recovery') return 'No recovery actions today.'
  if (kind === 'blocked_suppressed') return 'No blocked actions today.'
  return 'No SMS parked actions today.'
}

function dailyActionMatchesFilter(row: WarmOutreachDailyActionRow, kind: WarmOutreachDailyActionKind) {
  if (kind === 'sms_parked') return row.smsParked
  return row.kind === kind
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

type WarmReviewLoopProgress = {
  actionKey: string
  state: 'opening' | 'opened'
  channelLabel: string
  contactName: string
  selectedCount: number
  reviewedCount: number
  remainingInBatchCount: number
  readyBacklogCount: number
  nextCandidateName: string | null
  statusLabel: string
}

function reviewLoopProgressForCandidate(
  backlog: WarmOutreachPlanningBacklog,
  actionKey: string,
  candidate: WarmOutreachPlanningBacklogCandidate,
  state: WarmReviewLoopProgress['state'],
): WarmReviewLoopProgress {
  const isManualBatch = candidate.reviewLoopAction.key === 'start_manual_social_batch'
  const readyBacklogCount = isManualBatch
    ? backlog.dailyActions.summary.manualSocialHandoffCount
    : backlog.dailyActions.summary.gmailDraftReviewCount
  const nextCandidate = backlog.dailyActions.rows.find((row) =>
    row.key !== actionKey &&
    row.enabled &&
    (isManualBatch ? row.kind === 'manual_social_handoff' : row.kind === 'gmail_draft_review')
  )
  return {
    actionKey,
    state,
    channelLabel: isManualBatch ? 'Manual social' : 'Gmail',
    contactName: candidate.contactName,
    selectedCount: 1,
    reviewedCount: 0,
    remainingInBatchCount: 1,
    readyBacklogCount,
    nextCandidateName: nextCandidate?.contactName ?? null,
    statusLabel: candidate.reviewLoopAction.statusLabel,
  }
}

function reviewLoopProgressForBatch(
  backlog: WarmOutreachPlanningBacklog,
  state: WarmReviewLoopProgress['state'],
): WarmReviewLoopProgress | null {
  const contactIds = backlog.dailyActions.currentSafestAction.contactIds
  if (contactIds.length === 0) return null
  const startsManual = backlog.dailyActions.currentSafestAction.key === 'start_manual_social_loop'
  const selectedNames = backlog.candidates
    .filter((candidate) => contactIds.includes(candidate.contactId))
    .map((candidate) => candidate.contactName)
  const selectedName = selectedNames[0] ?? 'Selected lead'
  const readyBacklogCount = startsManual
    ? backlog.dailyActions.summary.manualSocialHandoffCount
    : backlog.dailyActions.summary.gmailDraftReviewCount
  const nextCandidate = backlog.dailyActions.rows.find((row) =>
    !contactIds.includes(row.contactId) &&
    row.enabled &&
    (startsManual ? row.kind === 'manual_social_handoff' : row.kind === 'gmail_draft_review')
  )
  return {
    actionKey: backlog.dailyActions.currentSafestAction.key,
    state,
    channelLabel: startsManual ? 'Manual social' : 'Gmail',
    contactName: contactIds.length === 1 ? selectedName : `${selectedName} +${contactIds.length - 1}`,
    selectedCount: contactIds.length,
    reviewedCount: 0,
    remainingInBatchCount: contactIds.length,
    readyBacklogCount,
    nextCandidateName: nextCandidate?.contactName ?? null,
    statusLabel: 'Review batch selected',
  }
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
  focusDestinationSelector(selector)
}

function actionDrawerLabel(action: WarmOutreachPlanningBacklogCandidate['reviewLoopAction']) {
  if (action.key === 'start_gmail_review_batch' || action.key === 'open_gmail_draft_review') {
    return 'Gmail draft review'
  }
  if (action.key === 'start_manual_social_batch' || action.key === 'open_manual_social_handoff') {
    return 'Manual social handoff'
  }
  if (action.key === 'open_response_review') return 'Response review'
  if (action.key === 'open_relationship_review') return 'Relationship recovery'
  if (action.key === 'resolve_blocker') return 'Suppression review'
  return 'SMS parked'
}

function actionDrawerHelper(action: WarmOutreachPlanningBacklogCandidate['reviewLoopAction']) {
  if (action.key === 'parked_sms') return action.blockerReason ?? 'SMS remains parked behind a separate gate.'
  if (!action.enabled) return action.blockerReason ?? 'This candidate is blocked.'
  return action.afterClick
}

function actionRecoveryPath(action: WarmOutreachPlanningBacklogCandidate['reviewLoopAction']) {
  if (action.key === 'resolve_blocker') return 'Recovery path: open the contact workroom and resolve suppression or contact status first.'
  if (action.key === 'open_relationship_review') return 'Recovery path: open the relationship packet and confirm the relationship basis.'
  if (action.key === 'open_response_review') return 'Recovery path: review response state before another touchpoint.'
  if (action.key === 'parked_sms') return 'Recovery path: wait for the separate Telnyx and per-recipient SMS gate.'
  return null
}

function focusDestinationSelector(selector: string) {
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
  selectedContactId = null,
  openedContactId = null,
  onStateChange,
  onSelectedContactChange,
  onPrepareBatch,
  onPrepareCandidateReview,
  onOpenCandidate,
}: WarmPlanningBacklogPanelProps) {
  const [openedDailyActionKey, setOpenedDailyActionKey] = useState<string | null>(null)
  const [pendingDailyActionKey, setPendingDailyActionKey] = useState<string | null>(null)
  const [reviewLoopProgress, setReviewLoopProgress] = useState<WarmReviewLoopProgress | null>(null)
  const [activeDailyActionFilter, setActiveDailyActionFilter] = useState<WarmOutreachDailyActionKind | 'all'>('all')
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(selectedContactId)
  const [pendingCandidateActionId, setPendingCandidateActionId] = useState<number | null>(null)
  const [openedCandidateActionId, setOpenedCandidateActionId] = useState<number | null>(openedContactId)
  useEffect(() => {
    setSelectedCandidateId(selectedContactId)
  }, [selectedContactId])
  useEffect(() => {
    setOpenedCandidateActionId(openedContactId)
  }, [openedContactId])
  const selectCandidate = (contactId: number | null) => {
    setSelectedCandidateId(contactId)
    onSelectedContactChange?.(contactId)
  }
  const filteredDailyActionRows =
    activeDailyActionFilter === 'all'
      ? backlog.dailyActions.rows
      : backlog.dailyActions.rows.filter((row) => dailyActionMatchesFilter(row, activeDailyActionFilter))
  const filteredDailyActionContactIds = new Set(filteredDailyActionRows.map((row) => row.contactId))
  const visibleCandidates = backlog.candidates.filter((candidate) => {
    const stateMatches = activeState === 'all' || candidate.states.includes(activeState)
    const dailyActionMatches = activeDailyActionFilter === 'all' || filteredDailyActionContactIds.has(candidate.contactId)
    return stateMatches && dailyActionMatches
  })
  const selectedCandidate =
    selectedCandidateId == null
      ? null
      : visibleCandidates.find((candidate) => candidate.contactId === selectedCandidateId) ?? null
  const totalCandidates = backlog.candidates.length
  const primaryDailyAction = backlog.dailyActions.currentSafestAction
  const primaryDailyCandidate = primaryDailyAction.key === 'open_daily_action'
    ? backlog.candidates.find((candidate) => candidate.contactId === primaryDailyAction.contactIds[0])
    : null
  const primaryActionPending = pendingDailyActionKey === primaryDailyAction.key
  const primaryActionOpened = openedDailyActionKey === primaryDailyAction.key
  const primaryActionEnabled = primaryDailyAction.key === 'open_daily_action'
    ? primaryDailyAction.enabled && Boolean(primaryDailyCandidate) && !primaryActionPending && !primaryActionOpened
    : backlog.currentCta.enabled && !primaryActionPending && !primaryActionOpened
  const visibleDailyActions = filteredDailyActionRows.slice(0, 6)
  const activeDailyActionFilterLabel =
    activeDailyActionFilter === 'all' ? null : dailyActionFilterLabel(activeDailyActionFilter)
  const handlePrimaryAction = async () => {
    if (!primaryActionEnabled || loading) return
    setPendingDailyActionKey(primaryDailyAction.key)
    try {
      if (primaryDailyCandidate) {
        await onOpenCandidate(primaryDailyCandidate)
        setOpenedDailyActionKey(primaryDailyAction.key)
        return
      }
      const openingProgress = reviewLoopProgressForBatch(backlog, 'opening')
      if (openingProgress) setReviewLoopProgress(openingProgress)
      await onPrepareBatch()
      const openedProgress = reviewLoopProgressForBatch(backlog, 'opened')
      if (openedProgress) setReviewLoopProgress(openedProgress)
      setOpenedDailyActionKey(primaryDailyAction.key)
      focusDestinationSelector('#gmail-batch-draft-plan, [aria-label="Warm batch review"]')
    } finally {
      setPendingDailyActionKey(null)
    }
  }
  const handleCandidateAction = async (candidate: WarmOutreachPlanningBacklogCandidate) => {
    const action = candidate.reviewLoopAction
    if (!action.enabled || loading || pendingCandidateActionId === candidate.contactId || openedCandidateActionId === candidate.contactId) {
      return
    }
    setPendingCandidateActionId(candidate.contactId)
    try {
      if (preparesReviewBatch(action)) {
        setReviewLoopProgress(reviewLoopProgressForCandidate(backlog, `candidate-drawer:${candidate.contactId}`, candidate, 'opening'))
        await onPrepareCandidateReview(candidate)
        setReviewLoopProgress(reviewLoopProgressForCandidate(backlog, `candidate-drawer:${candidate.contactId}`, candidate, 'opened'))
        setOpenedCandidateActionId(candidate.contactId)
        focusActionDestination(action)
        return
      }
      await onOpenCandidate(candidate)
      setOpenedCandidateActionId(candidate.contactId)
      focusActionDestination(action)
    } finally {
      setPendingCandidateActionId(null)
    }
  }
  const selectedAction = selectedCandidate?.reviewLoopAction ?? null
  const selectedPrimaryState = selectedCandidate ? candidatePrimaryState(selectedCandidate) : null
  const selectedCandidatePending = selectedCandidate ? pendingCandidateActionId === selectedCandidate.contactId : false
  const selectedCandidateOpened = selectedCandidate ? openedCandidateActionId === selectedCandidate.contactId : false
  const selectedCandidateActionEnabled = Boolean(
    selectedCandidate &&
      selectedAction?.enabled &&
      !selectedCandidatePending &&
      !selectedCandidateOpened &&
      !loading,
  )

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
            className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
              primaryActionOpened
                ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
                : primaryActionPending
                  ? 'border-radiant-gold/50 bg-radiant-gold/10 text-radiant-gold'
                  : 'border-radiant-gold/50 bg-radiant-gold/10 text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-50'
            }`}
          >
            {loading || primaryActionPending ? (
              <RefreshCw size={15} className="animate-spin" aria-hidden />
            ) : primaryActionOpened ? (
              <CheckCircle2 size={15} aria-hidden />
            ) : (
              <ClipboardCheck size={15} aria-hidden />
            )}
            {loading
              ? 'Preparing plan...'
              : primaryActionPending
                ? 'Opening review...'
                : primaryActionOpened
                  ? 'Review batch selected'
                  : primaryDailyAction.label}
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

      {reviewLoopProgress && (
        <div
          className={`mt-3 rounded-md border p-3 ${
            reviewLoopProgress.state === 'opened'
              ? 'border-emerald-500/25 bg-emerald-500/5'
              : 'border-radiant-gold/25 bg-radiant-gold/5'
          }`}
          role="status"
          aria-label="Warm review loop progress"
        >
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] leading-5">
            <span className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 font-semibold uppercase tracking-wide ${
              reviewLoopProgress.state === 'opened'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                : 'border-radiant-gold/30 bg-radiant-gold/10 text-radiant-gold'
            }`}>
              {reviewLoopProgress.state === 'opened' ? (
                <CheckCircle2 size={12} aria-hidden />
              ) : (
                <RefreshCw size={12} className="animate-spin" aria-hidden />
              )}
              {reviewLoopProgress.state === 'opened' ? 'Review batch selected' : 'Opening review batch'}
            </span>
            <span className="inline-flex min-h-7 shrink-0 items-center whitespace-nowrap rounded-md border border-silicon-slate/70 bg-background/45 px-2 text-muted-foreground">
              {reviewLoopProgress.channelLabel}
            </span>
            <span className="inline-flex min-h-7 shrink-0 items-center whitespace-nowrap rounded-md border border-silicon-slate/70 bg-background/45 px-2 text-muted-foreground">
              {reviewLoopProgress.selectedCount} in batch
            </span>
            <span className="inline-flex min-h-7 shrink-0 items-center whitespace-nowrap rounded-md border border-silicon-slate/70 bg-background/45 px-2 text-muted-foreground">
              {reviewLoopProgress.reviewedCount} reviewed
            </span>
            <span className="inline-flex min-h-7 shrink-0 items-center whitespace-nowrap rounded-md border border-silicon-slate/70 bg-background/45 px-2 text-muted-foreground">
              {reviewLoopProgress.remainingInBatchCount} remaining
            </span>
            <span className="inline-flex min-h-7 min-w-0 max-w-full items-center rounded-md border border-sky-500/25 bg-sky-500/10 px-2 text-sky-100">
              <span className="truncate">Backlog ready {reviewLoopProgress.readyBacklogCount}</span>
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {reviewLoopProgress.statusLabel}: {reviewLoopProgress.contactName}. Next candidate: {reviewLoopProgress.nextCandidateName ?? 'none in this view'}.
          </p>
        </div>
      )}

      <div className="mt-3 grid gap-2">
            <div className="min-w-0 rounded-md border border-radiant-gold/25 bg-background/35 p-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2" aria-label="Warm planning campaign context">
                <span className="inline-flex min-h-7 shrink-0 items-center whitespace-nowrap rounded-md border border-silicon-slate/70 bg-background/45 px-2 text-[11px] leading-5 text-muted-foreground">
                  {stateSummaryLabel(backlog)}
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
                <div
                  className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(7.25rem,1fr))] gap-1.5 text-[11px] leading-5 text-muted-foreground"
                  role="group"
                  aria-label="Warm daily action filters"
                >
                  {DAILY_ACTION_FILTERS.map((kind) => {
                    const active = activeDailyActionFilter === kind
                    const count = dailyActionFilterCount(backlog.dailyActions.summary, kind)
                    return (
                        <button
                        key={kind}
                        type="button"
                        onClick={() => {
                          selectCandidate(null)
                          setActiveDailyActionFilter(active ? 'all' : kind)
                        }}
                        className={`inline-flex min-h-8 min-w-0 items-center justify-between gap-2 rounded-full border px-2.5 py-0.5 text-left font-medium leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-radiant-gold/70 ${
                          active
                            ? 'border-radiant-gold bg-radiant-gold/15 text-radiant-gold shadow-[0_0_0_1px_rgba(247,213,107,0.25)]'
                            : `${dailyActionClasses(kind)} hover:border-radiant-gold/50 hover:text-foreground`
                        }`}
                        aria-pressed={active}
                        aria-label={`${dailyActionFilterAriaLabel(kind)} (${count})`}
                      >
                        <span className="min-w-0 whitespace-nowrap">{dailyActionFilterLabel(kind)}</span>
                        {' '}
                        <b className="shrink-0 tabular-nums">{count}</b>
                      </button>
                    )
                  })}
                </div>
              </div>
              {activeDailyActionFilterLabel && (
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-[11px] leading-5 text-muted-foreground">
                  <span className="inline-flex min-h-7 min-w-0 max-w-full items-center rounded-md border border-radiant-gold/25 bg-radiant-gold/10 px-2 text-radiant-gold">
                    <span className="truncate">Filtering actions: {activeDailyActionFilterLabel}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      selectCandidate(null)
                      setActiveDailyActionFilter('all')
                    }}
                    className="inline-flex min-h-7 shrink-0 items-center rounded-md border border-silicon-slate/70 bg-background/45 px-2 font-medium text-muted-foreground transition-colors hover:border-radiant-gold/50 hover:text-foreground"
                    aria-label="Clear daily action filter"
                  >
                    Clear
                  </button>
                </div>
              )}
              <div className="mt-3 grid gap-2 xl:grid-cols-2">
                {visibleDailyActions.map((action) => {
                  const candidate = backlog.candidates.find((row) => row.contactId === action.contactId)
                  const loopAction = action.reviewLoopAction
                  const actionOpened = openedDailyActionKey === action.key
                  const actionPending = pendingDailyActionKey === action.key
                  const actionDisabled = !action.enabled || !candidate || actionOpened || actionPending
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
                          setPendingDailyActionKey(action.key)
                          try {
                            if (preparesReviewBatch(loopAction)) {
                              setReviewLoopProgress(reviewLoopProgressForCandidate(backlog, action.key, candidate, 'opening'))
                              await onPrepareCandidateReview(candidate)
                              setOpenedDailyActionKey(action.key)
                              setReviewLoopProgress(reviewLoopProgressForCandidate(backlog, action.key, candidate, 'opened'))
                              focusActionDestination(loopAction)
                              return
                            }
                            await onOpenCandidate(candidate)
                            setOpenedDailyActionKey(action.key)
                            focusActionDestination(loopAction)
                          } finally {
                            setPendingDailyActionKey(null)
                          }
                        }}
                        className={`inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium leading-5 transition-colors disabled:cursor-not-allowed ${
                          actionOpened
                            ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
                            : actionPending
                              ? 'border-radiant-gold/35 bg-radiant-gold/10 text-radiant-gold'
                            : 'border-silicon-slate/80 bg-silicon-slate/35 text-foreground hover:bg-silicon-slate/55 disabled:opacity-50'
                        }`}
                        aria-label={`${action.ctaLabel} for ${action.contactName}`}
                      >
                        {actionPending ? (
                          <RefreshCw size={14} className="animate-spin" aria-hidden />
                        ) : actionOpened ? (
                          <CheckCircle2 size={14} aria-hidden />
                        ) : action.loopStatus === 'completed' || action.loopStatus === 'parked' ? (
                          <LoopStatusIcon status={action.loopStatus} />
                        ) : (
                          <DailyActionIcon kind={action.kind} />
                        )}
                        {actionPending ? 'Opening review...' : actionOpened ? openedActionLabel(loopAction) : action.ctaLabel}
                      </button>
                    </article>
                  )
                })}
                {visibleDailyActions.length === 0 && activeDailyActionFilter !== 'all' && (
                  <div className="rounded-md border border-silicon-slate/70 bg-background/35 p-3 text-sm text-muted-foreground">
                    {dailyActionFilterEmptyLabel(activeDailyActionFilter)}
                  </div>
                )}
              </div>
              {filteredDailyActionRows.length > visibleDailyActions.length && (
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                  {filteredDailyActionRows.length - visibleDailyActions.length} more warm action{filteredDailyActionRows.length - visibleDailyActions.length === 1 ? '' : 's'} stay in the filtered candidate list below.
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
              onClick={() => {
                selectCandidate(null)
                onStateChange('all')
              }}
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
                  onClick={() => {
                    selectCandidate(null)
                    onStateChange(active ? 'all' : state)
                  }}
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

      {selectedCandidate && selectedAction && selectedPrimaryState && (
        <aside
          className="mt-3 rounded-md border border-radiant-gold/30 bg-background/55 p-3 shadow-[0_0_0_1px_rgba(247,213,107,0.08)]"
          aria-label={`Warm planning action drawer for ${selectedCandidate.contactName}`}
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,auto)] lg:items-start">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className={`inline-flex min-w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5 ${stateClasses(selectedPrimaryState)}`}>
                  <StateIcon state={selectedPrimaryState} />
                  {actionDrawerLabel(selectedAction)}
                </span>
                <span className="inline-flex min-w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-silicon-slate/70 bg-background/35 px-2.5 py-0.5 text-[11px] leading-5 text-muted-foreground">
                  {channelLabel(selectedCandidate.recommendedChannel)}
                </span>
                <span className="inline-flex min-w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-silicon-slate/70 bg-background/35 px-2.5 py-0.5 text-[11px] leading-5 text-muted-foreground">
                  {selectedAction.statusLabel}
                </span>
                {selectedCandidate.states.includes('sms_parked') && (
                  <span className="inline-flex min-w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-silicon-slate/80 bg-background/35 px-2.5 py-0.5 text-[11px] leading-5 text-muted-foreground">
                    SMS parked
                  </span>
                )}
              </div>
              <div className="mt-2 flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-5 text-foreground">
                    {selectedCandidate.contactName}
                    {selectedCandidate.company ? ` · ${selectedCandidate.company}` : ''}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    <span className="font-medium text-foreground">Why in backlog:</span> {selectedCandidate.campaignAlignment.whyNext}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => selectCandidate(null)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-silicon-slate/70 bg-background/35 text-muted-foreground transition-colors hover:border-radiant-gold/50 hover:text-foreground"
                  aria-label="Close warm planning action drawer"
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
              <div className="mt-3 grid gap-2 text-xs leading-5 text-muted-foreground md:grid-cols-3">
                <div className="min-w-0 rounded-md border border-silicon-slate/70 bg-background/35 p-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">Current safest action</p>
                  <p className="mt-1 line-clamp-2 font-medium text-foreground">{selectedCandidate.campaignAlignment.safeNextAction}</p>
                </div>
                <div className="min-w-0 rounded-md border border-silicon-slate/70 bg-background/35 p-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">Action path</p>
                  <p className="mt-1 line-clamp-2 font-medium text-foreground">{selectedAction.detail}</p>
                </div>
                <div className="min-w-0 rounded-md border border-silicon-slate/70 bg-background/35 p-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">Blockers</p>
                  <p className={`mt-1 line-clamp-2 font-medium ${selectedCandidate.blockers.length > 0 ? 'text-amber-100' : 'text-foreground'}`}>
                    {selectedCandidate.blockers.length > 0 ? selectedCandidate.blockers.join(' / ') : 'None blocking local review'}
                  </p>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {actionDrawerHelper(selectedAction)}
              </p>
              {actionRecoveryPath(selectedAction) && (
                <p className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/10 p-2 text-xs leading-5 text-amber-100">
                  {actionRecoveryPath(selectedAction)}
                </p>
              )}
            </div>
            <div className="min-w-0">
              <button
                type="button"
                disabled={!selectedCandidateActionEnabled}
                onClick={() => handleCandidateAction(selectedCandidate)}
                className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold leading-5 transition-colors disabled:cursor-not-allowed ${
                  selectedCandidateOpened
                    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
                    : selectedCandidatePending
                      ? 'border-radiant-gold/35 bg-radiant-gold/10 text-radiant-gold'
                      : 'border-radiant-gold/50 bg-radiant-gold/10 text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-50'
                }`}
                aria-label={`${selectedAction.label} for ${selectedCandidate.contactName}`}
              >
                {selectedCandidatePending ? (
                  <RefreshCw size={15} className="animate-spin" aria-hidden />
                ) : selectedCandidateOpened ? (
                  <CheckCircle2 size={15} aria-hidden />
                ) : selectedAction.key === 'parked_sms' ? (
                  <LockKeyhole size={15} aria-hidden />
                ) : (
                  <ClipboardCheck size={15} aria-hidden />
                )}
                {selectedCandidatePending ? 'Opening review...' : selectedCandidateOpened ? openedActionLabel(selectedAction) : selectedAction.label}
              </button>
              {!selectedAction.enabled && (
                <p className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/10 p-2 text-xs leading-5 text-amber-100">
                  {selectedAction.blockerReason ?? 'This planning action is disabled.'}
                </p>
              )}
              {selectedAction.href && (
                <p className="mt-2 truncate text-[11px] leading-5 text-muted-foreground" title={selectedAction.href}>
                  Deep link: {selectedAction.href}
                </p>
              )}
            </div>
          </div>
        </aside>
      )}

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
                  {openedCandidateActionId === candidate.contactId && (
                    <span className="inline-flex min-w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] leading-5 text-emerald-100">
                      <CheckCircle2 size={12} aria-hidden />
                      In review
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
                onClick={() => selectCandidate(candidate.contactId)}
                className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors 2xl:w-auto ${
                  selectedCandidateId === candidate.contactId
                    ? 'border-radiant-gold/60 bg-radiant-gold/10 text-radiant-gold'
                    : 'border-silicon-slate/80 bg-silicon-slate/35 text-foreground hover:bg-silicon-slate/55'
                }`}
                aria-expanded={selectedCandidateId === candidate.contactId}
                aria-label={`Open action drawer: ${candidate.nextActionLabel} for ${candidate.contactName}`}
              >
                <MessageSquare size={15} aria-hidden />
                {candidate.nextActionLabel}
              </button>
            </article>
          )
        })}
        {visibleCandidates.length === 0 && (
          <div className="rounded-md border border-silicon-slate/70 bg-background/35 p-3 text-sm text-muted-foreground">
            {activeDailyActionFilter === 'all'
              ? 'No candidates match this planning state.'
              : dailyActionFilterEmptyLabel(activeDailyActionFilter)}
          </div>
        )}
      </div>
    </section>
  )
}
