'use client'

import { AlertTriangle, CheckCircle, Clipboard, Info, Loader2, Mail, Send, ShieldCheck } from 'lucide-react'
import type { RelationshipPacketApiResponse } from './RelationshipPacketPanel'

export type WarmGmailDraftReviewData = {
  id: string
  contactSubmissionId: number | string | null
  channel: string
  status: string
  sequenceStep: number | null
  subject: string | null
  body: string | null
  createdAt: string
  generationModel: string | null
  generationPromptSummary: string | null
  generationInputs: Record<string, unknown> | null
}

type ReviewStage =
  | 'draft_only'
  | 'request_approval'
  | 'approval_pending'
  | 'approved'
  | 'live_send'
  | 'submitted'
  | 'blocked'

type WarmGmailDraftReviewPanelProps = {
  leadName: string
  leadEmail: string | null
  queueId: string | null
  linkedEmailMessageId?: string | null
  data: WarmGmailDraftReviewData | null
  loading: boolean
  error: string | null
  relationshipPacketData: RelationshipPacketApiResponse | null
  requestApprovalLoading?: boolean
  requestApprovalMessage?: string | null
  requestApprovalError?: string | null
  onCopyDraft?: (body: string) => void
  onRequestApproval?: (queueId: string) => void
}

function emailLifecycle(data: RelationshipPacketApiResponse | null) {
  const modes = data?.responseMonitoring?.sendReadiness?.modes?.warm_1_to_1 ?? []
  return modes.find((item) => item.channel === 'email')?.emailSendLifecycle ?? null
}

export function warmGmailDraftReviewStage(data: RelationshipPacketApiResponse | null): ReviewStage {
  const gate = emailLifecycle(data)?.gmailOperatingLoop?.executionGate
  if (!gate) return 'draft_only'
  if (gate.state === 'blocked') return 'blocked'
  if (gate.state === 'live_execution_eligible') return 'live_send'
  if (gate.state === 'live_execution_disabled') return 'approved'
  if (gate.state === 'authorization_required') return 'approval_pending'
  if (gate.state === 'approval_request_required') return 'request_approval'
  if (gate.state === 'submitted_evidence_recorded' || gate.state === 'response_monitoring') return 'submitted'
  return 'draft_only'
}

function stageLabel(stage: ReviewStage) {
  if (stage === 'draft_only') return 'Draft-only'
  if (stage === 'request_approval') return 'Request approval'
  if (stage === 'approval_pending') return 'Decision pending'
  if (stage === 'approved') return 'Approved'
  if (stage === 'live_send') return 'Live send gate'
  if (stage === 'submitted') return 'Sent evidence'
  return 'Blocked'
}

function stageTone(stage: ReviewStage) {
  if (stage === 'blocked') return 'border-red-500/35 bg-red-500/10 text-red-100'
  if (stage === 'approved' || stage === 'live_send' || stage === 'submitted') {
    return 'border-sky-500/35 bg-sky-500/10 text-sky-100'
  }
  if (stage === 'request_approval' || stage === 'approval_pending') {
    return 'border-amber-500/35 bg-amber-500/10 text-amber-100'
  }
  return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
}

function stepStatus(stage: ReviewStage, step: 'draft_only' | 'request_approval' | 'approved' | 'live_send') {
  const order = ['draft_only', 'request_approval', 'approved', 'live_send'] as const
  const normalized = stage === 'approval_pending' ? 'request_approval' : stage === 'submitted' ? 'live_send' : stage
  const currentIndex = order.indexOf(normalized as (typeof order)[number])
  const stepIndex = order.indexOf(step)
  if (stage === 'blocked') return step === 'draft_only' ? 'blocked' : 'upcoming'
  if (stage === 'submitted') return 'complete'
  if (stepIndex < currentIndex) return 'complete'
  if (stepIndex === currentIndex) return 'current'
  return 'upcoming'
}

function stepClasses(status: 'complete' | 'current' | 'upcoming' | 'blocked') {
  if (status === 'complete') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
  if (status === 'current') return 'border-radiant-gold/45 bg-radiant-gold/10 text-radiant-gold'
  if (status === 'blocked') return 'border-red-500/35 bg-red-500/10 text-red-100'
  return 'border-silicon-slate/70 bg-background/35 text-muted-foreground'
}

function primaryCta(stage: ReviewStage, hasBody: boolean) {
  if (stage === 'request_approval') return { label: 'Request send approval', icon: Send }
  if (stage === 'approval_pending') return { label: 'Review decision', icon: ShieldCheck }
  if (stage === 'approved' || stage === 'live_send') return { label: 'View gate keys', icon: ShieldCheck }
  if (stage === 'submitted') return { label: 'Review sent evidence', icon: CheckCircle }
  if (stage === 'blocked') return { label: 'Blocked', icon: AlertTriangle }
  return { label: hasBody ? 'Copy draft' : 'Draft body missing', icon: Clipboard }
}

