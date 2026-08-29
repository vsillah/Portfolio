'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ClipboardCopy,
  Database,
  FileText,
  LockKeyhole,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from 'lucide-react'
import type {
  WarmOutreachChannel,
  WarmOutreachContextSummary,
  WarmOutreachReadiness,
  WarmOutreachRelationshipPacket,
} from '@/lib/warm-outreach-relationship-intelligence'
import type {
  WarmOutreachGmailProviderExecutionReadiness,
  WarmOutreachGmailProviderActivationReadiness,
  WarmOutreachRealRecipientGmailRolloutReadiness,
  WarmOutreachResponseMonitoring,
} from '@/lib/warm-outreach-response-monitoring'
import type {
  WarmGmailOperatingLoop,
  WarmGmailOperatingLoopState,
} from '@/lib/warm-outreach-gmail-operating-loop'
import type {
  WarmSmsApprovalState,
  WarmSmsManualResponseOutcome,
  WarmSmsReadiness,
  WarmSmsReadinessState,
} from '@/lib/warm-outreach-sms-readiness'
import {
  evaluateWarmSmsManualLoop,
  warmSmsManualLoopStages,
} from '@/lib/warm-outreach-sms-readiness'

type SendReadinessItem =
  WarmOutreachResponseMonitoring['sendReadiness']['modes']['warm_1_to_1'][number]

type ChannelCapability = NonNullable<
  WarmOutreachRelationshipPacket['channelCapabilities'][WarmOutreachChannel]
>

export interface RelationshipPacketApiResponse {
  packet: WarmOutreachRelationshipPacket
  readiness: WarmOutreachReadiness
  contextSummary: WarmOutreachContextSummary
  smsReadiness?: WarmSmsReadiness
  executionBoundary: {
    source: string
    readOnly: boolean
    providerCalls: boolean
    createsDraft: boolean
    externalSend: boolean
    n8nDispatch: boolean
    slackAction: boolean
    responseMonitoring: boolean
  }
  responseMonitoring?: WarmOutreachResponseMonitoring
}

export interface GmailDraftCanaryResult {
  status: string
  message: string
  draftCreationEnabled: false
  providerCallsEnabled: false
  externalSendEnabled: false
  gmailDraftCreated: false
  trackingPersisted: false
  activationReadiness?: WarmOutreachGmailProviderActivationReadiness
}

interface RelationshipPacketPanelProps {
  loading: boolean
  error: string | null
  data: RelationshipPacketApiResponse | null
  gmailDraftCanaryLoading?: boolean
  gmailDraftCanaryError?: string | null
  gmailDraftCanaryResult?: GmailDraftCanaryResult | null
  onGmailDraftCanary?: () => void
  inertSlackApprovalRequest?: boolean
}

const CHANNEL_LABELS: Record<WarmOutreachChannel, string> = {
  email: 'Email',
  linkedin: 'LinkedIn',
  facebook: 'Facebook / manual',
  phone_contact: 'Phone / manual',
}

const CHANNEL_ICONS: Record<WarmOutreachChannel, typeof Mail> = {
  email: Mail,
  linkedin: MessageSquare,
  facebook: UserRoundCheck,
  phone_contact: Phone,
}

export function relationshipReadinessLabel(status: WarmOutreachReadiness['status']) {
  if (status === 'draft_ready') return 'Ready for draft review'
  if (status === 'needs_review') return 'Needs human review'
  return 'Blocked'
}

export function describeChannelCapability(capability?: ChannelCapability) {
  if (!capability?.available) return 'Not recorded'
  if (capability.manualOnly) return 'Manual review only'
  if (!capability.providerConfigured) return 'Draft context only'
  if (!capability.supportsExternalSend) return 'Draft capable, no send'
  return 'Provider configured'
}

function statusClasses(status: WarmOutreachReadiness['status']) {
  if (status === 'draft_ready') {
    return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
  }
  if (status === 'needs_review') {
    return 'border-amber-500/35 bg-amber-500/10 text-amber-100'
  }
  return 'border-red-500/35 bg-red-500/10 text-red-100'
}

function capabilityClasses(capability?: ChannelCapability) {
  if (!capability?.available) return 'border-silicon-slate bg-silicon-slate/25 text-muted-foreground'
  if (capability.manualOnly) return 'border-sky-500/25 bg-sky-500/10 text-sky-100'
  if (!capability.providerConfigured || !capability.supportsExternalSend) {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
  }
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
}

function monitoringClasses(status?: WarmOutreachResponseMonitoring['status']) {
  if (status === 'manual_response_captured' || status === 'imported_response_captured') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
  }
  if (status === 'stale_no_response') return 'border-amber-500/30 bg-amber-500/10 text-amber-100'
  if (status === 'blocked') return 'border-red-500/30 bg-red-500/10 text-red-100'
  return 'border-sky-500/25 bg-sky-500/10 text-sky-100'
}

function providerCaptureClasses(state: WarmOutreachResponseMonitoring['providerCaptureReadiness']['providers'][number]['state']) {
  if (state === 'readiness_metadata_only') return 'border-sky-500/25 bg-sky-500/10 text-sky-100'
  if (state === 'manual_capture_only') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
  return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
}

function gmailImportClasses(state: WarmOutreachResponseMonitoring['gmailResponseImportReadiness']['state']) {
  if (state === 'dry_run_ready' || state === 'response_evidence_ready') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
  }
  if (state === 'blocked') return 'border-red-500/25 bg-red-500/10 text-red-100'
  return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
}

function matchBasisClasses(available: boolean) {
  return available
    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
    : 'border-silicon-slate bg-background/30 text-muted-foreground'
}

function activationGateClasses(state: NonNullable<WarmOutreachResponseMonitoring['gmailResponseImportReadiness']['activationReadiness']>['gateRows'][number]['state']) {
  if (state === 'ready') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
  if (state === 'disabled' || state === 'not_checked') {
    return 'border-silicon-slate bg-background/30 text-muted-foreground'
  }
  if (state === 'missing') return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
  return 'border-red-500/25 bg-red-500/10 text-red-100'
}

function canaryStateClasses(state: WarmOutreachResponseMonitoring['gmailResponseImportReadiness']['canaryReadiness']['state']) {
  if (state === 'imported_response_found' || state === 'ready_for_dry_run') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
  }
  if (state === 'live_read_approval_required') return 'border-sky-500/25 bg-sky-500/10 text-sky-100'
  if (state === 'no_response_found' || state === 'duplicate_deduped') {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
  }
  return 'border-red-500/25 bg-red-500/10 text-red-100'
}

function canaryGateClasses(state: WarmOutreachResponseMonitoring['gmailResponseImportReadiness']['canaryReadiness']['gates'][number]['state']) {
  if (state === 'ready' || state === 'passed') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
  if (state === 'required') return 'border-sky-500/25 bg-sky-500/10 text-sky-100'
  if (state === 'disabled') return 'border-silicon-slate bg-background/30 text-muted-foreground'
  return 'border-red-500/25 bg-red-500/10 text-red-100'
}

function operatorDecisionClasses(state: WarmOutreachResponseMonitoring['operatorDecisionPaths'][number]['state']) {
  if (state === 'pending_human_qa') return 'border-sky-500/25 bg-sky-500/10 text-sky-100'
  if (state === 'available') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
  if (state === 'blocked') return 'border-red-500/25 bg-red-500/10 text-red-100'
  return 'border-silicon-slate bg-background/30 text-muted-foreground'
}

function sendReadinessClasses(state: string) {
  if (state === 'blocked' || state === 'unavailable') {
    return 'border-red-500/25 bg-red-500/10 text-red-100'
  }
  if (state === 'manual_review_only') return 'border-sky-500/25 bg-sky-500/10 text-sky-100'
  return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
}

function sendAuthorityClasses(state: SendReadinessItem['sendAuthority']['state']) {
  if (state === 'blocked') return 'border-red-500/25 bg-red-500/10 text-red-100'
  if (state === 'manual_only') return 'border-sky-500/25 bg-sky-500/10 text-sky-100'
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
}

function sendAuthorityStateLabel(state: SendReadinessItem['sendAuthority']['state']) {
  if (state === 'eligible_for_future_activation') return 'Future eligible'
  if (state === 'manual_only') return 'Manual only'
  return 'Blocked'
}

function emailLifecycleStateLabel(state: NonNullable<SendReadinessItem['emailSendLifecycle']>['state']) {
  if (state === 'per_recipient_gate_required') return 'Per-recipient gate required'
  if (state === 'blocked_before_provider_activation') return 'Provider/send activation blocked'
  return 'Blocked'
}

function emailLifecycleStageClasses(status: NonNullable<SendReadinessItem['emailSendLifecycle']>['stages'][number]['status']) {
  if (status === 'ready_for_review') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
  if (status === 'blocked') return 'border-red-500/25 bg-red-500/10 text-red-100'
  if (status === 'disabled') return 'border-silicon-slate bg-silicon-slate/25 text-muted-foreground'
  if (status === 'evidence_required') return 'border-sky-500/25 bg-sky-500/10 text-sky-100'
  return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
}

function gmailHandoffClasses(state: NonNullable<SendReadinessItem['emailSendLifecycle']>['gmailDraftHandoffPacket']['state']) {
  if (state === 'blocked') return 'border-red-500/25 bg-red-500/10 text-red-100'
  if (state === 'per_recipient_gate_required') return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
}

function providerSmokeClasses(status: NonNullable<SendReadinessItem['emailSendLifecycle']>['providerCapabilitySmoke']['status']) {
  if (status === 'smoke_passed') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
  if (status === 'smoke_failed' || status === 'blocked') return 'border-red-500/25 bg-red-500/10 text-red-100'
  if (status === 'ready_for_read_only_smoke' || status === 'waiting_read_only_smoke_authority') {
    return 'border-sky-500/25 bg-sky-500/10 text-sky-100'
  }
  return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
}

function draftCreationGateClasses(status: NonNullable<SendReadinessItem['emailSendLifecycle']>['gmailDraftCreationGate']['status']) {
  if (status === 'ready_for_disabled_activation') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
  if (status === 'blocked' || status === 'handoff_blocked') return 'border-red-500/25 bg-red-500/10 text-red-100'
  return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
}

function activationStepClasses(state: string) {
  if (state === 'ready' || state === 'passed_no_send') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
  }
  if (state === 'blocked' || state === 'blocked_no_send') {
    return 'border-red-500/25 bg-red-500/10 text-red-100'
  }
  return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
}

function realRecipientRolloutClasses(state: WarmOutreachRealRecipientGmailRolloutReadiness['state']) {
  if (state === 'ready_for_send_request' || state === 'eligible_for_execution') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
  }
  if (state === 'authorization_recorded_execution_blocked') return 'border-sky-500/30 bg-sky-500/10 text-sky-100'
  if (state === 'already_sent') return 'border-silicon-slate bg-silicon-slate/25 text-muted-foreground'
  return 'border-red-500/30 bg-red-500/10 text-red-100'
}

