import type { WarmSmsProviderReadiness } from './warm-outreach-sms-provider-readiness'
import {
  parseWarmSmsProviderTransportConfig,
  type WarmSmsProviderTransportConfigInput,
} from './warm-outreach-sms-provider-readiness'

export const WARM_SMS_SEND_AUTHORIZATION =
  'execute_warm_sms_send_for_authorized_recipient'

export type WarmSmsStoredSendApproval = {
  status?: string | null
  send_authorization?: string | null
  sendAuthorization?: string | null
  contact_submission_id?: string | number | null
  outreach_queue_id?: string | null
  channel?: string | null
  provider?: string | null
  message_version_key?: string | null
  sms_send_idempotency_key?: string | null
  idempotency_key?: string | null
  submitted_evidence_key?: string | null
  approval_intent_recorded?: boolean | null
  external_send_authorization_intent?: boolean | null
  no_send_canary_passed?: boolean | null
  telnyx_api_called?: boolean | null
  external_send_performed?: boolean | null
  approved_at?: string | null
}

export type WarmSmsExistingSendAttempt = {
  status?: string | null
  idempotencyKey?: string | null
  submittedEvidenceKey?: string | null
  providerMessageId?: string | null
}

export type WarmSmsTelnyxLiveSendReadiness = {
  version: 'warm-outreach-sms-telnyx-live-send-readiness/v1'
  state:
    | 'env_disabled'
    | 'credential_missing'
    | 'sender_profile_missing'
    | 'consent_or_suppression_blocked'
    | 'provider_capability_blocked'
    | 'duplicate_idempotency_blocked'
    | 'per_recipient_approval_required'
    | 'ready_for_live_one_recipient_execution'
  label: string
  sequence: Array<{
    key:
      | 'no_send_canary_passed'
      | 'credential_provider_smoke'
      | 'per_recipient_send_approval'
      | 'live_one_recipient_sms_execution'
    label: string
    status: 'passed' | 'available' | 'required' | 'blocked'
    detail: string
  }>
  expectedAuthorization: {
    route: '/api/admin/outreach/leads/[id]/sms-telnyx-live-send'
    method: 'POST'
    sendAuthorization: typeof WARM_SMS_SEND_AUTHORIZATION
    approvalMustMatch: [
      'contact_id',
      'outreach_queue_id',
      'channel_sms',
      'message_version',
      'idempotency_key',
      'submitted_evidence_key',
    ]
    contactId: string | null
    outreachQueueId: string | null
    messageVersionKey: string
    idempotencyKey: string
    submittedEvidenceKey: string
  }
  providerSmoke: {
    provider: 'telnyx_messaging'
    available: boolean
    credentialReferenceRecorded: boolean
    runtimeCredentialAvailable: boolean
    senderReferenceRecorded: boolean
    capabilityVerified: boolean
    selectedProviderVerified: boolean
    rawCredentialsReturned: false
    rawSenderReturned: false
  }
  blockedReasons: string[]
  recoveryStates: Array<{
    key:
      | 'missing_1password_credentials'
      | 'missing_sender_profile'
      | 'disabled_env_flag'
      | 'consent_suppression_failure'
      | 'duplicate_idempotency_key'
      | 'absent_per_recipient_approval'
    label: string
    blocked: boolean
    recovery: string
  }>
  executionBoundary: {
    featureFlag: 'ENABLE_WARM_SMS_PROVIDER_EXECUTION'
    featureFlagEnabled: boolean
    genericProceedAccepted: false
    providerCapabilityVerified: boolean
    providerCallsEnabled: boolean
    smsDeliveryEnabled: boolean
    telnyxApiCallable: boolean
    externalRequests: []
    rawPhoneReturned: false
    rawMessageBodyReturned: false
    rawCredentialsReturned: false
  }
}

export type WarmSmsTelnyxSendInput = {
  toPhone: string
  fromPhone: string
  messageBody: string
  idempotencyKey: string
}

export type WarmSmsTelnyxSendResult =
  | {
      ok: true
      providerMessageId: string
      deliveryStatus: 'accepted'
    }
  | {
      ok: false
      error: string
      deliveryStatus: 'failed'
    }

export type WarmSmsTelnyxSender = (
  input: WarmSmsTelnyxSendInput,
) => Promise<WarmSmsTelnyxSendResult>

let testSender: WarmSmsTelnyxSender | null = null

