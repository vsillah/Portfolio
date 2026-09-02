'use client'

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileText,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react'
import type {
  WarmBatchReview,
  WarmGmailBatchDraftPlanRow,
  WarmBatchReviewRecipient,
} from '@/lib/warm-outreach-batch-review'

interface WarmBatchReviewPanelProps {
  data: WarmBatchReview | null
  loading: boolean
  error: string | null
  draftActionLoading: boolean
  draftActionError: string | null
  selectedCount: number
  onReview: () => void
  onCreateGmailDraftRecords: () => void
}

function statusLabel(status: WarmBatchReviewRecipient['status']) {
  if (status === 'ready_for_review') return 'Ready'
  if (status === 'existing_draft') return 'Existing draft'
  return 'Blocked'
}

function statusClasses(status: WarmBatchReviewRecipient['status']) {
  if (status === 'ready_for_review') return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
  if (status === 'existing_draft') return 'border-sky-500/35 bg-sky-500/10 text-sky-100'
  return 'border-red-500/35 bg-red-500/10 text-red-100'
}

function draftPlanStatusClasses(status: WarmGmailBatchDraftPlanRow['status']) {
  if (status === 'ready_for_local_planning') return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
  if (status === 'approval_required') return 'border-sky-500/35 bg-sky-500/10 text-sky-100'
  if (status === 'excluded_submitted') return 'border-silicon-slate/80 bg-silicon-slate/35 text-muted-foreground'
  return 'border-red-500/35 bg-red-500/10 text-red-100'
}

function readinessClasses(state: WarmGmailBatchDraftPlanRow['readiness'][number]['state']) {
  if (state === 'clear') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
  if (state === 'needs_review') return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
  if (state === 'unavailable') return 'border-silicon-slate/80 bg-background/35 text-muted-foreground'
  return 'border-red-500/30 bg-red-500/10 text-red-100'
}

function monitoringLabel(status: WarmBatchReviewRecipient['responseMonitoring']['status']) {
  return status.replace(/_/g, ' ')
}

type BatchAuthority =
  WarmBatchReviewRecipient['sendReadiness']['modes']['warm_1_to_many'][number]['sendAuthority']

function authorityStateLabel(state: BatchAuthority['state']) {
  if (state === 'eligible_for_future_activation') return 'future eligible'
  if (state === 'manual_only') return 'manual only'
  return 'blocked'
}

function authorityClasses(state: BatchAuthority['state']) {
  if (state === 'eligible_for_future_activation') return 'text-emerald-100'
  if (state === 'manual_only') return 'text-sky-100'
  return 'text-red-100'
}

function emailLifecycleStateLabel(
  state: NonNullable<WarmBatchReviewRecipient['sendReadiness']['modes']['warm_1_to_many'][number]['emailSendLifecycle']>['state'],
) {
  if (state === 'per_recipient_gate_required') return 'per-recipient gate required'
  if (state === 'blocked_before_provider_activation') return 'provider/send activation blocked'
  return 'blocked'
}

function handoffStateLabel(
  state: NonNullable<WarmBatchReviewRecipient['sendReadiness']['modes']['warm_1_to_many'][number]['emailSendLifecycle']>['gmailDraftHandoffPacket']['state'],
) {
  if (state === 'ready_for_internal_handoff') return 'internal handoff ready'
  if (state === 'per_recipient_gate_required') return 'per-recipient handoff'
  return 'handoff blocked'
}

function draftCreationGateLabel(
  state: NonNullable<WarmBatchReviewRecipient['sendReadiness']['modes']['warm_1_to_many'][number]['emailSendLifecycle']>['gmailDraftCreationGate']['status'],
) {
  if (state === 'provider_smoke_required') return 'provider smoke required'
  if (state === 'draft_creation_authority_required') return 'draft authority required'
  if (state === 'ready_for_disabled_activation') return 'ready but disabled'
  if (state === 'handoff_blocked') return 'handoff blocked'
  return 'blocked'
}