function rolloutRequirementClasses(state: string) {
  if (
    state === 'tracked' ||
    state === 'matched' ||
    state === 'clear' ||
    state === 'configured' ||
    state === 'eligible_for_execution' ||
    state === 'sent'
  ) {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
  }
  if (state === 'approved' || state === 'approved_for_send' || state === 'approval_requested') {
    return 'border-sky-500/25 bg-sky-500/10 text-sky-100'
  }
  if (state === 'missing') return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
  return 'border-red-500/25 bg-red-500/10 text-red-100'
}

function slackApprovalStatusLabel(status: WarmOutreachRealRecipientGmailRolloutReadiness['slackApprovalContract']['status']) {
  if (status === 'not_sent') return 'not sent'
  if (status === 'pending') return 'pending'
  if (status === 'approved') return 'approved'
  if (status === 'rejected') return 'rejected'
  return 'revision requested'
}

function canaryReceiptClasses(state: NonNullable<WarmOutreachRealRecipientGmailRolloutReadiness['auditReceipt']>['finalSendAuthority']['state']) {
  if (state === 'eligible_for_exact_execution' || state === 'authorization_recorded_execution_blocked') {
    return 'border-sky-500/25 bg-sky-500/10 text-sky-50'
  }
  if (state === 'sent_do_not_resend' || state === 'repair_required_do_not_resend') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-50'
  }
  return 'border-red-500/25 bg-red-500/10 text-red-50'
}

function operatingLoopClasses(loop: WarmGmailOperatingLoop) {
  if (loop.duplicateSendBlocked) {
    return 'border-amber-400/35 bg-amber-400/10 text-amber-50'
  }
  if (loop.blocked) return 'border-red-500/35 bg-red-500/10 text-red-50'
  if (loop.state === 'send_authorized') return 'border-sky-400/35 bg-sky-400/10 text-sky-50'
  if (loop.state === 'response_monitoring') return 'border-emerald-400/35 bg-emerald-400/10 text-emerald-50'
  return 'border-amber-400/35 bg-amber-400/10 text-amber-50'
}

function operatingLoopStageClasses(status: WarmGmailOperatingLoop['stages'][number]['status']) {
  if (status === 'complete') return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
  if (status === 'current') return 'border-sky-400/35 bg-sky-400/10 text-sky-50'
  if (status === 'blocked') return 'border-red-400/35 bg-red-400/10 text-red-50'
  return 'border-silicon-slate bg-background/25 text-muted-foreground'
}

function operatingLoopGateClasses(state: WarmGmailOperatingLoop['executionGate']['state']) {
  if (state === 'submitted_evidence_recorded' || state === 'response_monitoring') {
    return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-50'
  }
  if (state === 'live_execution_eligible') return 'border-sky-400/35 bg-sky-400/10 text-sky-50'
  if (state === 'blocked') return 'border-red-400/35 bg-red-400/10 text-red-50'
  return 'border-amber-400/35 bg-amber-400/10 text-amber-50'
}

function localRequestedStages(
  stages: WarmGmailOperatingLoop['stages'],
  localState: WarmGmailOperatingLoopState,
) {
  const currentIndex = stages.findIndex((stage) => stage.key === localState)
  return stages.map((stage, index) => ({
    ...stage,
    status: index < currentIndex
      ? 'complete' as const
      : index === currentIndex
        ? 'current' as const
        : 'upcoming' as const,
  }))
}