export function setWarmSmsTelnyxSenderForTesting(sender: WarmSmsTelnyxSender | null) {
  testSender = sender
}

export function isWarmSmsTelnyxRuntimeCredentialReady(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(
    env.WARM_SMS_TELNYX_RUNTIME_CREDENTIAL_READY === 'true' ||
      env.TELNYX_API_KEY ||
      env.TELNYX_MESSAGING_API_KEY,
  )
}

function clean(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || null
}

function enabled(value: boolean | string | null | undefined) {
  if (typeof value === 'boolean') return value
  return /^(1|true|yes|on|enabled)$/i.test(value ?? '')
}

function approvalMatches(input: {
  approval: WarmSmsStoredSendApproval | null
  contactId: string | null
  outreachQueueId: string | null
  messageVersionKey: string
  idempotencyKey: string
  submittedEvidenceKey: string
}) {
  const approval = input.approval
  if (!approval) return false
  const authorization =
    clean(approval.send_authorization) ?? clean(approval.sendAuthorization)
  const idempotency =
    clean(approval.sms_send_idempotency_key) ?? clean(approval.idempotency_key)
  return (
    clean(approval.status)?.toLowerCase() === 'approved' &&
    authorization === WARM_SMS_SEND_AUTHORIZATION &&
    String(approval.contact_submission_id ?? '') === String(input.contactId ?? '') &&
    clean(approval.outreach_queue_id) === input.outreachQueueId &&
    clean(approval.channel) === 'sms' &&
    clean(approval.provider) === 'telnyx_messaging' &&
    clean(approval.message_version_key) === input.messageVersionKey &&
    idempotency === input.idempotencyKey &&
    clean(approval.submitted_evidence_key) === input.submittedEvidenceKey &&
    approval.approval_intent_recorded === true &&
    approval.external_send_authorization_intent === true &&
    approval.telnyx_api_called === false &&
    approval.external_send_performed === false
  )
}

function attemptMatches(attempt: WarmSmsExistingSendAttempt | null, input: {
  idempotencyKey: string
  submittedEvidenceKey: string
}) {
  if (!attempt) return false
  if (clean(attempt.status)?.toLowerCase() === 'eligible_for_execution') return false
  return (
    clean(attempt.idempotencyKey) === input.idempotencyKey ||
    clean(attempt.submittedEvidenceKey) === input.submittedEvidenceKey
  )
}