function BoundaryFlag({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-md border px-2 py-1 text-xs ${
        active
          ? 'border-red-500/30 bg-red-500/10 text-red-100'
          : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
      }`}
    >
      {label}: {active ? 'enabled' : 'off'}
    </span>
  )
}

function LocalEvidenceFlag() {
  return (
    <span className="inline-flex min-h-7 items-center rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-1 text-xs text-sky-100">
      Local response evidence: visible
    </span>
  )
}

function GmailDraftPlanSection({
  data,
  draftActionLoading,
  draftActionError,
  onCreateGmailDraftRecords,
  onReview,
}: {
  data: WarmBatchReview
  draftActionLoading: boolean
  draftActionError: string | null
  onCreateGmailDraftRecords: () => void
  onReview: () => void
}) {
  const plan = data.gmailDraftPlan
  const blocker = plan.currentCta.blocker
  const ctaIsDraftCreation = plan.currentCta.key === 'create_gmail_draft_records'
  const ctaLoading = ctaIsDraftCreation && draftActionLoading
  const createdNotice = plan.executionReceipt
    ? `Draft-only Gmail records created for ${plan.executionReceipt.createdCount} contact(s). No Gmail provider draft, send, Slack message, SMS, n8n run, or production mutation was performed.`
    : null

  return (
    <div className="rounded-lg border border-sky-500/25 bg-background/45 p-3" aria-label="Gmail batch draft plan">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-sky-100">Gmail batch draft plan</p>
            <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-100">
              Draft-only
            </span>
            <span className="rounded-full border border-silicon-slate/70 bg-background/50 px-2 py-0.5 text-[11px] text-muted-foreground">
              {plan.summary.selectedCount} selected
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-emerald-100">
              {plan.summary.readyForLocalPlanningCount} plan-ready
            </span>
            <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-sky-100">
              {plan.summary.approvalRequiredCount} approval review
            </span>
            <span className="rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-red-100">
              {plan.summary.blockedReviewCount} blocked
            </span>
            <span className="rounded-full border border-silicon-slate/70 bg-background/35 px-2 py-0.5 text-muted-foreground">
              {plan.summary.excludedSubmittedCount} submitted
            </span>
            <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-amber-100">
              {plan.summary.providerNotConnectedCount} provider not connected
            </span>
            <span className="rounded-full border border-silicon-slate/70 bg-background/35 px-2 py-0.5 text-muted-foreground">
              {plan.summary.smsUnavailableCount} SMS unavailable
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <button
            type="button"
            disabled={!plan.currentCta.enabled || ctaLoading}
            onClick={() => {
              if (ctaIsDraftCreation) {
                onCreateGmailDraftRecords()
                return
              }
              onReview()
            }}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-sky-500/35 bg-sky-500/10 px-3 text-sm font-semibold text-sky-100 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
          >
            {ctaLoading ? (
              <RefreshCw size={15} className="animate-spin" aria-hidden />
            ) : (
              <FileText size={15} aria-hidden />
            )}
            {ctaLoading ? 'Creating records...' : plan.currentCta.label}
          </button>
          {blocker && (
            <p className="mt-2 rounded-md border border-red-500/25 bg-red-500/10 p-2 text-xs leading-5 text-red-100">
              {blocker}
            </p>
          )}
        </div>
      </div>

      {draftActionError && (
        <p role="alert" className="mt-3 rounded-md border border-red-500/25 bg-red-500/10 p-2 text-xs leading-5 text-red-100">
          {draftActionError}
        </p>
      )}

      {createdNotice && (
        <p role="status" className="mt-3 rounded-md border border-emerald-500/25 bg-emerald-500/10 p-2 text-xs leading-5 text-emerald-100">
          {createdNotice}
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="border-b border-silicon-slate/70 text-muted-foreground">
            <tr>
              <th className="py-2 pr-3 font-medium">Contact</th>
              <th className="py-2 pr-3 font-medium">Readiness</th>
              <th className="py-2 pr-3 font-medium">Basis</th>
              <th className="py-2 pr-3 font-medium">Draft intent</th>
              <th className="py-2 font-medium">Next</th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((row) => (
              <tr key={row.contactId} className="border-b border-silicon-slate/60 last:border-b-0">
                <td className="max-w-[13rem] py-2 pr-3 align-top">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-medium text-foreground">{row.contactName}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${draftPlanStatusClasses(row.status)}`}>
                      {row.statusLabel}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-muted-foreground">{row.company ?? 'No company'}</p>
                </td>
                <td className="max-w-[16rem] py-2 pr-3 align-top">
                  <div className="flex flex-wrap gap-1">
                    {row.readiness
                      .filter((item) => item.state !== 'clear')
                      .map((item) => (
                        <span
                          key={`${row.contactId}-${item.key}`}
                          title={item.state.replace(/_/g, ' ')}
                          className={`rounded-full border px-2 py-0.5 text-[10px] ${readinessClasses(item.state)}`}
                        >
                          {item.label}
                        </span>
                      ))}
                    {row.readiness.every((item) => item.state === 'clear') && (
                      <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-100">
                        Clear
                      </span>
                    )}
                  </div>
                  {row.blockers[0] && (
                    <p className="mt-1 text-red-100">{row.blockers[0]}</p>
                  )}
                </td>
                <td className="max-w-[15rem] py-2 pr-3 align-top text-muted-foreground">
                  <p className="line-clamp-2">{row.relationshipBasis}</p>
                  <p className="mt-1">{row.relationshipSignalCount} signal{row.relationshipSignalCount === 1 ? '' : 's'}</p>
                </td>
                <td className="max-w-[13rem] py-2 pr-3 align-top text-muted-foreground">
                  <p>{row.draftIntent.promptTemplateKey ?? 'No template'}</p>
                  <p className="mt-1">Record: {row.draftCreation?.statusLabel ?? 'Not recorded'}</p>
                  <p>Provider draft: off</p>
                  {row.draftCreation?.localDraftRecordId && (
                    <p className="truncate" title={row.draftCreation.localDraftRecordId}>
                      {row.draftCreation.localDraftRecordId}
                    </p>
                  )}
                </td>
                <td className="max-w-[10rem] py-2 align-top text-foreground">
                  {row.nextActionLabel}
                  {row.existingQueueId && <p className="mt-1 truncate text-muted-foreground">Queue: {row.existingQueueId}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <BoundaryFlag label="outreach_queue writes" active={plan.executionBoundary.createsOutreachQueueRows} />
        <BoundaryFlag label="Gmail provider" active={plan.executionBoundary.gmailProviderCalls} />
        <BoundaryFlag label="Provider Gmail drafts" active={plan.executionBoundary.createsGmailDrafts} />
        <BoundaryFlag label="Gmail send" active={plan.executionBoundary.gmailSend} />
        <BoundaryFlag label="Slack" active={plan.executionBoundary.slackDispatch} />
        <BoundaryFlag label="SMS" active={plan.executionBoundary.smsDelivery} />
      </div>
    </div>
  )
}

