'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileText,
  LockKeyhole,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
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
  WarmOutreachGmailProviderActivationReadiness,
  WarmOutreachRealRecipientGmailRolloutReadiness,
  WarmOutreachResponseMonitoring,
} from '@/lib/warm-outreach-response-monitoring'

type SendReadinessItem =
  WarmOutreachResponseMonitoring['sendReadiness']['modes']['warm_1_to_1'][number]

type ChannelCapability = NonNullable<
  WarmOutreachRelationshipPacket['channelCapabilities'][WarmOutreachChannel]
>

export interface RelationshipPacketApiResponse {
  packet: WarmOutreachRelationshipPacket
  readiness: WarmOutreachReadiness
  contextSummary: WarmOutreachContextSummary
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
  if (state === 'ready_for_send_request') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
  if (state === 'authorization_recorded_execution_blocked') return 'border-sky-500/30 bg-sky-500/10 text-sky-100'
  if (state === 'already_sent') return 'border-silicon-slate bg-silicon-slate/25 text-muted-foreground'
  return 'border-red-500/30 bg-red-500/10 text-red-100'
}

function rolloutRequirementClasses(state: string) {
  if (state === 'tracked' || state === 'matched' || state === 'clear' || state === 'configured') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
  }
  if (state === 'approved') return 'border-sky-500/25 bg-sky-500/10 text-sky-100'
  if (state === 'missing') return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
  return 'border-red-500/25 bg-red-500/10 text-red-100'
}

function RealRecipientRolloutCard({
  readiness,
}: {
  readiness?: WarmOutreachRealRecipientGmailRolloutReadiness | null
}) {
  if (!readiness) return null

  const requirements = [
    ['Draft', readiness.requirements.draftEvidence.state],
    ['Sender', readiness.requirements.senderMatch.state],
    ['Suppression', readiness.requirements.suppression.state],
    ['Provider', readiness.requirements.provider.state],
    ['Authorization', readiness.requirements.authorization.state],
    ['Submitted evidence', readiness.requirements.submittedEvidence.state],
  ] as const
  const primaryDetail =
    readiness.blockers[0] ??
    (readiness.state === 'ready_for_send_request'
      ? readiness.requirements.authorization.detail
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
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {requirements.map(([label, state]) => (
          <span
            key={label}
            className={`rounded-md border p-2 text-[10px] leading-4 ${rolloutRequirementClasses(state)}`}
          >
            {label}: {state.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
      <div className="mt-2 grid gap-1.5 text-[10px] leading-4 text-current/85 sm:grid-cols-2">
        <p className="break-words">
          Slack payload: {readiness.slackApprovalContract.route}. Dispatch off.
        </p>
        <p className="break-words">
          Dedupe: {readiness.slackApprovalContract.payloadDedupeKey}
        </p>
        <p>
          Approval records intent only. Gmail send: off.
        </p>
        <p>
          Exact execution still needs per-recipient authorization and captain flag.
        </p>
      </div>
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
  item,
  onRunCanary,
}: {
  canaryError?: string | null
  canaryLoading?: boolean
  canaryResult?: RelationshipPacketPanelProps['gmailDraftCanaryResult']
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
    <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-2.5 text-amber-50">
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
  onGmailDraftCanary,
}: RelationshipPacketPanelProps) {
  const readiness = data?.readiness
  const packet = data?.packet
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