export default function WarmGmailDraftReviewPanel({
  leadName,
  leadEmail,
  queueId,
  linkedEmailMessageId,
  data,
  loading,
  error,
  relationshipPacketData,
  requestApprovalLoading = false,
  requestApprovalMessage = null,
  requestApprovalError = null,
  onCopyDraft,
  onRequestApproval,
}: WarmGmailDraftReviewPanelProps) {
  const loop = emailLifecycle(relationshipPacketData)?.gmailOperatingLoop ?? null
  const gate = loop?.executionGate ?? null
  const stage = warmGmailDraftReviewStage(relationshipPacketData)
  const displayStage =
    stage === 'request_approval' && requestApprovalMessage && !requestApprovalError
      ? 'approval_pending'
      : stage
  const cta = primaryCta(displayStage, Boolean(data?.body?.trim()))
  const CtaIcon = cta.icon
  const body = data?.body?.trim() ?? ''
  const relationshipBasis = relationshipPacketData?.packet.relationshipBasis ?? 'Relationship packet loading.'
  const safeToMention = relationshipPacketData?.packet.sourceInventory?.safeToMention ?? []
  const missingLinkedMessage = linkedEmailMessageId === null || linkedEmailMessageId === undefined
  const ctaLinksToOperatingLoop =
    displayStage === 'approval_pending' ||
    displayStage === 'approved' ||
    displayStage === 'live_send' ||
    displayStage === 'submitted'
  const localApprovalRequestRecorded = stage === 'request_approval' && displayStage === 'approval_pending'
  const currentAction = loop?.nextAction
  const nextActionLabel = localApprovalRequestRecorded
    ? 'Review decision'
    : currentAction?.label ?? cta.label
  const nextActionDetail =
    localApprovalRequestRecorded
      ? requestApprovalMessage ?? 'Approval request recorded locally. Record approve, reject, or revise before any execution gate.'
      : currentAction?.detail ??
    (displayStage === 'draft_only'
      ? 'Review the saved body, then copy it for manual revision or continue from the existing queue row.'
      : gate?.safeNextStep ?? 'Continue from the existing warm Gmail operating loop.')
  const gateLabel = localApprovalRequestRecorded
    ? 'Authorization decision required'
    : gate?.label ?? stageLabel(displayStage)
  const gateDetail = localApprovalRequestRecorded
    ? nextActionDetail
    : gate?.blockedReason ?? gate?.safeNextStep ?? nextActionDetail

  const runPrimary = () => {
    if (displayStage === 'request_approval' && queueId) {
      onRequestApproval?.(queueId)
      return
    }
    if (displayStage === 'draft_only' && body) {
      onCopyDraft?.(body)
    }
  }

  const ctaDisabled =
    loading ||
    requestApprovalLoading ||
    displayStage === 'blocked' ||
    (displayStage === 'request_approval'
      ? !queueId || !onRequestApproval
      : displayStage === 'draft_only' && (!body || !onCopyDraft))

  return (
    <section
      id="warm-gmail-draft-review"
      className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 sm:p-4"
      aria-label={`Gmail draft review for ${leadName}`}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(11rem,auto)] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${stageTone(stage)}`}>
              <Mail size={13} className="shrink-0" aria-hidden />
              <span className="truncate">{stageLabel(displayStage)}</span>
            </span>
            <span className="rounded-full border border-silicon-slate/70 bg-background/40 px-2 py-0.5 text-[11px] text-muted-foreground">
              {data?.status ?? 'loading'}
            </span>
            <span className="rounded-full border border-silicon-slate/70 bg-background/40 px-2 py-0.5 text-[11px] text-muted-foreground">
              external send off
            </span>
            <span className="rounded-full border border-silicon-slate/70 bg-background/40 px-2 py-0.5 text-[11px] text-muted-foreground">
              {gateLabel}
            </span>
          </div>
          <h3 className="mt-2 truncate text-base font-semibold text-foreground">
            {data?.subject || `Warm draft review: ${leadName}`}
          </h3>
          <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
            <p className="min-w-0 rounded-md border border-silicon-slate/70 bg-background/35 px-2 py-1.5">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">To</span>
              <span className="block truncate text-foreground">{leadEmail || data?.contactSubmissionId || 'Missing'}</span>
            </p>
            <p className="min-w-0 rounded-md border border-silicon-slate/70 bg-background/35 px-2 py-1.5">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Queue</span>
              <span className="block truncate text-foreground">{queueId ?? data?.id ?? 'Missing'}</span>
            </p>
            <p className="min-w-0 rounded-md border border-silicon-slate/70 bg-background/35 px-2 py-1.5">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Linked message</span>
              <span className="block truncate text-foreground">{linkedEmailMessageId ?? 'Recovered here'}</span>
            </p>
          </div>
        </div>
        {displayStage === 'blocked' ? (
          <div
            role="status"
            className="inline-flex min-h-10 w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-red-500/35 bg-red-500/10 px-3 text-sm font-semibold text-red-100 lg:w-auto"
          >
            <CtaIcon size={15} aria-hidden />
            <span className="truncate">{nextActionLabel}</span>
          </div>
        ) : ctaLinksToOperatingLoop ? (
          <a
            href="#warm-gmail-operating-loop"
            className="inline-flex min-h-10 w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 text-sm font-semibold text-radiant-gold transition-colors hover:bg-radiant-gold/15 lg:w-auto"
          >
            <CtaIcon size={15} aria-hidden />
            <span className="truncate">{cta.label}</span>
          </a>
        ) : (
          <button
            type="button"
            disabled={ctaDisabled}
            onClick={runPrimary}
            className="inline-flex min-h-10 w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 text-sm font-semibold text-radiant-gold transition-colors hover:bg-radiant-gold/15 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
          >
            {requestApprovalLoading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <CtaIcon size={15} aria-hidden />}
            <span className="truncate">{requestApprovalLoading ? 'Preparing' : cta.label}</span>
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className={`rounded-md border px-3 py-2 text-sm ${stageTone(displayStage)}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-75">Current gate</p>
          <p className="mt-1 font-semibold">{gateLabel}</p>
          <p className="mt-1 text-xs leading-5 opacity-85">{gateDetail}</p>
        </div>
        <div className="rounded-md border border-silicon-slate/70 bg-background/35 px-3 py-2 text-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Next safe action</p>
          <p className="mt-1 font-semibold text-foreground">{nextActionLabel}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{nextActionDetail}</p>
        </div>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-4">
        {([
          ['draft_only', 'Draft-only'],
          ['request_approval', 'Approval request'],
          ['approved', 'Approved'],
          ['live_send', 'Live gate'],
        ] as const).map(([key, label]) => {
          const status = stepStatus(displayStage, key)
          return (
            <div key={key} className={`rounded-md border px-2 py-1.5 text-xs ${stepClasses(status)}`}>
              <p className="font-semibold">{label}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide opacity-75">{status}</p>
            </div>
          )
        })}
      </div>

      {error ? (
        <p className="mt-3 rounded-md border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      ) : loading ? (
        <p className="mt-3 rounded-md border border-silicon-slate/70 bg-background/35 px-3 py-5 text-center text-sm text-muted-foreground">
          Loading draft review...
        </p>
      ) : (
        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="min-w-0 rounded-md border border-silicon-slate/70 bg-white p-3 text-gray-900">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2 text-xs text-gray-500">
              <span>Saved queue body</span>
              <span>{data?.generationPromptSummary ?? 'draft-only planned'}</span>
            </div>
            {body ? (
              <div className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-sm leading-6">
                {body}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No body was saved on this queue row.</p>
            )}
          </div>
          <div className="min-w-0 space-y-2 text-sm">
            {missingLinkedMessage && (
              <div className="rounded-md border border-amber-500/35 bg-amber-500/10 p-2 text-amber-100">
                <p className="flex items-center gap-2 font-semibold">
                  <AlertTriangle size={14} className="shrink-0" aria-hidden />
                  Message link missing
                </p>
                <p className="mt-1 text-xs leading-5 opacity-85">
                  Review uses the saved queue body. Rebuild the email-message index later; do not leave this workroom.
                </p>
              </div>
            )}
            <details className="rounded-md border border-silicon-slate/70 bg-background/35 p-2">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-foreground">
                <Info size={14} className="shrink-0 text-muted-foreground" aria-hidden />
                Review details
              </summary>
              <div className="mt-2 space-y-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Relationship basis</p>
                  <p className="mt-1 line-clamp-4 text-sm leading-5 text-foreground">{relationshipBasis}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Safe to mention</p>
                  <p className="mt-1 truncate text-sm text-foreground">
                    {safeToMention.slice(0, 2).join(' / ') || 'Use relationship packet.'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Evidence keys</p>
                  <p className="mt-1 break-all text-xs leading-5 text-muted-foreground">
                    {loop?.audit.messageVersionKey ?? 'Message key pending'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Boundary</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Draft creation, approval, Slack dispatch, and live send stay separate.
                  </p>
                </div>
              </div>
            </details>
          </div>
        </div>
      )}

      {(requestApprovalMessage || requestApprovalError) && (
        <p className={`mt-3 rounded-md border px-3 py-2 text-sm ${
          requestApprovalError
            ? 'border-red-500/35 bg-red-500/10 text-red-100'
            : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
        }`}>
          {requestApprovalError ?? requestApprovalMessage}
        </p>
      )}
    </section>
  )
}