function RecipientRow({ recipient }: { recipient: WarmBatchReviewRecipient }) {
  const primaryBlocker = recipient.blockers[0]
  const monitoring = recipient.responseMonitoring
  const recipientKey = recipient.sendReadiness?.perRecipientIdempotencyKey
  const batchAuthorities = recipient.sendReadiness.modes.warm_1_to_many.map((item) => item.sendAuthority)
  const futureEligible = batchAuthorities.filter((authority) => authority.futureActivationEligible).length
  const manualOnly = batchAuthorities.filter((authority) => authority.state === 'manual_only').length
  const blocked = batchAuthorities.filter((authority) => authority.state === 'blocked').length
  const emailAuthority = batchAuthorities.find((authority) => authority.channel === 'email')
  const emailLifecycle = recipient.sendReadiness.modes.warm_1_to_many.find((item) => item.channel === 'email')
    ?.emailSendLifecycle
  const draftStage = emailLifecycle?.stages.find((stage) => stage.key === 'draft_packet')
  const providerStage = emailLifecycle?.stages.find((stage) => stage.key === 'provider_capability_smoke')
  const handoff = emailLifecycle?.gmailDraftHandoffPacket
  const providerSmoke = emailLifecycle?.providerCapabilitySmoke
  const draftGate = emailLifecycle?.gmailDraftCreationGate
  const externalSend = emailLifecycle?.externalSendReadiness

  return (
    <li className="grid gap-3 border-t border-silicon-slate/70 py-3 first:border-t-0 md:grid-cols-[minmax(10rem,0.9fr)_minmax(0,1.35fr)_minmax(9rem,0.7fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{recipient.contactName}</p>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClasses(recipient.status)}`}>
            {statusLabel(recipient.status)}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {recipient.company ?? 'No company recorded'}
        </p>
      </div>

      <div className="min-w-0 text-sm leading-5">
        <p className="text-foreground">{recipient.relationshipBasis}</p>
        <p className="mt-1 text-muted-foreground">
          {recipient.selectedChannel ?? 'no channel'} / {recipient.selectedTemplate.replace(/_/g, ' ')}
          {recipient.promptTemplateKey ? ` / ${recipient.promptTemplateKey}` : ''}
        </p>
        {primaryBlocker && (
          <p className="mt-1 flex items-start gap-2 text-red-100">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>{primaryBlocker}</span>
          </p>
        )}
      </div>

      <div className="min-w-0 text-xs leading-5 text-muted-foreground">
        <p>Signals: {recipient.relationshipSignalCount}</p>
        <p>Suppression: {recipient.suppressionStatus}</p>
        <p>Monitoring: {monitoring ? monitoringLabel(monitoring.status) : 'not loaded'}</p>
        <p>Next: {monitoring?.proposedFollowUp.label ?? 'Review per-recipient state'}</p>
        <p className={authorityClasses(emailAuthority?.state ?? 'blocked')}>
          Send authority: {emailAuthority ? authorityStateLabel(emailAuthority.state) : 'blocked'}
        </p>
        {emailLifecycle && (
          <>
            <p className="text-amber-100">Email path: {emailLifecycleStateLabel(emailLifecycle.state)}</p>
            <p>
              Draft: {draftStage?.status.replace(/_/g, ' ') ?? 'blocked'} / Provider: {providerStage?.status.replace(/_/g, ' ') ?? 'blocked'}
            </p>
            {handoff && (
              <p>
                Handoff: {handoffStateLabel(handoff.state)} / Smoke: {providerSmoke?.status.replace(/_/g, ' ') ?? 'blocked'}
              </p>
            )}
            {draftGate && (
              <p>
                Draft creation: {draftCreationGateLabel(draftGate.status)}
              </p>
            )}
            {externalSend && (
              <>
                <p className="text-red-100">
                  External send: {externalSend.externalSend.blocked ? 'blocked' : 'enabled'}
                </p>
                <p>
                  Sender: {externalSend.senderIdentity.state.replace(/_/g, ' ')} / Recipient approval: required
                </p>
                <p>
                  Draft evidence: {externalSend.draftEvidence.gmailDraftExists ? 'tracked Gmail draft' : 'missing'}
                </p>
              </>
            )}
          </>
        )}
        <p>Future eligible: {futureEligible} / Manual: {manualOnly} / Blocked: {blocked}</p>
        {recipient.existingQueueId && <p className="truncate">Queue: {recipient.existingQueueId}</p>}
        {recipientKey && <p className="truncate">Recipient key: {recipientKey}</p>}
      </div>
    </li>
  )
}