export function buildWarmSmsTelnyxLiveSendReadiness(input: {
  providerReadiness: WarmSmsProviderReadiness
  transportConfig?: WarmSmsProviderTransportConfigInput
  contactId?: string | number | null
  outreachQueueId?: string | null
  messageVersionKey?: string | null
  idempotencyKey?: string | null
  submittedEvidenceKey?: string | null
  executionFlagEnabled?: boolean
  runtimeCredentialReady?: boolean
  approval?: WarmSmsStoredSendApproval | null
  existingAttempt?: WarmSmsExistingSendAttempt | null
  noSendCanaryPassed?: boolean
}): WarmSmsTelnyxLiveSendReadiness {
  const transport = parseWarmSmsProviderTransportConfig(input.transportConfig)
  const messageVersionKey =
    clean(input.messageVersionKey) ?? transport.messageVersionKey
  const idempotencyKey =
    clean(input.idempotencyKey) ??
    `${transport.idempotencyNamespace}:telnyx:live:${input.contactId ?? 'pending'}:${messageVersionKey}`
  const submittedEvidenceKey =
    clean(input.submittedEvidenceKey) ??
    `${transport.auditKey}:telnyx:submitted:${input.contactId ?? 'pending'}:${messageVersionKey}`
  const executionFlagEnabled =
    input.executionFlagEnabled ?? transport.executionFlagEnabled
  const runtimeCredentialReady = input.runtimeCredentialReady ?? false
  const credentialReady =
    transport.credentialReferenceRecorded && runtimeCredentialReady
  const senderReady = transport.senderReferenceRecorded
  const consentClear =
    input.providerReadiness.consentAndSuppression.status === 'clear' &&
    input.providerReadiness.consentAndSuppression.blockers.length === 0
  const capabilityVerified =
    input.providerReadiness.transportReadiness.capabilityReadiness.status === 'ready'
  const selectedProviderVerified =
    transport.selectedProvider.key === 'telnyx_messaging' &&
    input.providerReadiness.transportReadiness.selectedProvider.key === 'telnyx_messaging'
  const duplicate =
    attemptMatches(input.existingAttempt ?? null, {
      idempotencyKey,
      submittedEvidenceKey,
    }) ||
    ['sent', 'sending', 'submitted', 'accepted'].includes(
      clean(input.existingAttempt?.status)?.toLowerCase() ?? '',
    )
  const approved = approvalMatches({
    approval: input.approval ?? null,
    contactId: input.contactId == null ? null : String(input.contactId),
    outreachQueueId: input.outreachQueueId ?? null,
    messageVersionKey,
    idempotencyKey,
    submittedEvidenceKey,
  })
  const noSendCanaryPassed =
    input.noSendCanaryPassed ??
    input.providerReadiness.noSendCanary.state === 'ready_no_send_simulation'
  const providerSmokeAvailable =
    noSendCanaryPassed &&
    selectedProviderVerified &&
    credentialReady &&
    senderReady &&
    capabilityVerified

  const recoveryStates: WarmSmsTelnyxLiveSendReadiness['recoveryStates'] = [
    {
      key: 'missing_1password_credentials',
      label: 'Missing 1Password credential',
      blocked: !credentialReady,
      recovery:
        'Confirm the Telnyx credential is available through the approved secret path. Do not paste or expose the raw credential in Portfolio.',
    },
    {
      key: 'missing_sender_profile',
      label: 'Missing sender/profile',
      blocked: !senderReady,
      recovery:
        'Record the approved Telnyx sender or messaging-profile reference before any provider attempt.',
    },
    {
      key: 'disabled_env_flag',
      label: 'Execution flag disabled',
      blocked: !executionFlagEnabled,
      recovery:
        'ENABLE_WARM_SMS_PROVIDER_EXECUTION must be explicitly enabled by the captain only after provider activation approval.',
    },
    {
      key: 'consent_suppression_failure',
      label: 'Consent or suppression failure',
      blocked: !consentClear,
      recovery:
        input.providerReadiness.consentAndSuppression.blockers[0] ??
        'Resolve consent, phone provenance, cooldown, suppression, and audit evidence first.',
    },
    {
      key: 'duplicate_idempotency_key',
      label: 'Duplicate idempotency key',
      blocked: duplicate,
      recovery:
        'Return existing attempt evidence and do not send again for this contact, message version, or submitted evidence key.',
    },
    {
      key: 'absent_per_recipient_approval',
      label: 'Absent per-recipient approval',
      blocked: !approved,
      recovery:
        'Record current approval evidence for this exact contact, queue row, SMS channel, message version, idempotency key, and submitted evidence key.',
    },
  ]
  const blockedReasons = recoveryStates
    .filter((state) => state.blocked)
    .map((state) => state.recovery)
  if (!selectedProviderVerified) {
    blockedReasons.unshift('Telnyx must be the selected and verified SMS provider.')
  }
  if (!capabilityVerified) {
    blockedReasons.unshift('Telnyx provider capability verification is incomplete.')
  }
  if (!noSendCanaryPassed) {
    blockedReasons.unshift('The Telnyx no-send canary must pass before live-send readiness.')
  }

  let state: WarmSmsTelnyxLiveSendReadiness['state'] = 'ready_for_live_one_recipient_execution'
  if (!executionFlagEnabled) {
    state = 'env_disabled'
  } else if (!credentialReady) {
    state = 'credential_missing'
  } else if (!senderReady) {
    state = 'sender_profile_missing'
  } else if (!consentClear) {
    state = 'consent_or_suppression_blocked'
  } else if (!capabilityVerified || !selectedProviderVerified || !noSendCanaryPassed) {
    state = 'provider_capability_blocked'
  } else if (duplicate) {
    state = 'duplicate_idempotency_blocked'
  } else if (!approved) {
    state = 'per_recipient_approval_required'
  }

  const labels: Record<WarmSmsTelnyxLiveSendReadiness['state'], string> = {
    env_disabled: 'Live SMS execution blocked by default',
    credential_missing: 'Telnyx credential unavailable',
    sender_profile_missing: 'Telnyx sender/profile unavailable',
    consent_or_suppression_blocked: 'Recipient SMS safety checks blocked',
    provider_capability_blocked: 'Telnyx provider smoke not ready',
    duplicate_idempotency_blocked: 'Duplicate SMS send prevented',
    per_recipient_approval_required: 'Per-recipient SMS approval required',
    ready_for_live_one_recipient_execution: 'Ready for gated one-recipient Telnyx execution',
  }

  return {
    version: 'warm-outreach-sms-telnyx-live-send-readiness/v1',
    state,
    label: labels[state],
    sequence: [
      {
        key: 'no_send_canary_passed',
        label: 'No-send canary passed',
        status: noSendCanaryPassed ? 'passed' : 'blocked',
        detail:
          'The no-send canary must prove routing with externalRequests: [] before any provider call can be considered.',
      },
      {
        key: 'credential_provider_smoke',
        label: 'Credential/provider smoke available',
        status: providerSmokeAvailable ? 'available' : 'blocked',
        detail:
          'Credential reference, runtime secret availability, sender/profile, Telnyx selection, and capability evidence must all be present.',
      },
      {
        key: 'per_recipient_send_approval',
        label: 'Explicit per-recipient send approval',
        status: approved ? 'passed' : 'required',
        detail:
          'Approval must match the exact contact, queue row, SMS channel, message version, idempotency key, and submitted evidence key.',
      },
      {
        key: 'live_one_recipient_sms_execution',
        label: 'Live one-recipient SMS execution',
        status: state === 'ready_for_live_one_recipient_execution' ? 'available' : 'blocked',
        detail:
          'The route may call Telnyx only after all prior gates pass and the execution flag is enabled.',
      },
    ],
    expectedAuthorization: {
      route: '/api/admin/outreach/leads/[id]/sms-telnyx-live-send',
      method: 'POST',
      sendAuthorization: WARM_SMS_SEND_AUTHORIZATION,
      approvalMustMatch: [
        'contact_id',
        'outreach_queue_id',
        'channel_sms',
        'message_version',
        'idempotency_key',
        'submitted_evidence_key',
      ],
      contactId: input.contactId == null ? null : String(input.contactId),
      outreachQueueId: input.outreachQueueId ?? null,
      messageVersionKey,
      idempotencyKey,
      submittedEvidenceKey,
    },
    providerSmoke: {
      provider: 'telnyx_messaging',
      available: providerSmokeAvailable,
      credentialReferenceRecorded: transport.credentialReferenceRecorded,
      runtimeCredentialAvailable: runtimeCredentialReady,
      senderReferenceRecorded: senderReady,
      capabilityVerified,
      selectedProviderVerified,
      rawCredentialsReturned: false,
      rawSenderReturned: false,
    },
    blockedReasons,
    recoveryStates,
    executionBoundary: {
      featureFlag: 'ENABLE_WARM_SMS_PROVIDER_EXECUTION',
      featureFlagEnabled: executionFlagEnabled,
      genericProceedAccepted: false,
      providerCapabilityVerified: capabilityVerified,
      providerCallsEnabled: state === 'ready_for_live_one_recipient_execution',
      smsDeliveryEnabled: state === 'ready_for_live_one_recipient_execution',
      telnyxApiCallable: state === 'ready_for_live_one_recipient_execution',
      externalRequests: [],
      rawPhoneReturned: false,
      rawMessageBodyReturned: false,
      rawCredentialsReturned: false,
    },
  }
}