function GmailOperatingLoopCard({
  inertSlackApprovalRequest = false,
  loop,
}: {
  inertSlackApprovalRequest?: boolean
  loop: WarmGmailOperatingLoop
}) {
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [requestReceipt, setRequestReceipt] = useState<string | null>(null)
  const [localApprovalRequested, setLocalApprovalRequested] = useState(false)
  const queueId = loop.queueId
  const localState: WarmGmailOperatingLoopState = localApprovalRequested
    ? 'send_approval_requested'
    : loop.state
  const stages = localApprovalRequested
    ? localRequestedStages(loop.stages, localState)
    : loop.stages
  const currentLabel = stages.find((stage) => stage.key === localState)?.label ?? loop.label
  const gate = loop.executionGate
  const context = loop.operatorContext
  const action = localApprovalRequested
    ? {
        ...loop.nextAction,
        key: 'record_send_decision' as const,
        label: 'Record approval decision',
        detail: 'The single review request is recorded. Approve, reject, or request revision before any separate Gmail execution gate.',
        enabledOnThisSurface: false,
      }
    : loop.nextAction
  const authority = localApprovalRequested
    ? {
        ...loop.authority,
        sendApproval: 'requested' as const,
      }
    : loop.authority

  async function requestSlackPayload() {
    if (!queueId) return
    setRequestLoading(true)
    setRequestError(null)
    setRequestReceipt(null)
    try {
      if (inertSlackApprovalRequest) {
        setLocalApprovalRequested(true)
        setRequestReceipt(
          `QA local Slack approval request recorded for ${queueId}. Slack dispatch off. Gmail send off. Provider calls off.`,
        )
        return
      }

      const response = await fetch(`/api/admin/outreach/${encodeURIComponent(queueId)}/slack-send-approval`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      })
      const body = await response.json().catch(() => ({})) as {
        error?: string
        approvalRequest?: { status?: string }
        approvalRecovery?: { nextAction?: string }
      }
      if (!response.ok) throw new Error(body.error ?? 'Could not build Slack approval payload.')
      setLocalApprovalRequested(body.approvalRequest?.status === 'pending')
      setRequestReceipt(
        body.approvalRecovery?.nextAction ??
        'Local send approval request recorded in Portfolio. Slack dispatch off. Gmail send off.',
      )
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Could not build Slack approval payload.')
    } finally {
      setRequestLoading(false)
    }
  }

  return (
    <div id="warm-gmail-operating-loop" className={`rounded-md border p-3 ${operatingLoopClasses(loop)}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
            <Mail size={14} aria-hidden />
            Warm Gmail operating loop
          </p>
          <p className="mt-1 text-sm font-semibold">{currentLabel}</p>
          <p className="mt-1 text-[11px] leading-4 opacity-85">
            One recipient, one queue row, one message version, one next action.
          </p>
        </div>
        <span className="w-fit shrink-0 rounded-full border border-current/25 px-2 py-0.5 text-[10px] font-semibold">
          {loop.duplicateSendBlocked
            ? 'Duplicate send locked'
            : loop.blocked
              ? 'Recovery required'
              : 'Governed'}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {stages.map((stage, index) => (
          <div
            key={stage.key}
            className={`min-w-0 rounded-md border px-2 py-1.5 ${operatingLoopStageClasses(stage.status)}`}
          >
            <p className="text-[9px] font-semibold uppercase tracking-wide opacity-70">
              {index + 1} / {stages.length}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold leading-4">{stage.label}</p>
          </div>
        ))}
      </div>

      <div
        aria-label="Warm Gmail execution readiness"
        className={`mt-3 rounded-md border p-2.5 ${operatingLoopGateClasses(gate.state)}`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide">Execution readiness</p>
            <p className="mt-1 text-sm font-semibold">{gate.label}</p>
            <p className="mt-1 text-[11px] leading-4 opacity-85">
              {gate.blockedReason ?? gate.safeNextStep}
            </p>
          </div>
          <span className="inline-flex min-h-7 w-fit shrink-0 items-center gap-1.5 rounded-full border border-current/25 bg-background/25 px-2 py-0.5 text-[10px] font-semibold">
            <LockKeyhole size={12} aria-hidden />
            {gate.liveSendEligible ? 'Exact gate eligible' : 'Exact gate locked'}
          </span>
        </div>
        <div className="mt-2 grid gap-1.5 text-[10px] leading-4 sm:grid-cols-2 xl:grid-cols-4">
          <p className="rounded-md border border-current/20 bg-background/20 p-2">
            Recipient: {context.recipientLabel}
            {context.recipientEmail ? ` / ${context.recipientEmail}` : ''}
          </p>
          <p className="break-all rounded-md border border-current/20 bg-background/20 p-2">
            Draft: {context.gmailDraftId ?? 'missing'}
          </p>
          <p className="break-all rounded-md border border-current/20 bg-background/20 p-2">
            Approval: {context.approvalDecisionKey ?? authority.sendApproval.replace(/_/g, ' ')}
          </p>
          <p className="rounded-md border border-current/20 bg-background/20 p-2">
            Submitted evidence: {loop.audit.submittedEvidenceRecorded ? 'recorded' : 'none'}
          </p>
        </div>
        <p className="mt-2 text-[10px] leading-4 opacity-80">
          Safe next step: {gate.safeNextStep}
        </p>
        <details className="mt-2 rounded-md border border-current/20 bg-background/20 p-2">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide">
            Exact execution evidence
          </summary>
          <div className="mt-2 grid gap-1.5 text-[10px] leading-4 sm:grid-cols-2">
            <p className="break-all">Message version: {gate.requiredEvidence.messageVersionKey}</p>
            <p className="break-all">Send key: {gate.requiredEvidence.sendQueueIdempotencyKey}</p>
            <p className="break-all">Submitted key: {gate.requiredEvidence.submittedEvidenceKey}</p>
            <p className="break-all">Authorization: {gate.requiredAuthorization}</p>
          </div>
        </details>
      </div>

      <div className="mt-3 grid gap-1.5 text-[10px] leading-4 sm:grid-cols-4">
        <p className="rounded-md border border-current/20 bg-background/20 p-2">
          Draft: {authority.draft}
        </p>
        <p className="rounded-md border border-current/20 bg-background/20 p-2">
          Approval: {authority.sendApproval.replace(/_/g, ' ')}
        </p>
        <p className="rounded-md border border-current/20 bg-background/20 p-2">
          Live send: {authority.liveSendExecution.replace(/_/g, ' ')}
        </p>
        <p className="rounded-md border border-current/20 bg-background/20 p-2">
          Responses: {authority.responseImport.replace(/_/g, ' ')}
        </p>
      </div>

      <div className="mt-3 rounded-md border border-current/25 bg-background/25 p-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide">One next action</p>
            <p className="mt-1 text-sm font-semibold">{requestLoading ? 'Requesting approval' : action.label}</p>
            <p className="mt-1 text-[11px] leading-4 opacity-85">{action.detail}</p>
          </div>
          {action.key === 'request_send_approval' && action.enabledOnThisSurface ? (
            <button
              type="button"
              disabled={requestLoading}
              onClick={() => { void requestSlackPayload() }}
              className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-md border border-sky-400/40 bg-sky-400/10 px-3 text-xs font-semibold text-sky-50 transition-colors hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {requestLoading ? <RefreshCw size={13} className="animate-spin" aria-hidden /> : <MessageSquare size={13} aria-hidden />}
              {requestLoading ? 'Requesting approval' : 'Request send approval'}
            </button>
          ) : (
            <span className="inline-flex min-h-8 w-fit shrink-0 items-center gap-1.5 rounded-full border border-current/25 px-2 py-1 text-[10px] font-semibold">
              <LockKeyhole size={12} aria-hidden />
              {loop.executionBoundary.gmailSendEnabledOnThisSurface ? 'Available' : 'No live execution'}
            </span>
          )}
        </div>
        <p className="mt-2 text-[10px] leading-4 opacity-80">Recovery: {action.recovery}</p>
      </div>

      {loop.duplicateSendBlocked && (
        <p className="mt-2 rounded-md border border-amber-300/35 bg-amber-300/10 p-2 text-[11px] leading-4">
          Sent evidence already owns this idempotency scope. Review or repair the recorded evidence; never replay the Gmail send.
        </p>
      )}
      {requestError && (
        <p role="alert" className="mt-2 rounded-md border border-red-500/35 bg-red-500/10 p-2 text-[11px] leading-4 text-red-100">
          {requestError}
        </p>
      )}
      {requestReceipt && (
        <p role="status" className="mt-2 rounded-md border border-sky-500/30 bg-sky-500/10 p-2 text-[11px] leading-4 text-sky-100">
          {requestReceipt}
        </p>
      )}
      <p className="mt-2 text-[10px] leading-4 opacity-75">
        Slack dispatch: off. Gmail send: off. Response polling: off. “Proceed” is never live-send authority.
      </p>
    </div>
  )
}

function RealRecipientRolloutCard({
  readiness,
}: {
  readiness?: WarmOutreachRealRecipientGmailRolloutReadiness | null
}) {
  if (!readiness) return null

  const slackStatus = readiness.slackApprovalContract.status
  const receipt = readiness.auditReceipt

  const requirements = [
    ['Draft', readiness.requirements.draftEvidence.state],
    ['Sender', readiness.requirements.senderMatch.state],
    ['Suppression', readiness.requirements.suppression.state],
    ['Provider', readiness.requirements.provider.state],
    ['Authorization', readiness.requirements.authorization.state],
    ['Execution', readiness.requirements.execution.state],
    ['Submitted evidence', readiness.requirements.submittedEvidence.state],
  ] as const
  const recovery = readiness.slackApprovalContract.approvalRequestRecovery
  const primaryDetail =
    readiness.blockers[0] ??
    (readiness.state === 'ready_for_send_request'
      ? readiness.requirements.authorization.detail
      : readiness.state === 'eligible_for_execution'
        ? readiness.requirements.execution.detail
      : readiness.state === 'authorization_recorded_execution_blocked'
        ? 'Execution still requires the captain to enable the production flag and call the exact per-recipient send route.'
        : readiness.requirements.submittedEvidence.detail)

  return (
    <div className={`mt-2 rounded-md border p-2.5 ${realRecipientRolloutClasses(readiness.state)}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
            {readiness.state === 'ready_for_send_request' ? (
              <ShieldCheck size={14} aria-hidden />
            ) : readiness.state === 'eligible_for_execution' ? (
              <CheckCircle2 size={14} aria-hidden />
            ) : (
              <ShieldAlert size={14} aria-hidden />
            )}
            Real-recipient Gmail rollout
          </p>
          <p className="mt-1 text-[11px] leading-4">{readiness.label}</p>
        </div>
        <span className="w-fit shrink-0 rounded-full border border-current/25 px-2 py-0.5 text-[10px] font-semibold">
          {readiness.actionLabel}
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-4">{primaryDetail}</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5 xl:grid-cols-3">
        {requirements.map(([label, state]) => (
          <span
            key={label}
            className={`rounded-md border px-2 py-1.5 text-[10px] leading-4 ${rolloutRequirementClasses(state)}`}
          >
            {label}: {state.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
      <div className={`mt-2 rounded-md border p-2 ${receipt ? canaryReceiptClasses(receipt.finalSendAuthority.state) : 'border-red-500/25 bg-red-500/10 text-red-50'}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
              <FileText size={13} aria-hidden />
              Canary proof receipt
            </p>
            <p className="mt-1 text-[11px] leading-4">
              {receipt
                ? receipt.finalSendAuthority.detail
                : 'No canary proof receipt is available. Keep live Gmail send blocked until readiness evidence is rebuilt.'}
            </p>
          </div>
          <span
            aria-label="Live Gmail send disabled"
            className="inline-flex min-h-7 w-fit shrink-0 items-center gap-1.5 rounded-full border border-current/25 bg-background/25 px-2 py-0.5 text-[10px] font-semibold"
          >
            <LockKeyhole size={12} aria-hidden />
            Live send disabled
          </span>
        </div>
        {receipt && (
          <>
            <p className="mt-2 text-[11px] leading-4">
              Next step: {receipt.finalSendAuthority.nextStep}
            </p>
            <div className="mt-2 grid gap-1.5 text-[10px] leading-4 sm:grid-cols-3">
              <p className="rounded-md border border-current/20 bg-background/20 p-2">
                Approval intent: {slackApprovalStatusLabel(receipt.approvalEvidence.slackApprovalStatus)}. Gmail auth: {receipt.approvalEvidence.portfolioAuthorizationState.replace(/_/g, ' ')}.
              </p>
              <p className="rounded-md border border-current/20 bg-background/20 p-2">
                Draft evidence: {receipt.draftEvidence.state}. Sender: {receipt.recipientIdentity.senderState}.
              </p>
              <p className="rounded-md border border-current/20 bg-background/20 p-2">
                Send evidence: {receipt.suppressionAndIdempotency.submittedEvidenceRecorded ? 'present' : 'none'}. Gmail execution: disabled.
              </p>
            </div>
            {receipt.lastActionEvidence.repairRequired && (
              <p className="mt-2 rounded-md border border-amber-400/35 bg-amber-400/10 p-2 text-[11px] leading-4">
                Repair needed: {receipt.lastActionEvidence.detail}
              </p>
            )}
            <details className="mt-2 rounded-md border border-current/20 bg-background/20 p-2">
              <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide">
                Proof details
              </summary>
              <div className="mt-2 grid gap-1.5 text-[10px] leading-4 sm:grid-cols-2">
                <p className="break-words">Queue row: {receipt.queueRow.sourceId ?? 'missing'}</p>
                <p className="break-words">Relationship packet: {receipt.queueRow.relationshipPacketReference}</p>
                <p className="break-words">
                  Draft: {receipt.draftEvidence.state}{receipt.draftEvidence.draftId ? ` / ${receipt.draftEvidence.draftId}` : ''}
                </p>
                <p className="break-words">
                  Provider: {receipt.gmailCapability.providerState}. Suppression: {receipt.suppressionAndIdempotency.suppressionState}.
                </p>
                <p className="break-words">
                  Dispatch: {receipt.approvalEvidence.slackDispatchStatus.replace(/_/g, ' ')}. Approval records intent only.
                </p>
                <p className="break-words">
                  Approval route: {readiness.slackApprovalContract.route}.
                </p>
                <p className="break-all">
                  Approval dedupe: {readiness.slackApprovalContract.payloadDedupeKey}
                </p>
                <p className="break-words">
                  Last action: {receipt.lastActionEvidence.status.replace(/_/g, ' ')}.
                </p>
                <p className="break-all sm:col-span-2">
                  Send key: {receipt.queueRow.sendQueueIdempotencyKey} / Submitted evidence: {receipt.queueRow.submittedEvidenceKey}
                </p>
              </div>
            </details>
          </>
        )}
      </div>
      <div className="mt-2 grid gap-1.5 text-[10px] leading-4 text-current/85 sm:grid-cols-2">
        <p className="break-words">
          Approval request: {slackApprovalStatusLabel(slackStatus)}. Slack dispatch: {readiness.slackApprovalContract.slackDispatchStatus.replace(/_/g, ' ')}.
        </p>
        <p>
          Approval records intent only. Gmail send: off.
        </p>
        <p>
          Exact execution still needs per-recipient authorization and captain flag.
        </p>
        <p>
          Operator state: {readiness.requirements.execution.state.replace(/_/g, ' ')}.
        </p>
      </div>
      {recovery && readiness.slackApprovalContract.dispatchEnabled === false && (
        <div className="mt-2 rounded-md border border-sky-500/25 bg-background/25 p-2 text-[11px] leading-4 text-current/85">
          <p className="font-semibold">{recovery.label}</p>
          <p className="mt-1">{recovery.detail}</p>
          <p className="mt-1">Next action: {recovery.nextAction}</p>
        </div>
      )}
    </div>
  )
}

function ActivationReadinessPacket({
  readiness,
}: {
  readiness?: WarmOutreachGmailProviderActivationReadiness | null
}) {
  if (!readiness) return null
  const duplicate = readiness.duplicateDraftEvidence
  const trackingLabel = duplicate.createdOnce
    ? 'Gmail draft exists and is tracked'
    : 'No tracked Gmail draft'
  const trackingDetail = duplicate.createdOnce
    ? 'Reuse the saved Gmail draft record. It is tracking evidence only; external send still needs separate approval.'
    : 'No Gmail draft tracking is recorded for this contact, channel, and message version.'

  return (
    <div className="mt-2 rounded-md border border-sky-500/25 bg-sky-500/10 p-2 text-sky-50">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide">Gmail provider activation readiness</p>
          <p className="mt-1 text-[11px] leading-4 text-sky-100/90">
            Draft readiness, sender readiness, canary readiness, duplicate evidence, and send authority are separate gates.
          </p>
        </div>
        <span className="w-fit shrink-0 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-100">
          {readiness.externalSendBoundary.label}
        </span>
      </div>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`rounded-md border p-2 ${activationStepClasses(readiness.localDraftReadiness.state)}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide">Local draft readiness</p>
          <p className="mt-1 text-[11px] leading-4">{readiness.localDraftReadiness.label}</p>
        </div>
        <div className={`rounded-md border p-2 ${activationStepClasses(readiness.connectedSenderReadiness.state)}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide">Connected sender readiness</p>
          <p className="mt-1 text-[11px] leading-4">{readiness.connectedSenderReadiness.label}</p>
          <p className="mt-1 break-all text-[10px] leading-4 opacity-80">
            Required: {readiness.connectedSenderReadiness.requiredSender ?? 'check via canary'}
            {readiness.connectedSenderReadiness.connectedAs ? ` / Connected: ${readiness.connectedSenderReadiness.connectedAs}` : ''}
          </p>
        </div>
        <div className={`rounded-md border p-2 ${activationStepClasses(readiness.liveDraftCanaryReadiness.state)}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide">Live draft canary readiness</p>
          <p className="mt-1 text-[11px] leading-4">{readiness.liveDraftCanaryReadiness.label}</p>
          <p className="mt-1 text-[10px] leading-4 opacity-80">No-send canary: provider calls off / creates draft: no</p>
        </div>
        <div className={`rounded-md border p-2 ${duplicate.createdOnce ? 'border-amber-500/25 bg-amber-500/10 text-amber-100' : 'border-silicon-slate bg-background/25 text-muted-foreground'}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide">Gmail draft tracking</p>
          <p className="mt-1 text-[11px] leading-4">{trackingLabel}</p>
          <p className="mt-1 break-all text-[10px] leading-4 opacity-80">
            Draft: {duplicate.draftId ?? 'none'} / Thread: {duplicate.threadId ?? 'none'} / Message: {duplicate.messageId ?? 'none'}
          </p>
          <p className="mt-1 text-[10px] leading-4 opacity-80">{trackingDetail}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {readiness.remainingHumanGates.map((gate) => (
          <span
            key={gate}
            className="inline-flex min-h-7 items-center rounded-full border border-silicon-slate bg-background/35 px-2 py-1 text-[10px] font-semibold text-muted-foreground"
          >
            {gate.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
    </div>
  )
}

function ProviderExecutionReadinessPacket({
  readiness,
}: {
  readiness?: WarmOutreachGmailProviderExecutionReadiness | null
}) {
  if (!readiness) return null
  const stateClasses =
    readiness.state === 'sent_do_not_resend'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-50'
      : readiness.state === 'blocked'
        ? 'border-red-500/30 bg-red-500/10 text-red-50'
        : 'border-sky-500/30 bg-sky-500/10 text-sky-50'

  return (
    <div className={`mt-2 rounded-md border p-2 ${stateClasses}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
            <Database size={13} aria-hidden />
            Provider execution readiness
          </p>
          <p className="mt-1 text-[11px] leading-4">{readiness.label}</p>
        </div>
        <span className="inline-flex min-h-7 w-fit shrink-0 items-center gap-1.5 rounded-full border border-current/25 bg-background/25 px-2 py-0.5 text-[10px] font-semibold">
          <LockKeyhole size={12} aria-hidden />
          Admin gate disabled
        </span>
      </div>
      <div className="mt-2 grid gap-1.5 text-[10px] leading-4 sm:grid-cols-2">
        <p className="rounded-md border border-current/20 bg-background/20 p-2">
          Operator decision: {slackApprovalStatusLabel(readiness.operatorDecision.status)}. Records authorization intent only.
        </p>
        <p className="rounded-md border border-current/20 bg-background/20 p-2">
          Activation gate: {readiness.adminActivationGate.key} is {readiness.adminActivationGate.state}.
        </p>
        <p className="rounded-md border border-current/20 bg-background/20 p-2">
          Canary trace: {readiness.canaryTrace.status.replace(/_/g, ' ')}{readiness.canaryTrace.queueId ? ` / ${readiness.canaryTrace.queueId}` : ''}.
        </p>
      </div>
      <p className="mt-2 text-[11px] leading-4">{readiness.operatorDecision.nextAction}</p>
      <details className="mt-2 rounded-md border border-current/20 bg-background/20 p-2">
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide">
          Execution gate details
        </summary>
        <div className="mt-2 grid gap-1.5 text-[10px] leading-4 sm:grid-cols-2">
          <p>{readiness.adminActivationGate.detail}</p>
          <p>{readiness.exactExecutionGate.detail}</p>
          <p className="break-all">Execution route: {readiness.exactExecutionGate.route}. UI action: disabled.</p>
          <p className="break-all">Send key: {readiness.exactExecutionGate.sendQueueIdempotencyKey}</p>
          <p className="break-all">Submitted evidence: {readiness.exactExecutionGate.submittedEvidenceKey}</p>
          {readiness.canaryTrace.sentEvidenceRecorded && (
            <p className="break-words sm:col-span-2">
              Sent evidence exists: Gmail message {readiness.canaryTrace.gmailMessageId ?? 'unknown'} / thread {readiness.canaryTrace.gmailThreadId ?? 'unknown'}.
            </p>
          )}
        </div>
      </details>
    </div>
  )
}

function GmailResponseImportReadinessCard({
  readiness,
}: {
  readiness?: WarmOutreachResponseMonitoring['gmailResponseImportReadiness'] | null
}) {
  if (!readiness) return null
  const candidate = readiness.latestCandidate
  const activation = readiness.activationReadiness
  const canary = readiness.canaryReadiness

  return (
    <div className={`mt-2 rounded-md border p-2.5 ${gmailImportClasses(readiness.state)}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
            <Mail size={13} aria-hidden />
            Gmail response import
          </p>
          <p className="mt-1 text-[11px] leading-4">{readiness.label}</p>
        </div>
        <span className="inline-flex min-h-7 w-fit shrink-0 items-center gap-1.5 rounded-full border border-current/25 bg-background/25 px-2 py-0.5 text-[10px] font-semibold">
          <LockKeyhole size={12} aria-hidden />
          Live import off
        </span>
      </div>
      <div className="mt-2 grid gap-1.5 text-[10px] leading-4 sm:grid-cols-2 xl:grid-cols-4">
        <p className="rounded-md border border-current/20 bg-background/20 p-2">
          Candidate: {candidate.status.replace(/_/g, ' ')} / confidence {candidate.confidence}
        </p>
        <p className="rounded-md border border-current/20 bg-background/20 p-2 break-all">
          Queue: {candidate.matchedOutreachQueueId ?? 'manual match needed'}
        </p>
        <p className="rounded-md border border-current/20 bg-background/20 p-2 break-all">
          Thread: {candidate.providerThreadId ?? 'missing'}
        </p>
        <p className="rounded-md border border-current/20 bg-background/20 p-2 break-all">
          Message: {candidate.providerMessageId ?? 'missing'}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {readiness.matchBasis.map((basis) => (
          <span
            key={basis.key}
            title={basis.detail}
            className={`inline-flex min-h-7 items-center rounded-full border px-2 py-1 text-[10px] font-semibold ${matchBasisClasses(basis.available)}`}
          >
            {basis.label}: {basis.available ? 'ready' : 'missing'}
          </span>
        ))}
      </div>
      <div className="mt-2 grid gap-2 text-[11px] leading-4 sm:grid-cols-2">
        <p className="rounded-md border border-current/20 bg-background/20 p-2">
          Next: {candidate.nextAction}
        </p>
        <p className="rounded-md border border-current/20 bg-background/20 p-2">
          Recovery: {candidate.recoveryPath}
        </p>
      </div>
      <div className={`mt-2 rounded-md border p-2 ${canaryStateClasses(canary.state)}`}>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide">Response import canary readiness</p>
            <p className="mt-1 text-[11px] leading-4">{canary.label}</p>
          </div>
          <span className="w-fit shrink-0 rounded-full border border-current/25 px-2 py-0.5 text-[10px] font-semibold">
            {canary.liveReadApproved ? 'Live read approved' : 'Live read approval required'}
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-4">{canary.detail}</p>
        <div className="mt-2 grid gap-1.5 text-[10px] leading-4 sm:grid-cols-2 xl:grid-cols-4">
          <p className="break-all rounded-md border border-current/20 bg-background/20 p-2">
            Run: {canary.provenance.importRunId}
          </p>
          <p className="break-all rounded-md border border-current/20 bg-background/20 p-2">
            Dedupe: {canary.provenance.dedupeKey}
          </p>
          <p className="rounded-md border border-current/20 bg-background/20 p-2">
            Decision: {canary.provenance.decisionState.replace(/_/g, ' ')}
          </p>
          <p className="rounded-md border border-current/20 bg-background/20 p-2">
            Actor: {canary.provenance.actor}
          </p>
          <p className="break-all rounded-md border border-current/20 bg-background/20 p-2">
            Contact: {canary.provenance.contactId ?? 'missing'} / Queue: {canary.provenance.queueId ?? 'missing'}
          </p>
          <p className="break-all rounded-md border border-current/20 bg-background/20 p-2">
            Gmail: {canary.provenance.gmailThreadId ?? 'missing'} / {canary.provenance.gmailMessageId ?? 'missing'}
          </p>
          <p className="rounded-md border border-current/20 bg-background/20 p-2">
            Outcome: {canary.latestOutcome.status.replace(/_/g, ' ')}
          </p>
          <p className="rounded-md border border-current/20 bg-background/20 p-2">
            Retry: {canary.retryAvailable ? 'available' : 'not needed'}
          </p>
        </div>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {canary.gates.map((gate) => (
            <span
              key={gate.key}
              title={gate.detail}
              className={`rounded-md border px-2 py-1.5 text-[10px] leading-4 ${canaryGateClasses(gate.state)}`}
            >
              {gate.label}: {gate.state.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-4 opacity-85">
          Gmail API: {canary.gmailApiCalled ? 'called' : 'not called'} / DB writes: {canary.databaseWritesEnabled ? 'enabled' : 'off'} / reply draft: {canary.responseDraftCreated ? 'created' : 'not created'}.
        </p>
      </div>
      {activation && (
        <div className="mt-2 rounded-md border border-current/20 bg-background/20 p-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide">
              Activation readiness: {activation.label}
            </p>
            <p className="text-[10px] opacity-80">
              Mock: {activation.canRunMockImport ? 'ready' : 'blocked'} / live: disabled
            </p>
          </div>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {activation.gateRows.map((row) => (
              <div
                key={row.key}
                className={`rounded-md border p-2 text-[10px] leading-4 ${activationGateClasses(row.state)}`}
                title={row.detail}
              >
                <p className="font-semibold">{row.label}: {row.state.replace(/_/g, ' ')}</p>
                <p className="mt-0.5 opacity-85">{row.nextAction}</p>
              </div>
            ))}
          </div>
          {activation.blockedReasons.length > 0 && (
            <p className="mt-2 rounded-md border border-current/20 bg-background/20 p-2 text-[10px] leading-4">
              Gate state: {activation.blockedReasons[0]}
            </p>
          )}
        </div>
      )}
      <details className="mt-2 rounded-md border border-current/20 bg-background/20 p-2">
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide">
          Import dedupe keys
        </summary>
        <div className="mt-2 grid gap-1.5 text-[10px] leading-4 sm:grid-cols-2">
          {readiness.dedupe.keys.length > 0 ? (
            readiness.dedupe.keys.slice(0, 6).map((key) => (
              <p key={key} className="break-all rounded-md border border-current/20 bg-background/20 p-2">
                {key}
              </p>
            ))
          ) : (
            <p>No durable Gmail import dedupe key is available yet.</p>
          )}
        </div>
        <p className="mt-2 text-[10px] leading-4 opacity-80">{readiness.dedupe.detail}</p>
      </details>
      <p className="mt-2 text-[10px] leading-4 opacity-85">
        Dry-run import: {readiness.dryRunImportEnabled ? 'on' : 'off'} / Gmail API: {readiness.gmailApiCalled ? 'called' : 'not called'} / Slack and n8n: off.
      </p>
    </div>
  )
}

function summarizeAuthority(items: SendReadinessItem[]) {
  return items.reduce(
    (summary, item) => {
      if (item.sendAuthority.state === 'blocked') summary.blocked += 1
      if (item.sendAuthority.state === 'eligible_for_future_activation') summary.future += 1
      if (item.sendAuthority.state === 'manual_only') summary.manual += 1
      return summary
    },
    { blocked: 0, future: 0, manual: 0 },
  )
}

function EmailLifecycleCompact({
  canaryError,
  canaryLoading,
  canaryResult,
  inertSlackApprovalRequest,
  item,
  onRunCanary,
}: {
  canaryError?: string | null
  canaryLoading?: boolean
  canaryResult?: RelationshipPacketPanelProps['gmailDraftCanaryResult']
  inertSlackApprovalRequest?: boolean
  item?: SendReadinessItem
  onRunCanary?: () => void
}) {
  const [sendAuthorityNotice, setSendAuthorityNotice] = useState<string | null>(null)
  const lifecycle = item?.emailSendLifecycle
  if (!lifecycle) return null
  const handoff = lifecycle.gmailDraftHandoffPacket
  const smoke = lifecycle.providerCapabilitySmoke
  const draftGate = lifecycle.gmailDraftCreationGate
  const externalSend = lifecycle.externalSendReadiness
  const realRecipientRollout = lifecycle.realRecipientRolloutReadiness
  const activationReadiness =
    canaryResult?.activationReadiness ?? lifecycle.gmailProviderActivationReadiness

  return (
    <div className="space-y-2">
      <GmailOperatingLoopCard
        inertSlackApprovalRequest={inertSlackApprovalRequest}
        loop={lifecycle.gmailOperatingLoop}
      />
      <details className="rounded-md border border-silicon-slate/70 bg-background/25">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
          Gmail audit and recovery details
        </summary>
        <div className="border-t border-silicon-slate/70 bg-amber-500/10 p-2.5 text-amber-50">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
            <Mail size={14} aria-hidden />
            Email first candidate
          </p>
          <p className="mt-1 text-[11px] leading-4 text-amber-100/90">
            {emailLifecycleStateLabel(lifecycle.state)}. Future approval must cover this contact, channel, and message version.
          </p>
        </div>
        <span className="w-fit shrink-0 rounded-full border border-current/25 px-2 py-0.5 text-[10px] font-semibold">
          Provider/send off
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {lifecycle.stages.map((stage) => (
          <span
            key={stage.key}
            title={stage.detail}
            className={`inline-flex min-h-7 items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${emailLifecycleStageClasses(stage.status)}`}
          >
            {stage.label}: {stage.status.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
      <p className="mt-2 break-all text-[10px] leading-4 text-amber-100/80">
        Queue key: {lifecycle.sendQueueIdempotencyKey}
      </p>
      <RealRecipientRolloutCard readiness={realRecipientRollout} />
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div className={`rounded-md border p-2 ${gmailHandoffClasses(handoff.state)}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide">Internal draft handoff</p>
            <span className="rounded-full border border-current/25 px-2 py-0.5 text-[10px] font-semibold">
              {handoff.internalHandoffReady ? 'Ready' : 'Blocked'}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-4">
            {handoff.contactReference.reference} / {handoff.templateDraftBasis.recommendedTemplate.replace(/_/g, ' ')}
          </p>
          <p className="mt-1 text-[11px] leading-4">
            Suppression: {handoff.suppressionStatus}. Gmail draft creation off. External send blocked.
          </p>
          <p className="mt-1 break-all text-[10px] leading-4 opacity-80">{handoff.idempotencyKey}</p>
        </div>
        <div className={`rounded-md border p-2 ${providerSmokeClasses(smoke.status)}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide">Gmail provider smoke</p>
            <span className="rounded-full border border-current/25 px-2 py-0.5 text-[10px] font-semibold">
              {smoke.status.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-4">{smoke.label}. Provider calls off.</p>
          <p className="mt-1 text-[11px] leading-4">
            OAuth: {smoke.oauthConfigured ? 'configured' : 'missing'} / Profile: {smoke.connectedProfileAvailable ? 'available' : 'missing'}.
          </p>
          <p className="mt-1 text-[11px] leading-4">
            Draft handoff ready is separate from provider activation and send authority.
          </p>
          <p className="mt-1 break-all text-[10px] leading-4 opacity-80">{smoke.smokeKey}</p>
        </div>
      </div>
      <ActivationReadinessPacket readiness={activationReadiness} />
      <ProviderExecutionReadinessPacket readiness={lifecycle.gmailProviderExecutionReadiness} />
      <div className="mt-2 rounded-md border border-red-500/25 bg-red-500/10 p-2 text-red-50">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
              <LockKeyhole size={13} aria-hidden />
              External send authority
            </p>
            <p className="mt-1 text-[11px] leading-4 text-red-100/90">{externalSend.label}</p>
          </div>
          <span className="w-fit shrink-0 rounded-full border border-current/25 px-2 py-0.5 text-[10px] font-semibold">
            Disabled
          </span>
        </div>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-5">
          <span className="rounded-md border border-current/20 bg-background/20 p-2 text-[10px] leading-4">
            Sender: {externalSend.senderIdentity.state.replace(/_/g, ' ')}
          </span>
          <span className="rounded-md border border-current/20 bg-background/20 p-2 text-[10px] leading-4">
            Recipient approval: {externalSend.recipientApproval.approved ? 'approved' : 'required'}
          </span>
          <span className="rounded-md border border-current/20 bg-background/20 p-2 text-[10px] leading-4">
            Draft evidence: {externalSend.draftEvidence.gmailDraftExists ? 'tracked Gmail draft' : 'missing'}
          </span>
          <span className="rounded-md border border-current/20 bg-background/20 p-2 text-[10px] leading-4">
            Suppression: {externalSend.suppressionConsent.state}
          </span>
          <span className="rounded-md border border-current/20 bg-background/20 p-2 text-[10px] leading-4">
            External send: {externalSend.externalSend.blocked ? 'blocked' : 'enabled'}
          </span>
        </div>
        <p className="mt-2 break-all text-[10px] leading-4 text-red-100/80">
          Send key: {externalSend.idempotency.sendQueueIdempotencyKey}
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-4 text-red-100/90">{externalSend.externalSend.detail}</p>
          <button
            type="button"
            onClick={() => setSendAuthorityNotice(externalSend.externalSend.nextStep)}
            className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 text-xs font-semibold text-red-100 transition-colors hover:bg-red-500/20 sm:w-auto"
          >
            <ShieldAlert size={13} aria-hidden />
            Check send authority
          </button>
        </div>
        {sendAuthorityNotice && (
          <p role="status" className="mt-2 rounded-md border border-red-500/35 bg-background/35 p-2 text-[11px] leading-4 text-red-100">
            {sendAuthorityNotice}
          </p>
        )}
      </div>
      <div className={`mt-2 rounded-md border p-2 ${draftCreationGateClasses(draftGate.status)}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide">Gmail draft creation availability</p>
          <span className="rounded-full border border-current/25 px-2 py-0.5 text-[10px] font-semibold">
            {draftGate.status.replace(/_/g, ' ')}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-4">
          {draftGate.label}. Draft creation off. External send blocked.
        </p>
        <p className="mt-1 break-all text-[10px] leading-4 opacity-80">{draftGate.draftCreationKey}</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-4 opacity-90">
            Run a no-send canary to confirm the contact, message-version keys, and gates are wired. It does not call Gmail.
          </p>
          <button
            type="button"
            onClick={onRunCanary}
            disabled={!onRunCanary || canaryLoading}
            className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md border border-sky-500/35 bg-sky-500/10 px-3 text-xs font-semibold text-sky-100 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:border-silicon-slate disabled:bg-silicon-slate/20 disabled:text-muted-foreground sm:w-auto"
          >
            {canaryLoading ? <RefreshCw size={13} className="animate-spin" aria-hidden /> : <CheckCircle2 size={13} aria-hidden />}
            {canaryLoading ? 'Checking...' : 'Run no-send canary'}
          </button>
        </div>
        {canaryError && (
          <p role="alert" className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-[11px] leading-4 text-red-100">
            {canaryError}
          </p>
        )}
        {canaryResult && (
          <div className="mt-2 rounded-md border border-emerald-500/25 bg-emerald-500/10 p-2 text-[11px] leading-4 text-emerald-100">
            <p className="font-semibold">{canaryResult.message}</p>
            <p className="mt-1">
              Gmail draft: {canaryResult.gmailDraftCreated ? 'created' : 'not created'} / Tracking: {canaryResult.trackingPersisted ? 'persisted' : 'not written'} / External send: {canaryResult.externalSendEnabled ? 'enabled' : 'blocked'}.
            </p>
          </div>
        )}
      </div>
        </div>
      </details>
    </div>
  )
}

function SendAuthorityCompactRow({
  label,
  items,
}: {
  label: string
  items: SendReadinessItem[]
}) {
  const summary = summarizeAuthority(items)

  return (
    <div className="rounded-md border border-silicon-slate/70 bg-background/30 p-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">{label}</p>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            {summary.future} future eligible / {summary.manual} manual / {summary.blocked} blocked
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={item.channel}
              className={`inline-flex min-h-7 items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${sendAuthorityClasses(item.sendAuthority.state)}`}
              title={item.sendAuthority.nextReviewAction}
            >
              {CHANNEL_LABELS[item.channel]}: {sendAuthorityStateLabel(item.sendAuthority.state)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function SendAuthorityDetailCard({ item }: { item: SendReadinessItem }) {
  const authority = item.sendAuthority
  const blockedCount = authority.gates.filter((gate) => gate.status === 'blocked').length
  const futureGateCount = authority.gates.filter((gate) => gate.status === 'future_gate').length
  const manualGateCount = authority.gates.filter((gate) => gate.status === 'manual_required').length

  return (
    <div className={`rounded-md border p-2 ${sendAuthorityClasses(authority.state)}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold">{CHANNEL_LABELS[item.channel]}</p>
        <span className="shrink-0 rounded-full border border-current/25 px-1.5 py-0.5 text-[10px] font-semibold">
          {sendAuthorityStateLabel(authority.state)}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-4">{authority.nextReviewAction}</p>
      <p className="mt-2 text-[11px] leading-4 opacity-90">
        Gates: {blockedCount} blocked / {futureGateCount} future / {manualGateCount} manual
      </p>
      <p className="mt-1 break-all text-[10px] leading-4 opacity-80">{authority.idempotencyKey}</p>
    </div>
  )
}

function sourceLabel(value: string) {
  return value.replace(/_/g, ' ')
}

function BoundaryFlag({
  active,
  label,
}: {
  active: boolean
  label: string
}) {
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

function smsReadinessClasses(state: WarmSmsReadinessState) {
  if (state === 'manual_ready') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
  if (state === 'manual_review_required') return 'border-sky-500/30 bg-sky-500/10 text-sky-100'
  return 'border-red-500/30 bg-red-500/10 text-red-100'
}

function smsCheckClasses(status: WarmSmsReadiness['consentAndSuppression']['checks'][number]['status']) {
  if (status === 'passed') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
  if (status === 'blocked') return 'border-red-500/25 bg-red-500/10 text-red-100'
  return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
}

function smsDecisionClasses(state: WarmSmsApprovalState) {
  if (state === 'approved_manual_ready') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
  if (state === 'revision_requested') return 'border-amber-500/30 bg-amber-500/10 text-amber-100'
  if (state === 'rejected') return 'border-red-500/30 bg-red-500/10 text-red-100'
  return 'border-silicon-slate bg-background/30 text-muted-foreground'
}

function smsDecisionLabel(state: WarmSmsApprovalState) {
  if (state === 'approved_manual_ready') return 'Approved for manual use'
  if (state === 'revision_requested') return 'Revision requested'
  if (state === 'rejected') return 'Rejected'
  return 'Not reviewed'
}

function smsLoopStageClasses(active: boolean, complete: boolean, suppressed: boolean) {
  if (suppressed) return 'border-red-500/30 bg-red-500/10 text-red-100'
  if (active) return 'border-sky-500/35 bg-sky-500/10 text-sky-100'
  if (complete) return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
  return 'border-current/15 bg-background/20 text-muted-foreground'
}

function SmsManualOutreachCard({ readiness }: { readiness?: WarmSmsReadiness | null }) {
  const [decision, setDecision] = useState<WarmSmsApprovalState>(
    readiness?.approval.state ?? 'not_reviewed',
  )
  const [draftText, setDraftText] = useState(readiness?.draft.preview ?? '')
  const [draftRevised, setDraftRevised] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [manualSendPrepared, setManualSendPrepared] = useState(false)
  const [evidenceRecorded, setEvidenceRecorded] = useState(false)
  const [evidenceTimestamp, setEvidenceTimestamp] = useState<string | null>(null)
  const [operatorNote, setOperatorNote] = useState('')
  const [responseOutcome, setResponseOutcome] = useState<WarmSmsManualResponseOutcome>('no_response_yet')

  useEffect(() => {
    setDecision(readiness?.approval.state ?? 'not_reviewed')
    setDraftText(readiness?.draft.preview ?? '')
    setDraftRevised(false)
    setCopyStatus('idle')
    setManualSendPrepared(false)
    setEvidenceRecorded(false)
    setEvidenceTimestamp(null)
    setOperatorNote('')
    setResponseOutcome('no_response_yet')
  }, [readiness?.approval.state, readiness?.contactId, readiness?.draft.preview])

  if (!readiness) return null

  const loop = evaluateWarmSmsManualLoop({
    readinessState: readiness.state,
    approvalState: decision,
    draftText,
    draftRevised,
    manualSendPrepared,
    evidenceRecorded,
    evidence: {
      sentAt: evidenceTimestamp,
      channel: 'manual_sms',
      operatorNote,
      outcome: responseOutcome,
    },
  })
  const blocked = readiness.state === 'blocked'
  const suppressed = loop.gates.smsPromptsSuppressed
  const canApprove = !blocked && !suppressed && draftText.trim().length > 0
  const decisionDetail =
    decision === 'approved_manual_ready'
      ? 'Manual readiness is recorded on this screen only. Portfolio still cannot send SMS.'
      : decision === 'revision_requested'
        ? 'Revise the text here, then approve manual readiness or reject it.'
        : decision === 'rejected'
          ? 'This SMS draft is rejected. Resolve the reason before any manual outreach.'
          : 'Review the checks and draft before recording a manual-only decision.'
  const activeStageIndex = warmSmsManualLoopStages.findIndex((stage) => stage.state === loop.state)

  async function handleCopyApprovedDraft() {
    if (!loop.gates.canCopyApprovedDraft) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(draftText)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  function recordManualEvidence() {
    setEvidenceTimestamp(new Date().toISOString())
    setEvidenceRecorded(true)
  }

  return (
    <div id="warm-sms-readiness" className={`rounded-md border p-3 ${smsReadinessClasses(readiness.state)}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
            <Phone size={14} aria-hidden />
            Warm SMS manual readiness
          </p>
          <p className="mt-1 text-sm font-semibold">{readiness.label}</p>
          <p className="mt-1 text-[11px] leading-4 opacity-85">
            SMS is stricter than email here: phone, source, relationship rationale, suppression, opt-out sensitivity, and manual-only handling must be visible first.
          </p>
        </div>
        <span className="inline-flex min-h-7 w-fit shrink-0 items-center gap-1.5 rounded-full border border-current/25 bg-background/25 px-2 py-0.5 text-[10px] font-semibold">
          <LockKeyhole size={12} aria-hidden />
          No SMS provider
        </span>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-md border border-current/20 bg-background/20 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide">Phone and consent basis</p>
          <p className="mt-1 text-[11px] leading-4">
            Phone: {readiness.phoneReadiness.present ? 'present' : 'missing'} from {readiness.phoneReadiness.source}.
          </p>
          <p className="mt-1 text-[11px] leading-4 opacity-85">{readiness.phoneReadiness.provenance}</p>
          <p className="mt-1 text-[11px] leading-4">
            Relationship: {readiness.relationshipRationale.status} / {readiness.relationshipRationale.sourceCount} source(s), {readiness.relationshipRationale.signalCount} signal(s).
          </p>
          <p className="mt-1 text-[11px] leading-4 opacity-85">{readiness.consentAndSuppression.rationale}</p>
        </div>

        <div className="rounded-md border border-current/20 bg-background/20 p-2.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide">Draft preview</p>
              <p className="mt-1 text-[11px] leading-4">
                {readiness.draft.templateLabel}: {readiness.draft.selectionReason}
              </p>
            </div>
            <span className="w-fit shrink-0 rounded-full border border-current/25 px-2 py-0.5 text-[10px] font-semibold">
              {draftText.length}/{readiness.draft.maxRecommendedCharacters}
            </span>
          </div>
          <label className="mt-2 block">
            <span className="sr-only">Warm SMS draft text</span>
            <textarea
              value={draftText}
              onChange={(event) => {
                setDraftText(event.target.value)
                setDraftRevised(true)
                if (decision === 'approved_manual_ready') setDecision('revision_requested')
                setManualSendPrepared(false)
                setEvidenceRecorded(false)
                setEvidenceTimestamp(null)
                setCopyStatus('idle')
              }}
              placeholder="Keep this short, relationship-aware, and manual-send only."
              autoComplete="off"
              disabled={blocked || suppressed}
              rows={3}
              className="min-h-[82px] w-full resize-y rounded-md border border-silicon-slate/70 bg-imperial-navy/90 p-2 text-xs leading-5 text-platinum-white caret-radiant-gold shadow-inner outline-none transition-colors [color-scheme:dark] placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:ring-2 focus:ring-radiant-gold/25 disabled:cursor-not-allowed disabled:border-silicon-slate/60 disabled:bg-silicon-slate/20 disabled:text-muted-foreground/70 disabled:opacity-70"
            />
          </label>
          <p className="mt-1 text-[10px] leading-4 opacity-80">
            Draft helper only. Manual send remains outside Portfolio and must stop on any opt-out or uncertainty.
          </p>
        </div>
      </div>

      <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {readiness.consentAndSuppression.checks.map((check) => (
          <div key={check.key} className={`rounded-md border p-2 ${smsCheckClasses(check.status)}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide">{check.label}</p>
            <p className="mt-1 text-[10px] leading-4">{check.detail}</p>
          </div>
        ))}
      </div>

      <div className={`mt-2 rounded-md border p-2.5 ${smsDecisionClasses(decision)}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide">Manual decision state</p>
            <p className="mt-1 text-sm font-semibold">{smsDecisionLabel(decision)}</p>
            <p className="mt-1 text-[11px] leading-4">{decisionDetail}</p>
          </div>
          <div className="grid w-full grid-cols-1 gap-1.5 sm:w-auto sm:grid-cols-3">
            <button
              type="button"
              disabled={!canApprove}
              onClick={() => {
                setDecision('approved_manual_ready')
                setCopyStatus('idle')
              }}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 text-[11px] font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 size={13} aria-hidden />
              Approve
            </button>
            <button
              type="button"
              disabled={blocked || suppressed}
              onClick={() => {
                setDecision('revision_requested')
                setManualSendPrepared(false)
                setEvidenceRecorded(false)
                setEvidenceTimestamp(null)
              }}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-amber-500/35 bg-amber-500/10 px-2 text-[11px] font-semibold text-amber-100 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={13} aria-hidden />
              Revise
            </button>
            <button
              type="button"
              onClick={() => {
                setDecision('rejected')
                setManualSendPrepared(false)
                setEvidenceRecorded(false)
                setEvidenceTimestamp(null)
              }}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-red-500/35 bg-red-500/10 px-2 text-[11px] font-semibold text-red-100 transition-colors hover:bg-red-500/20"
            >
              <ShieldAlert size={13} aria-hidden />
              Reject
            </button>
          </div>
        </div>
        <p className="mt-2 text-[10px] leading-4 opacity-80">
          Approval records manual-send readiness only. SMS delivery, provider calls, phone import, Slack, Gmail, n8n, and production mutation are off. Generic “proceed” is ignored for SMS sending.
        </p>
      </div>

      <div className="mt-2 rounded-md border border-current/20 bg-background/20 p-2.5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide">Manual SMS operating loop</p>
            <p className="mt-1 text-sm font-semibold">{loop.label}</p>
            <p className="mt-1 text-[11px] leading-4">{loop.operatorNextAction}</p>
            {loop.recoveryStep && (
              <p className="mt-1 rounded-md border border-current/20 bg-background/25 p-2 text-[11px] leading-4">
                Recovery: {loop.recoveryStep}
              </p>
            )}
          </div>
          <div className="grid w-full grid-cols-1 gap-1.5 sm:grid-cols-2 lg:w-auto">
            <button
              type="button"
              disabled={!loop.gates.canCopyApprovedDraft}
              onClick={handleCopyApprovedDraft}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-sky-500/35 bg-sky-500/10 px-2 text-[11px] font-semibold text-sky-100 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ClipboardCopy size={13} aria-hidden />
              Copy approved draft
            </button>
            <button
              type="button"
              disabled={!loop.gates.canPrepareManualSend}
              onClick={() => setManualSendPrepared(true)}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 text-[11px] font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={13} aria-hidden />
              Prepare manual use
            </button>
          </div>
        </div>
        {copyStatus !== 'idle' && (
          <p className={`mt-2 rounded-md border p-2 text-[11px] leading-4 ${
            copyStatus === 'copied'
              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
              : 'border-amber-500/25 bg-amber-500/10 text-amber-100'
          }`}>
            {copyStatus === 'copied'
              ? 'Approved SMS draft copied. Send manually outside Portfolio, then record minimal evidence here.'
              : 'Clipboard unavailable. Select the draft text and copy it manually; Portfolio still will not send SMS.'}
          </p>
        )}
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
          {warmSmsManualLoopStages.map((stage, index) => (
            <div
              key={stage.state}
              className={`rounded-md border p-2 ${smsLoopStageClasses(
                stage.state === loop.state,
                activeStageIndex >= index && loop.state !== 'suppressed_stop',
                stage.state === 'suppressed_stop' && suppressed,
              )}`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide">{stage.label}</p>
              <p className="mt-1 text-[10px] leading-4">{stage.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-md border border-current/20 bg-background/20 p-2.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide">Manual send evidence</p>
              <p className="mt-1 text-[11px] leading-4">
                Timestamp, channel, and operator note only. No raw SMS body, phone number, screenshot, provider send, or private reply content is required.
              </p>
            </div>
            <span className="inline-flex min-h-7 w-fit shrink-0 items-center gap-1.5 rounded-full border border-current/25 bg-background/25 px-2 py-0.5 text-[10px] font-semibold">
              <ClipboardCheck size={12} aria-hidden />
              Channel: manual SMS
            </span>
          </div>
          <label className="mt-2 block">
            <span className="text-[10px] font-semibold uppercase tracking-wide">Operator note</span>
            <textarea
              value={operatorNote}
              onChange={(event) => {
                setOperatorNote(event.target.value)
                if (evidenceRecorded) {
                  setEvidenceRecorded(false)
                  setEvidenceTimestamp(null)
                }
              }}
              placeholder="Example: Sent manually from phone after reviewing consent basis."
              disabled={!manualSendPrepared || suppressed}
              rows={3}
              className="mt-1 min-h-[78px] w-full resize-y rounded-md border border-current/25 bg-background/25 p-2 text-xs leading-5 outline-none transition-colors placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:ring-2 focus:ring-radiant-gold/25 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
          <button
            type="button"
            disabled={!loop.gates.canRecordEvidence || operatorNote.trim().length === 0}
            onClick={recordManualEvidence}
            className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 text-[11px] font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <CheckCircle2 size={13} aria-hidden />
            Record manual evidence
          </button>
          <p className="mt-2 text-[10px] leading-4 opacity-80">
            Evidence: {loop.evidenceComplete ? `complete at ${evidenceTimestamp}` : loop.missingEvidence.length > 0 ? `missing ${loop.missingEvidence.join(', ')}` : 'ready'}.
          </p>
        </div>

        <div className={`rounded-md border p-2.5 ${
          suppressed
            ? 'border-red-500/30 bg-red-500/10 text-red-100'
            : 'border-current/20 bg-background/20'
        }`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide">Manual response outcome</p>
          <p className="mt-1 text-[11px] leading-4">
            Classify only the non-sensitive result of the manual SMS thread. Stop or wrong-number outcomes suppress future SMS prompts.
          </p>
          <label className="mt-2 block">
            <span className="sr-only">Manual SMS response outcome</span>
            <select
              value={responseOutcome}
              onChange={(event) => setResponseOutcome(event.target.value as WarmSmsManualResponseOutcome)}
              disabled={!manualSendPrepared && !evidenceRecorded}
              className="w-full rounded-md border border-current/25 bg-background/80 p-2 text-xs text-foreground outline-none transition-colors focus:border-radiant-gold/70 focus:ring-2 focus:ring-radiant-gold/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {readiness.operatingLoop.responseOutcomes.map((outcome) => (
                <option key={outcome.outcome} value={outcome.outcome}>{outcome.label}</option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-sm font-semibold">{loop.response.label}</p>
          <p className="mt-1 text-[11px] leading-4">{loop.response.detail}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="inline-flex min-h-7 items-center rounded-full border border-current/20 bg-background/25 px-2 py-1 text-[10px] font-semibold">
              Response: {loop.response.responseReceived ? 'received' : 'expected'}
            </span>
            <span className="inline-flex min-h-7 items-center rounded-full border border-current/20 bg-background/25 px-2 py-1 text-[10px] font-semibold">
              Follow-up draft: {loop.response.followUpDraftNeeded ? 'needed' : 'not needed'}
            </span>
            <span className="inline-flex min-h-7 items-center rounded-full border border-current/20 bg-background/25 px-2 py-1 text-[10px] font-semibold">
              SMS prompts: {suppressed ? 'suppressed' : 'available after review'}
            </span>
          </div>
        </div>
      </div>

      <details className="mt-2 rounded-md border border-current/20 bg-background/20 p-2">
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide">
          SMS drafting aids and boundary
        </summary>
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {[
              'Prior collaborator',
              'Referral / common connection',
              'Community relationship',
              'Dormant lead',
              'Advisor / investor',
              'Follow-up after prior email',
            ].map((label) => (
              <span key={label} className="inline-flex min-h-7 items-center rounded-full border border-current/20 bg-background/25 px-2 py-1 text-[10px] font-semibold">
                {label}
              </span>
            ))}
          </div>
          <ul className="space-y-1">
            {readiness.draft.guidance.map((item) => (
              <li key={item} className="text-[11px] leading-4">{item}</li>
            ))}
          </ul>
          {readiness.recoveryStep && (
            <p className="rounded-md border border-current/20 bg-background/25 p-2 text-[11px] leading-4">
              Recovery: {readiness.recoveryStep}
            </p>
          )}
          <p className="text-[10px] leading-4 opacity-80">
            Boundary: manual only {readiness.executionBoundary.manualOnly ? 'yes' : 'no'} / SMS delivery {readiness.executionBoundary.smsDelivery ? 'enabled' : 'off'} / provider calls {readiness.executionBoundary.smsProviderCalls ? 'enabled' : 'off'}.
          </p>
        </div>
      </details>
    </div>
  )
}

function LocalEvidenceFlag({ visible }: { visible: boolean }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-1 text-xs text-sky-100">
      Local response evidence: {visible ? 'visible' : 'not recorded'}
    </span>
  )
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
        {title}
      </p>
      <ul className="mt-1 space-y-1">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="text-sm leading-5 text-foreground">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function CountPill({ label, count }: { label: string; count: number }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-md border border-silicon-slate bg-silicon-slate/25 px-2 py-1 text-xs text-muted-foreground">
      {label}: {count}
    </span>
  )
}

function ValuePill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-md border border-silicon-slate bg-silicon-slate/25 px-2 py-1 text-xs text-muted-foreground">
      {label}: {value}
    </span>
  )
}

export default function RelationshipPacketPanel({
  gmailDraftCanaryError,
  gmailDraftCanaryLoading,
  gmailDraftCanaryResult,
  loading,
  error,
  data,
  inertSlackApprovalRequest,
  onGmailDraftCanary,
}: RelationshipPacketPanelProps) {
  const readiness = data?.readiness
  const packet = data?.packet
  const smsReadiness = data?.smsReadiness
  const responseMonitoring = data?.responseMonitoring
  const sourceInventory = packet?.sourceInventory
  const hasInventoryEvidence =
    Boolean(sourceInventory) &&
    ((sourceInventory?.sourceStatus.length ?? 0) > 0 ||
      (sourceInventory?.safeToMention.length ?? 0) > 0 ||
      (sourceInventory?.summarizeOnly.length ?? 0) > 0 ||
      (sourceInventory?.doNotMention.length ?? 0) > 0)

  return (
    <section className="lg:col-span-2 rounded-lg border border-silicon-slate/80 bg-background/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Sparkles size={15} className="text-radiant-gold" aria-hidden />
            Relationship packet
          </p>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
            Read-only Portfolio context for warm outreach review. This is relationship evidence,
            not draft copy or send authority.
          </p>
        </div>
        {readiness && (
          <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(readiness.status)}`}>
            {relationshipReadinessLabel(readiness.status)}
          </span>
        )}
      </div>

      {loading && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-silicon-slate bg-silicon-slate/25 p-3 text-sm text-muted-foreground">
          <Database size={14} className="animate-pulse" aria-hidden />
          Loading relationship packet from local Portfolio rows...
        </div>
      )}

      {!loading && error && (
        <div role="alert" className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {!loading && !error && !data && (
        <div className="mt-3 rounded-md border border-silicon-slate bg-silicon-slate/25 p-3 text-sm text-muted-foreground">
          No relationship packet is available for this lead yet.
        </div>
      )}

      {!loading && !error && data && packet && readiness && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="rounded-md border border-silicon-slate/70 bg-silicon-slate/20 p-3">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                Relationship context
              </p>
              <p className="text-sm leading-5 text-foreground">{packet.relationshipBasis}</p>
              {packet.openingPitchGuidance?.openingAngle && (
                <p className="mt-2 text-sm leading-5 text-muted-foreground">
                  Opening angle: {packet.openingPitchGuidance.openingAngle}
                </p>
              )}
              {packet.suggestedNextStep && (
                <p className="mt-2 text-sm leading-5 text-muted-foreground">
                  Next step: {packet.suggestedNextStep}
                </p>
              )}
            </div>

            <div className="rounded-md border border-silicon-slate/70 bg-silicon-slate/20 p-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                Suppression and readiness
              </p>
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2 text-foreground">
                  {readiness.status === 'blocked' ? (
                    <ShieldAlert size={15} className="text-red-300" aria-hidden />
                  ) : (
                    <ShieldCheck size={15} className="text-emerald-300" aria-hidden />
                  )}
                  {relationshipReadinessLabel(readiness.status)}
                </p>
                {packet.suppression.doNotContact || packet.suppression.unsubscribed || packet.suppression.removedAt ? (
                  <p className="text-red-100">
                    Blocked by suppression state: {packet.suppression.suppressionReason ?? 'review required'}.
                  </p>
                ) : (
                  <p className="text-muted-foreground">No DNC, unsubscribe, or removed-state blocker is recorded.</p>
                )}
                <p className="text-muted-foreground">
                  Template: {readiness.recommendedTemplate.replace(/_/g, ' ')}. Selected channel:{' '}
                  {readiness.selectedChannel ? CHANNEL_LABELS[readiness.selectedChannel] : 'none'}.
                </p>
              </div>
            </div>
          </div>

          {(readiness.blockers.length > 0 || readiness.warnings.length > 0) && (
            <div className="grid gap-3 md:grid-cols-2">
              <ListBlock title="Blockers" items={readiness.blockers} />
              <ListBlock title="Review warnings" items={readiness.warnings} />
            </div>
          )}

          <SmsManualOutreachCard readiness={smsReadiness} />

          <div className="rounded-md border border-silicon-slate/70 bg-silicon-slate/20 p-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
              Source and provenance summary
            </p>
            <div className="flex flex-wrap gap-2">
              <CountPill label="Sources" count={packet.sourceRefs.length} />
              <CountPill label="Safe to mention" count={sourceInventory?.safeToMention.length ?? 0} />
              <CountPill label="Summarize only" count={sourceInventory?.summarizeOnly.length ?? 0} />
              <CountPill label="Excluded" count={sourceInventory?.doNotMention.length ?? 0} />
              <CountPill label="Avoid rules" count={packet.avoidContext.length} />
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Private and source-sensitive evidence stays summarized by default. Open the full inventory only when reviewing provenance.
            </p>
          </div>

          {responseMonitoring && (
            <div className="rounded-md border border-silicon-slate/70 bg-silicon-slate/20 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                    Response monitoring
                  </p>
                  <p className="text-sm leading-5 text-foreground">
                    {responseMonitoring.proposedFollowUp.label}
                  </p>
                </div>
                <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${monitoringClasses(responseMonitoring.status)}`}>
                  {responseMonitoring.label}
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <ValuePill label="Mode" value={responseMonitoring.mode.replace(/_/g, ' ')} />
                <CountPill label="Evidence" count={responseMonitoring.evidence.length} />
                <CountPill label="Blocked" count={responseMonitoring.blockedReasons.length} />
              </div>
              <div className="mt-3">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                  Send authority review
                </p>
                <div className="space-y-2">
                  <EmailLifecycleCompact
                    item={responseMonitoring.sendReadiness.modes.warm_1_to_1.find((item) => item.channel === 'email')}
                    canaryError={gmailDraftCanaryError}
                    canaryLoading={gmailDraftCanaryLoading}
                    canaryResult={gmailDraftCanaryResult}
                    inertSlackApprovalRequest={inertSlackApprovalRequest}
                    onRunCanary={onGmailDraftCanary}
                  />
                  <SendAuthorityCompactRow
                    label="Warm one-to-one"
                    items={responseMonitoring.sendReadiness.modes.warm_1_to_1}
                  />
                  <SendAuthorityCompactRow
                    label="Warm one-to-many"
                    items={responseMonitoring.sendReadiness.modes.warm_1_to_many}
                  />
                </div>
              </div>
              <div className="mt-3 rounded-md border border-sky-500/25 bg-sky-500/10 p-3 text-sky-50">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
                      <RefreshCw size={13} aria-hidden />
                      Response capture readiness
                    </p>
                    <p className="mt-1 text-xs leading-5 text-sky-100/90">
                      {responseMonitoring.providerCaptureReadiness.label}
                    </p>
                  </div>
                  <span className="inline-flex min-h-7 w-fit shrink-0 items-center gap-1.5 rounded-full border border-current/25 bg-background/25 px-2 py-0.5 text-[10px] font-semibold">
                    <LockKeyhole size={12} aria-hidden />
                    Polling off
                  </span>
                </div>
                <GmailResponseImportReadinessCard readiness={responseMonitoring.gmailResponseImportReadiness} />
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
                  {responseMonitoring.providerCaptureReadiness.providers.map((provider) => (
                    <div
                      key={provider.provider}
                      className={`rounded-md border p-2 ${providerCaptureClasses(provider.state)}`}
                    >
                      <p className="text-[11px] font-semibold">{provider.label}</p>
                      <p className="mt-1 text-[10px] leading-4">
                        Capture: {provider.manualCaptureEnabled ? 'manual allowed' : 'blocked'} / Provider import: off
                      </p>
                      <p className="mt-1 text-[10px] leading-4 opacity-85">{provider.detail}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-2 grid gap-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                  <div className="rounded-md border border-current/20 bg-background/20 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide">Supported classifications</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {responseMonitoring.providerCaptureReadiness.supportedClassifications.map((item) => (
                        <span
                          key={item.key}
                          className="inline-flex min-h-7 items-center rounded-full border border-current/20 bg-background/25 px-2 py-1 text-[10px] font-semibold"
                        >
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border border-current/20 bg-background/20 p-2 text-[10px] leading-4">
                    <p className="font-semibold uppercase tracking-wide">{responseMonitoring.providerCaptureReadiness.slackAlertReadiness.label}</p>
                    <p className="mt-1">{responseMonitoring.providerCaptureReadiness.slackAlertReadiness.detail}</p>
                    <p className="mt-1 break-all">
                      Deep link: {responseMonitoring.providerCaptureReadiness.slackAlertReadiness.route}. Slack dispatch: off.
                    </p>
                  </div>
                </div>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                  {responseMonitoring.operatorDecisionPaths.map((path) => (
                    <div
                      key={path.key}
                      className={`rounded-md border p-2 ${operatorDecisionClasses(path.state)}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold">{path.label}</p>
                        <span className="rounded-full border border-current/20 px-2 py-0.5 text-[10px] font-semibold">
                          {path.state.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] leading-4">{path.description}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 break-all text-[10px] leading-4 text-sky-100/80">
                  Capture key: {responseMonitoring.providerCaptureReadiness.responseCaptureKey}
                </p>
              </div>
              <details className="mt-3 rounded-md border border-silicon-slate/70 bg-background/25">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
                  Monitoring evidence and send gate details
                </summary>
                <div className="space-y-3 border-t border-silicon-slate/70 p-3">
                  <p className="text-xs leading-5 text-muted-foreground">
                    {responseMonitoring.proposedFollowUp.description}
                  </p>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="space-y-2 text-xs leading-5 text-muted-foreground">
                      <p>Latest outbound: {responseMonitoring.latestOutboundAt ?? 'none recorded'}</p>
                      <p>Latest response: {responseMonitoring.latestResponseAt ?? 'none recorded'}</p>
                      <p>Expected reply by: {responseMonitoring.expectedReplyBy ?? 'not set'}</p>
                      <p className="break-all">Recipient key: {responseMonitoring.perRecipientIdempotencyKey}</p>
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                        Evidence
                      </p>
                      {responseMonitoring.evidence.length > 0 ? (
                        <ul className="space-y-1">
                          {responseMonitoring.evidence.slice(0, 4).map((item) => (
                            <li key={`${item.sourceType}-${item.sourceId}`} className="text-xs leading-5 text-muted-foreground">
                              {item.sourceType}: {item.evidenceType.replace(/_/g, ' ')}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs leading-5 text-muted-foreground">
                          No reply evidence is recorded yet. Manual import remains the only enabled monitoring action.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      ...responseMonitoring.sendReadiness.modes.warm_1_to_1,
                      ...responseMonitoring.sendReadiness.modes.warm_1_to_many,
                    ].map((item) => (
                      <SendAuthorityDetailCard key={`${item.mode}-${item.channel}`} item={item} />
                    ))}
                  </div>
                </div>
              </details>
            </div>
          )}

          {!hasInventoryEvidence && packet.sourceRefs.length === 0 && (
            <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-100">
              No relationship evidence is available yet. Keep this lead in review until Portfolio-local context is added.
            </div>
          )}

          <details className="rounded-md border border-silicon-slate/70 bg-silicon-slate/20">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
              Full source inventory and review lists
            </summary>
            <div className="space-y-4 border-t border-silicon-slate/70 p-3">
              <div className="grid gap-3 md:grid-cols-2">
                <ListBlock title="Relationship signals" items={packet.relationshipSignals} />
                <ListBlock title="Commonality cues" items={packet.commonalities} />
                <ListBlock title="Safe to mention" items={sourceInventory?.safeToMention ?? []} />
                <ListBlock title="Summarize only" items={sourceInventory?.summarizeOnly ?? []} />
                <ListBlock title="Do not mention" items={sourceInventory?.doNotMention ?? []} />
                <ListBlock title="Avoid in draft context" items={packet.avoidContext} />
              </div>

              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                  Source details
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  {packet.sourceRefs.map((source) => (
                    <div key={`${source.sourceType}-${source.sourceId ?? source.summary}`} className="rounded-md border border-silicon-slate/70 bg-background/30 p-3">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-background/70 px-2 py-0.5 text-[11px] capitalize text-foreground">
                          {sourceLabel(source.sourceType)}
                        </span>
                        {source.privateSource && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-100">
                            <LockKeyhole size={11} aria-hidden />
                            private summary
                          </span>
                        )}
                        {source.mentionSafety && (
                          <span className="rounded-full border border-silicon-slate px-2 py-0.5 text-[11px] text-muted-foreground">
                            {source.sourceStatus ?? 'present'} / {source.mentionSafety.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-5 text-muted-foreground">{source.summary}</p>
                    </div>
                  ))}
                </div>
              </div>

              {sourceInventory?.sourceStatus.length ? (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                    Inventory coverage
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sourceInventory.sourceStatus.map((source) => (
                      <span key={`${source.sourceType}-${source.status}`} className="inline-flex min-h-7 items-center rounded-md border border-silicon-slate bg-silicon-slate/25 px-2 py-1 text-xs text-muted-foreground">
                        {sourceLabel(source.sourceType)}: {source.status}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </details>

          <details className="rounded-md border border-silicon-slate/70 bg-silicon-slate/20">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
              Channel capability and execution boundary
            </summary>
            <div className="space-y-3 border-t border-silicon-slate/70 p-3">
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                  Channel capability state
                </p>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {(['email', 'linkedin', 'facebook', 'phone_contact'] as WarmOutreachChannel[]).map((channel) => {
                    const capability = packet.channelCapabilities[channel]
                    const Icon = CHANNEL_ICONS[channel]
                    return (
                      <div key={channel} className={`rounded-md border p-3 ${capabilityClasses(capability)}`}>
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <Icon size={14} aria-hidden />
                          {CHANNEL_LABELS[channel]}
                        </p>
                        <p className="mt-1 text-xs">{describeChannelCapability(capability)}</p>
                        {capability?.reason && (
                          <p className="mt-1 text-xs opacity-85">{capability.reason}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                  <FileText size={13} aria-hidden />
                  Execution boundary
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex min-h-7 items-center rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100">
                    Read-only local rows
                  </span>
                  <BoundaryFlag active={data.executionBoundary.providerCalls} label="Provider calls" />
                  <BoundaryFlag active={data.executionBoundary.createsDraft} label="Draft creation" />
                  <BoundaryFlag active={data.executionBoundary.externalSend} label="External send" />
                  <BoundaryFlag active={data.executionBoundary.n8nDispatch} label="n8n dispatch" />
                  <BoundaryFlag active={data.executionBoundary.slackAction} label="Slack action" />
                  <BoundaryFlag active={data.executionBoundary.responseMonitoring} label="Provider monitoring" />
                  {responseMonitoring && (
                    <>
                      <BoundaryFlag active={responseMonitoring.executionBoundary.externalMonitoringEnabled} label="External monitoring" />
                      <LocalEvidenceFlag visible={responseMonitoring.evidence.length > 0} />
                    </>
                  )}
                </div>
                <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-200" aria-hidden />
                  Email and LinkedIn can inform internal drafts only. Facebook and phone remain manual review channels when present.
                </p>
              </div>
            </div>
          </details>

          {readiness.status === 'draft_ready' && (
            <p className="flex items-start gap-2 text-xs leading-5 text-emerald-100">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" aria-hidden />
              Ready means the operator has enough local context to review an internal draft. It does not authorize external outreach.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