export default function WarmBatchReviewPanel({
  data,
  loading,
  error,
  draftActionLoading,
  draftActionError,
  selectedCount,
  onReview,
  onCreateGmailDraftRecords,
}: WarmBatchReviewPanelProps) {
  const sample = data?.samplePreview
  const hasSelection = selectedCount > 0
  const batchAuthorities =
    data?.recipients.flatMap((recipient) =>
      recipient.sendReadiness.modes.warm_1_to_many.map((item) => item.sendAuthority),
    ) ?? []
  const authoritySummary = {
    futureEligible: batchAuthorities.filter((authority) => authority.futureActivationEligible).length,
    manualOnly: batchAuthorities.filter((authority) => authority.state === 'manual_only').length,
    blocked: batchAuthorities.filter((authority) => authority.state === 'blocked').length,
  }
  const emailLifecycleSummary = {
    candidates: data?.recipients.filter((recipient) =>
      Boolean(recipient.sendReadiness.modes.warm_1_to_many.find((item) => item.channel === 'email')?.emailSendLifecycle),
    ).length ?? 0,
    handoffReady: data?.recipients.filter((recipient) =>
      recipient.sendReadiness.modes.warm_1_to_many.find((item) => item.channel === 'email')
        ?.emailSendLifecycle?.gmailDraftHandoffPacket.internalHandoffReady,
    ).length ?? 0,
    providerNotConfigured: data?.recipients.filter((recipient) =>
      recipient.sendReadiness.modes.warm_1_to_many.find((item) => item.channel === 'email')
        ?.emailSendLifecycle?.providerCapabilitySmoke.providerConfigured === false,
    ).length ?? 0,
    providerSmokeReady: data?.recipients.filter((recipient) => {
      const status = recipient.sendReadiness.modes.warm_1_to_many.find((item) => item.channel === 'email')
        ?.emailSendLifecycle?.providerCapabilitySmoke.status
      return status === 'ready_for_read_only_smoke' || status === 'smoke_passed'
    }).length ?? 0,
    draftCreationReady: data?.recipients.filter((recipient) =>
      recipient.sendReadiness.modes.warm_1_to_many.find((item) => item.channel === 'email')
        ?.emailSendLifecycle?.gmailDraftCreationGate.status === 'ready_for_disabled_activation',
    ).length ?? 0,
    duplicateBlocked: data?.recipients.filter((recipient) =>
      recipient.sendReadiness.modes.warm_1_to_many.find((item) => item.channel === 'email')
        ?.emailSendLifecycle?.duplicatePrevention.duplicateDetected,
    ).length ?? 0,
    trackedDrafts: data?.recipients.filter((recipient) =>
      recipient.sendReadiness.modes.warm_1_to_many.find((item) => item.channel === 'email')
        ?.emailSendLifecycle?.externalSendReadiness?.draftEvidence.gmailDraftExists,
    ).length ?? 0,
    recipientApprovalRequired: data?.recipients.filter((recipient) =>
      recipient.sendReadiness.modes.warm_1_to_many.find((item) => item.channel === 'email')
        ?.emailSendLifecycle?.externalSendReadiness?.recipientApproval.approved === false,
    ).length ?? 0,
    senderNotVerified: data?.recipients.filter((recipient) =>
      recipient.sendReadiness.modes.warm_1_to_many.find((item) => item.channel === 'email')
        ?.emailSendLifecycle?.externalSendReadiness?.senderIdentity.state === 'not_verified',
    ).length ?? 0,
    externalSendBlocked: data?.recipients.filter((recipient) =>
      recipient.sendReadiness.modes.warm_1_to_many.find((item) => item.channel === 'email')
        ?.emailSendLifecycle?.externalSendReadiness?.externalSend.blocked,
    ).length ?? 0,
  }

  return (
    <section
      className="mb-6 rounded-xl border border-sky-500/30 bg-sky-950/10 p-3 sm:p-4"
      aria-label="Warm batch review"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-sky-100">
            <Users size={16} className="text-radiant-gold" aria-hidden />
            Warm Gmail batch planning
          </p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Review selected warm leads as individualized Gmail draft-plan candidates before any queue write, provider draft, or send authority.
          </p>
        </div>
        <button
          type="button"
          onClick={onReview}
          disabled={!hasSelection || loading}
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-sky-500/35 bg-sky-500/10 px-3 text-sm font-semibold text-sky-100 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {loading ? <RefreshCw size={15} className="animate-spin" aria-hidden /> : <FileText size={15} aria-hidden />}
          {loading ? 'Planning...' : data ? 'Refresh draft plan' : `Plan ${selectedCount} selected`}
        </button>
      </div>

      {!hasSelection && (
        <p className="mt-3 rounded-md border border-silicon-slate bg-silicon-slate/25 p-3 text-sm text-muted-foreground">
          Select warm leads from the list to assemble a batch review.
        </p>
      )}

      {error && (
        <div role="alert" className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {data && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(14rem,0.55fr)]">
            <div className="rounded-lg border border-silicon-slate/70 bg-background/45 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                Cohort provenance
              </p>
              <p className="mt-1 text-sm leading-5 text-foreground">{data.cohort.provenance}</p>
              <p className="mt-2 break-all text-xs text-muted-foreground">
                {data.batchIdempotencyKey}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-silicon-slate/70 bg-background/45 p-3">
                <p className="text-muted-foreground">Ready</p>
                <p className="text-lg font-semibold text-emerald-100">{data.summary.readyCount}</p>
              </div>
              <div className="rounded-lg border border-silicon-slate/70 bg-background/45 p-3">
                <p className="text-muted-foreground">Blocked</p>
                <p className="text-lg font-semibold text-red-100">{data.summary.blockedCount}</p>
              </div>
              <div className="rounded-lg border border-silicon-slate/70 bg-background/45 p-3">
                <p className="text-muted-foreground">Existing</p>
                <p className="text-lg font-semibold text-sky-100">{data.summary.existingDraftCount}</p>
              </div>
              <div className="rounded-lg border border-silicon-slate/70 bg-background/45 p-3">
                <p className="text-muted-foreground">Weak basis</p>
                <p className="text-lg font-semibold text-amber-100">{data.summary.weakBasisCount}</p>
              </div>
            </div>
          </div>

          {sample && (
            <div className="rounded-lg border border-silicon-slate/70 bg-background/45 p-3">
              <div className="flex flex-wrap items-center gap-2">
                {sample.status === 'blocked' ? (
                  <AlertTriangle size={15} className="text-amber-200" aria-hidden />
                ) : (
                  <CheckCircle2 size={15} className="text-emerald-200" aria-hidden />
                )}
                <p className="text-sm font-medium text-foreground">Sample individualized preview</p>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClasses(sample.status)}`}>
                  {statusLabel(sample.status)}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-foreground">{sample.individualizedDraftPreview}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <BoundaryFlag label="Provider calls" active={data.executionBoundary.providerCalls} />
            <BoundaryFlag label="Draft creation" active={data.executionBoundary.createsDraft} />
            <BoundaryFlag label="External send" active={data.executionBoundary.externalSend} />
            <BoundaryFlag label="Gmail draft" active={data.executionBoundary.gmailDraft} />
            <BoundaryFlag label="External monitoring" active={data.executionBoundary.responseMonitoring} />
            <LocalEvidenceFlag />
            <BoundaryFlag label="n8n" active={data.executionBoundary.n8nDispatch} />
            <BoundaryFlag label="Slack" active={data.executionBoundary.slackAction} />
          </div>

          <GmailDraftPlanSection
            data={data}
            draftActionLoading={draftActionLoading}
            draftActionError={draftActionError}
            onCreateGmailDraftRecords={onCreateGmailDraftRecords}
            onReview={onReview}
          />

          <details className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-50">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                <ShieldAlert size={14} aria-hidden />
                Email gates
              </span>
              <span className="rounded-full border border-current/25 px-2 py-0.5 text-[10px] font-semibold">
                {emailLifecycleSummary.candidates} modeled / provider-send off
              </span>
            </summary>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-amber-100/85 sm:grid-cols-2">
              <p>Duplicate blocked: {emailLifecycleSummary.duplicateBlocked}</p>
              <p>Internal handoffs ready: {emailLifecycleSummary.handoffReady}</p>
              <p>Provider not activated: {emailLifecycleSummary.providerNotConfigured}</p>
              <p>Provider smoke ready/passed: {emailLifecycleSummary.providerSmokeReady}</p>
              <p>Draft creation ready but disabled: {emailLifecycleSummary.draftCreationReady}</p>
              <p>Tracked Gmail drafts: {emailLifecycleSummary.trackedDrafts}</p>
              <p>Recipient approvals required: {emailLifecycleSummary.recipientApprovalRequired}</p>
              <p>Sender not verified: {emailLifecycleSummary.senderNotVerified}</p>
              <p>External send blocked: {emailLifecycleSummary.externalSendBlocked}</p>
              <p>No-send canaries stay on the individual relationship packet.</p>
            </div>
          </details>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              <p className="text-xs text-emerald-100/80">Future eligible gates</p>
              <p className="text-lg font-semibold">{authoritySummary.futureEligible}</p>
            </div>
            <div className="rounded-lg border border-sky-500/25 bg-sky-500/10 p-3 text-sm text-sky-100">
              <p className="text-xs text-sky-100/80">Manual channel gates</p>
              <p className="text-lg font-semibold">{authoritySummary.manualOnly}</p>
            </div>
            <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-100">
              <p className="text-xs text-red-100/80">Blocked gates</p>
              <p className="text-lg font-semibold">{authoritySummary.blocked}</p>
            </div>
          </div>

          <details className="rounded-lg border border-silicon-slate/70 bg-background/45 p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">
              <span>Full recipient list ({data.recipients.length})</span>
              <ChevronDown size={16} aria-hidden />
            </summary>
            <ul className="mt-3">
              {data.recipients.map((recipient) => (
                <RecipientRow key={recipient.contactId} recipient={recipient} />
              ))}
            </ul>
          </details>

          <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <LockKeyhole size={14} className="mt-0.5 shrink-0" aria-hidden />
            Every row remains review-only. Suppressed, removed, unsubscribed, weak-basis, Facebook, and phone-only rows are blocked before draft generation or send authority.
          </p>
        </div>
      )}
    </section>
  )
}