export async function sendWarmSmsViaTelnyx(
  input: WarmSmsTelnyxSendInput,
): Promise<WarmSmsTelnyxSendResult> {
  if (testSender) return testSender(input)

  if (process.env.ENABLE_WARM_SMS_PROVIDER_EXECUTION !== 'true') {
    return {
      ok: false,
      error: 'Warm SMS provider execution is disabled.',
      deliveryStatus: 'failed',
    }
  }

  const apiKey = process.env.TELNYX_API_KEY ?? process.env.TELNYX_MESSAGING_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      error: 'Telnyx runtime credential is missing.',
      deliveryStatus: 'failed',
    }
  }

  try {
    const response = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        from: input.fromPhone,
        to: input.toPhone,
        text: input.messageBody,
      }),
    })
    const body = await response.json().catch(() => ({})) as { data?: { id?: string } }
    if (!response.ok || !body.data?.id) {
      return {
        ok: false,
        error: 'Telnyx rejected the authorized SMS request.',
        deliveryStatus: 'failed',
      }
    }
    return {
      ok: true,
      providerMessageId: body.data.id,
      deliveryStatus: 'accepted',
    }
  } catch {
    return {
      ok: false,
      error: 'Telnyx SMS request failed before delivery acceptance.',
      deliveryStatus: 'failed',
    }
  }
}
