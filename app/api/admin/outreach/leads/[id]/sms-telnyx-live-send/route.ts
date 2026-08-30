import { NextRequest, NextResponse } from 'next/server'

import { GET as getRelationshipPacket } from '../relationship-packet/route'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { logCommunication } from '@/lib/communications'
import { supabaseAdmin } from '@/lib/supabase'
import {
  WARM_SMS_SEND_AUTHORIZATION,
  buildWarmSmsTelnyxLiveSendReadiness,
  isWarmSmsTelnyxRuntimeCredentialReady,
  sendWarmSmsViaTelnyx,
  type WarmSmsExistingSendAttempt,
  type WarmSmsStoredSendApproval,
} from '@/lib/warm-outreach-sms-live-execution'
import {
  buildWarmSmsProviderReadiness,
  type WarmSmsProviderCapabilityKey,
  type WarmSmsProviderTransportConfigInput,
} from '@/lib/warm-outreach-sms-provider-readiness'
import type { WarmSmsReadiness } from '@/lib/warm-outreach-sms-readiness'

export const dynamic = 'force-dynamic'

type MetadataRecord = Record<string, unknown>

type RequestBody = {
  executeSmsSend?: boolean
  dryRun?: boolean
  sendAuthorization?: string
  contactSubmissionId?: string | number
  outreachQueueId?: string
  messageVersionKey?: string
  idempotencyKey?: string
  submittedEvidenceKey?: string
  channel?: string
  provider?: string
}

type QueueRow = {
  id: string
  contact_submission_id: number
  status: string | null
  channel: string | null
  subject: string | null
  body: string | null
  thread_id: string | null
  message_id: string | null
  sent_at?: string | null
  generation_inputs: MetadataRecord | null
  contact_submissions:
    | {
        id: number
        name: string | null
        phone_number: string | null
        outreach_status?: string | null
        do_not_contact?: boolean | null
        removed_at?: string | null
      }
    | null
}

type RelationshipPacketBody = {
  error?: string
  smsReadiness?: WarmSmsReadiness
}

const SMS_ENV_KEYS = [
  'SMS_PROVIDER_ADAPTER',
  'SMS_PROVIDER_CREDENTIAL_REFERENCE',
  'SMS_PROVIDER_SENDER_REFERENCE',
  'SMS_PROVIDER_DELIVERY_CALLBACK',
  'SMS_PROVIDER_OPT_OUT_CALLBACK',
  'WARM_SMS_MESSAGE_VERSION_KEY',
  'WARM_SMS_IDEMPOTENCY_NAMESPACE',
  'WARM_SMS_AUDIT_KEY',
  'WARM_SMS_DELIVERY_CONFIRMATION_STORE',
  'ENABLE_WARM_SMS_PROVIDER_EXECUTION',
  'SMS_PROVIDER_UNAVAILABLE_REASON',
] as const

const LIVE_SEND_CAPABILITY_KEYS: WarmSmsProviderCapabilityKey[] = [
  'outbound_message_submission',
  'delivery_status_callbacks',
  'inbound_opt_out_ingestion',
  'sender_identity_compliance',
  'idempotent_submission',
  'sandbox_or_no_send_test',
]

function metadataRecord(value: unknown): MetadataRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as MetadataRecord
    : {}
}

function stringValue(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || null
}

function parseBody(raw: unknown): RequestBody {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const value = raw as Record<string, unknown>
  return {
    executeSmsSend: value.executeSmsSend === true,
    dryRun: value.dryRun === true,
    sendAuthorization:
      typeof value.sendAuthorization === 'string' ? value.sendAuthorization : undefined,
    contactSubmissionId:
      typeof value.contactSubmissionId === 'string' ||
      typeof value.contactSubmissionId === 'number'
        ? value.contactSubmissionId
        : undefined,
    outreachQueueId:
      typeof value.outreachQueueId === 'string' ? value.outreachQueueId : undefined,
    messageVersionKey:
      typeof value.messageVersionKey === 'string' ? value.messageVersionKey : undefined,
    idempotencyKey:
      typeof value.idempotencyKey === 'string' ? value.idempotencyKey : undefined,
    submittedEvidenceKey:
      typeof value.submittedEvidenceKey === 'string' ? value.submittedEvidenceKey : undefined,
    channel: typeof value.channel === 'string' ? value.channel : undefined,
    provider: typeof value.provider === 'string' ? value.provider : undefined,
  }
}

function smsTransportConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): WarmSmsProviderTransportConfigInput {
  return SMS_ENV_KEYS.reduce<WarmSmsProviderTransportConfigInput>((config, key) => {
    const value = env[key]
    if (value != null) config[key] = value
    return config
  }, {})
}

function executionEnabled() {
  return process.env.ENABLE_WARM_SMS_PROVIDER_EXECUTION === 'true'
}

function redactedBoundary(enabled = false) {
  return {
    providerCallsEnabled: enabled,
    smsDeliveryEnabled: enabled,
    externalSendEnabled: enabled,
    telnyxApiCalled: enabled,
    genericProceedAccepted: false,
    rawPhoneReturned: false,
    rawMessageBodyReturned: false,
    rawCredentialsReturned: false,
    slackDispatchEnabled: false,
    gmailActionEnabled: false,
    n8nDispatchEnabled: false,
    environmentVariablesChanged: false,
    secretManagerMutated: false,
  }
}

function blockedResponse(input: {
  message: string
  blockers: string[]
  status?: number
  readiness?: ReturnType<typeof buildWarmSmsTelnyxLiveSendReadiness>
}) {
  return NextResponse.json(
    {
      version: 'warm-outreach-sms-telnyx-live-send/v1',
      status: 'blocked_no_send',
      message: input.message,
      blockers: input.blockers,
      telnyxApiCalled: false,
      externalSendPerformed: false,
      executionBoundary: redactedBoundary(false),
      liveSendReadiness: input.readiness,
    },
    { status: input.status ?? 409 },
  )
}

function duplicateResponse(input: {
  message: string
  readiness: ReturnType<typeof buildWarmSmsTelnyxLiveSendReadiness>
  evidence: WarmSmsExistingSendAttempt
}) {
  return NextResponse.json({
    version: 'warm-outreach-sms-telnyx-live-send/v1',
    status: 'duplicate_prevented',
    message: input.message,
    duplicatePrevented: true,
    telnyxApiCalled: false,
    externalSendPerformed: false,
    sentEvidence: {
      status: input.evidence.status ?? null,
      providerMessageId: input.evidence.providerMessageId ?? null,
      idempotencyKey: input.evidence.idempotencyKey ?? null,
      submittedEvidenceKey: input.evidence.submittedEvidenceKey ?? null,
    },
    executionBoundary: redactedBoundary(false),
    liveSendReadiness: input.readiness,
  })
}

function preparedResponse(input: {
  message: string
  readiness: ReturnType<typeof buildWarmSmsTelnyxLiveSendReadiness>
  evidence: MetadataRecord
  duplicatePrevented: boolean
}) {
  return NextResponse.json({
    version: 'warm-outreach-sms-telnyx-live-send/v1',
    status: 'eligible_for_execution',
    message: input.message,
    duplicatePrevented: input.duplicatePrevented,
    telnyxApiCalled: false,
    externalSendPerformed: false,
    preparedExecutionEvidence: input.evidence,
    executionBoundary: redactedBoundary(false),
    liveSendReadiness: input.readiness,
  })
}

function approvalEvidence(generationInputs: MetadataRecord): WarmSmsStoredSendApproval | null {
  const evidence = metadataRecord(generationInputs.warm_sms_send_authorization)
  return Object.keys(evidence).length > 0 ? evidence as WarmSmsStoredSendApproval : null
}

function executionEvidence(generationInputs: MetadataRecord): WarmSmsExistingSendAttempt | null {
  const evidence = metadataRecord(generationInputs.warm_sms_telnyx_execution)
  if (Object.keys(evidence).length === 0) return null
  return {
    status: stringValue(evidence.status),
    idempotencyKey: stringValue(evidence.idempotency_key),
    submittedEvidenceKey: stringValue(evidence.submitted_evidence_key),
    providerMessageId: stringValue(evidence.provider_message_id),
  }
}

function noSendCanaryPassed(generationInputs: MetadataRecord, approval: WarmSmsStoredSendApproval | null) {
  const noSendCanary =
    metadataRecord(generationInputs.warm_sms_telnyx_no_send_canary)
  const noSendCanaryStatus = stringValue(noSendCanary.status)
  return (
    approval?.no_send_canary_passed === true ||
    noSendCanaryStatus === 'passed_no_send' ||
    process.env.WARM_SMS_TELNYX_NO_SEND_CANARY_PASSED === 'true'
  )
}

function existingAttemptFromRows(rows: MetadataRecord[], input: {
  idempotencyKey: string
  submittedEvidenceKey: string
}): WarmSmsExistingSendAttempt | null {
  for (const row of rows) {
    const metadata = metadataRecord(row.metadata)
    const execution = metadataRecord(metadata.warm_sms_telnyx_execution)
    const idempotencyKey =
      stringValue(metadata.sms_send_idempotency_key) ??
      stringValue(execution.idempotency_key)
    const submittedEvidenceKey =
      stringValue(metadata.submitted_evidence_key) ??
      stringValue(execution.submitted_evidence_key)
    if (
      idempotencyKey === input.idempotencyKey ||
      submittedEvidenceKey === input.submittedEvidenceKey
    ) {
      return {
        status: stringValue(row.status),
        idempotencyKey,
        submittedEvidenceKey,
        providerMessageId: stringValue(metadata.telnyx_message_id) ??
          stringValue(execution.provider_message_id),
      }
    }
  }
  return null
}

function requestAuthorizationErrors(input: {
  body: RequestBody
  expected: ReturnType<typeof buildWarmSmsTelnyxLiveSendReadiness>['expectedAuthorization']
}) {
  const body = input.body
  const expected = input.expected
  return [
    body.executeSmsSend === true ? null : 'executeSmsSend must be true.',
    body.dryRun === true ? 'dryRun must be false or omitted for live execution.' : null,
    body.sendAuthorization === WARM_SMS_SEND_AUTHORIZATION
      ? null
      : `sendAuthorization must be ${WARM_SMS_SEND_AUTHORIZATION}.`,
    String(body.contactSubmissionId ?? '') === String(expected.contactId ?? '')
      ? null
      : 'contactSubmissionId does not match this lead route.',
    body.outreachQueueId === expected.outreachQueueId
      ? null
      : 'outreachQueueId does not match this SMS message row.',
    body.messageVersionKey === expected.messageVersionKey
      ? null
      : 'messageVersionKey does not match current SMS evidence.',
    body.idempotencyKey === expected.idempotencyKey
      ? null
      : 'idempotencyKey does not match this contact, SMS channel, and message version.',
    body.submittedEvidenceKey === expected.submittedEvidenceKey
      ? null
      : 'submittedEvidenceKey does not match this contact, SMS channel, and message version.',
    body.channel === 'sms' ? null : 'channel must be sms.',
    body.provider === 'telnyx_messaging' ? null : 'provider must be telnyx_messaging.',
  ].filter(Boolean) as string[]
}

function senderRuntimeValue() {
  return stringValue(process.env.TELNYX_SENDER_PHONE_NUMBER) ??
    stringValue(process.env.WARM_SMS_TELNYX_FROM_NUMBER)
}

function providerReadinessForLiveSend(input: {
  smsReadiness: WarmSmsReadiness
  transportConfig: WarmSmsProviderTransportConfigInput
  approval: WarmSmsStoredSendApproval | null
  noSendCanaryPassed: boolean
  item: QueueRow
}) {
  const base = input.smsReadiness.providerReadiness
  const hasSuppressionBlocker =
    base.consentAndSuppression.status === 'suppressed' ||
    input.item.contact_submissions?.do_not_contact === true ||
    Boolean(input.item.contact_submissions?.removed_at)

  if (
    hasSuppressionBlocker ||
    cleanApprovalStatus(input.approval) !== 'approved' ||
    !input.noSendCanaryPassed
  ) {
    return base
  }

  const now = new Date().toISOString()
  const evidence = {
    status: 'verified' as const,
    evidence:
      'Redacted Portfolio activation evidence is present for this exact approved queue, with the no-send canary passed before live execution.',
  }
  const capabilityEvidence = Object.fromEntries(
    LIVE_SEND_CAPABILITY_KEYS.map((key) => [
      key,
      evidence,
    ]),
  )

  return buildWarmSmsProviderReadiness({
    provider: {
      name: 'Telnyx Messaging',
      configured: true,
      enabled: true,
    },
    consent: {
      knownRelationshipBasis: input.smsReadiness.relationshipRationale.status === 'present',
      relationshipBasisNote: input.smsReadiness.relationshipRationale.basis,
      phoneProvenance: stringValue(input.item.contact_submissions?.phone_number)
        ? 'known'
        : 'missing',
      phoneProvenanceNote:
        input.smsReadiness.phoneReadiness.provenance ??
        'Portfolio contact record has a reviewed phone source for this approved SMS queue.',
      permissionStatus: 'documented',
      permissionNote:
        'Current per-recipient approval is recorded on warm_sms_send_authorization for this exact SMS queue and message version.',
      optOutStop: false,
      wrongNumber: false,
      doNotContact: input.item.contact_submissions?.do_not_contact === true ||
        Boolean(input.item.contact_submissions?.removed_at),
      lastContactAt: null,
      cooldownDays: 0,
      auditedAt: stringValue(input.approval?.approved_at) ?? now,
    },
    draftApproval: {
      approvedForProviderDraftCreation: true,
    },
    activation: {
      providerSelectionStatus: 'selected',
      providerSelectionNote:
        'Telnyx Messaging is selected for this one-recipient live canary.',
      providerSetupCandidate: 'telnyx_messaging',
      configurationStatus: 'verified_disabled',
      configurationNote:
        'Redacted Vercel provider references were reviewed before temporary execution activation.',
      noSendCanaryPassed: true,
      capabilityEvidence,
      reviewedAt: now,
    },
    transportConfig: {
      ...input.transportConfig,
      ENABLE_WARM_SMS_PROVIDER_EXECUTION: 'false',
    },
    now,
  })
}

function cleanApprovalStatus(approval: WarmSmsStoredSendApproval | null) {
  return stringValue(approval?.status)?.toLowerCase() ?? null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status },
      )
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    let bodyInput: RequestBody = {}
    try {
      bodyInput = parseBody(await request.json())
    } catch {
      bodyInput = {}
    }

    const { id: idParam } = await params
    const contactId = parseInt(idParam, 10)
    if (Number.isNaN(contactId) || contactId < 1) {
      return blockedResponse({
        message: 'Warm SMS execution blocked. Invalid lead ID.',
        blockers: ['Invalid lead ID.'],
        status: 400,
      })
    }

    const relationshipResponse = await getRelationshipPacket(request, {
      params: Promise.resolve({ id: idParam }),
    })
    const relationshipBody = (await relationshipResponse.json().catch(() => ({}))) as RelationshipPacketBody
    if (!relationshipResponse.ok || !relationshipBody.smsReadiness?.providerReadiness) {
      return blockedResponse({
        message:
          relationshipBody.error ?? 'Warm SMS execution blocked. Relationship readiness is unavailable.',
        blockers: [relationshipBody.error ?? 'relationship readiness unavailable'],
        status: relationshipResponse.status,
      })
    }

    const outreachQueueId = bodyInput.outreachQueueId
    if (!outreachQueueId) {
      const readiness = buildWarmSmsTelnyxLiveSendReadiness({
        providerReadiness: relationshipBody.smsReadiness.providerReadiness,
        transportConfig: smsTransportConfigFromEnv(),
        contactId,
        executionFlagEnabled: executionEnabled(),
        runtimeCredentialReady: isWarmSmsTelnyxRuntimeCredentialReady(),
      })
      return blockedResponse({
        message: 'Warm SMS execution blocked. A specific SMS queue/message id is required.',
        blockers: ['outreachQueueId is required.'],
        status: 400,
        readiness,
      })
    }

    const { data, error } = await supabaseAdmin
      .from('outreach_queue')
      .select(
        `
        id,
        contact_submission_id,
        status,
        channel,
        subject,
        body,
        thread_id,
        message_id,
        sent_at,
        generation_inputs,
        contact_submissions (
          id,
          name,
          phone_number,
          outreach_status,
          do_not_contact,
          removed_at
        )
      `,
      )
      .eq('id', outreachQueueId)
      .eq('contact_submission_id', contactId)
      .single()

    if (error || !data?.id) {
      return blockedResponse({
        message: 'Warm SMS execution blocked. The specific SMS queue/message row was not found.',
        blockers: ['SMS queue/message row not found.'],
        status: 404,
      })
    }

    const item = data as QueueRow
    const generationInputs = metadataRecord(item.generation_inputs)
    const approval = approvalEvidence(generationInputs)
    const existingExecution = executionEvidence(generationInputs)
    const messageVersionKey =
      stringValue(approval?.message_version_key) ??
      stringValue(generationInputs.warm_sms_message_version_key) ??
      stringValue(bodyInput.messageVersionKey)
    const idempotencyKey =
      stringValue(approval?.sms_send_idempotency_key) ??
      stringValue(approval?.idempotency_key) ??
      stringValue(bodyInput.idempotencyKey)
    const submittedEvidenceKey =
      stringValue(approval?.submitted_evidence_key) ??
      stringValue(bodyInput.submittedEvidenceKey)

    const transportConfig = smsTransportConfigFromEnv()
    const noSendCanaryPassedForRow = noSendCanaryPassed(generationInputs, approval)
    const providerReadiness = providerReadinessForLiveSend({
      smsReadiness: relationshipBody.smsReadiness,
      transportConfig,
      approval,
      noSendCanaryPassed: noSendCanaryPassedForRow,
      item,
    })
    const initialReadiness = buildWarmSmsTelnyxLiveSendReadiness({
      providerReadiness,
      transportConfig,
      contactId,
      outreachQueueId: item.id,
      messageVersionKey,
      idempotencyKey,
      submittedEvidenceKey,
      executionFlagEnabled: executionEnabled(),
      runtimeCredentialReady: isWarmSmsTelnyxRuntimeCredentialReady(),
      approval,
      existingAttempt: existingExecution,
      noSendCanaryPassed: noSendCanaryPassedForRow,
    })

    const { expectedAuthorization } = initialReadiness
    const [contactCommunicationsRes] = await Promise.all([
      supabaseAdmin
        .from('contact_communications')
        .select('id, status, metadata, created_at')
        .eq('source_system', 'outreach_queue')
        .eq('source_id', item.id)
        .eq('channel', 'sms')
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    if (contactCommunicationsRes.error) {
      return blockedResponse({
        message: 'Warm SMS execution blocked. Portfolio could not verify duplicate sent evidence.',
        blockers: ['submitted SMS evidence lookup failed.'],
        status: 503,
        readiness: initialReadiness,
      })
    }

    const submittedRows = Array.isArray(contactCommunicationsRes.data)
      ? contactCommunicationsRes.data as MetadataRecord[]
      : []
    const submittedEvidence = existingAttemptFromRows(submittedRows, {
      idempotencyKey: expectedAuthorization.idempotencyKey,
      submittedEvidenceKey: expectedAuthorization.submittedEvidenceKey,
    })
    const readiness = submittedEvidence
      ? buildWarmSmsTelnyxLiveSendReadiness({
          providerReadiness,
          transportConfig,
          contactId,
          outreachQueueId: item.id,
          messageVersionKey: expectedAuthorization.messageVersionKey,
          idempotencyKey: expectedAuthorization.idempotencyKey,
          submittedEvidenceKey: expectedAuthorization.submittedEvidenceKey,
          executionFlagEnabled: executionEnabled(),
          runtimeCredentialReady: isWarmSmsTelnyxRuntimeCredentialReady(),
          approval,
          existingAttempt: submittedEvidence,
          noSendCanaryPassed: noSendCanaryPassedForRow,
        })
      : initialReadiness

    if (submittedEvidence || ['sent', 'sending'].includes(stringValue(existingExecution?.status)?.toLowerCase() ?? '') || item.status === 'sent') {
      return duplicateResponse({
        message: 'Warm SMS send evidence already exists for this recipient and message version. No duplicate SMS was sent.',
        readiness,
        evidence: submittedEvidence ?? existingExecution ?? {
          status: item.status,
          idempotencyKey: expectedAuthorization.idempotencyKey,
          submittedEvidenceKey: expectedAuthorization.submittedEvidenceKey,
        },
      })
    }

    const baseBlockers = [
      item.channel === 'sms' || item.channel === 'phone_contact'
        ? null
        : 'Outreach item must be an SMS/phone outreach row.',
      item.status === 'approved'
        ? null
        : `Outreach item must be approved before SMS execution. Current status: ${item.status ?? 'unknown'}.`,
      stringValue(item.contact_submissions?.phone_number)
        ? null
        : 'Recipient phone reference is missing.',
      stringValue(item.body)
        ? null
        : 'SMS message body is missing from the selected queue row.',
      item.contact_submissions?.do_not_contact ? 'Contact is marked do_not_contact.' : null,
      item.contact_submissions?.removed_at ? 'Contact has been removed.' : null,
      ...readiness.blockedReasons,
    ].filter(Boolean) as string[]

    if (baseBlockers.length > 0) {
      return blockedResponse({
        message: `Warm SMS execution blocked. ${baseBlockers[0]}`,
        blockers: baseBlockers,
        status: readiness.state === 'per_recipient_approval_required' ? 403 : 409,
        readiness,
      })
    }

    if (!bodyInput.executeSmsSend || bodyInput.dryRun === true) {
      const alreadyPrepared =
        stringValue(existingExecution?.status) === 'eligible_for_execution' &&
        existingExecution?.idempotencyKey === expectedAuthorization.idempotencyKey
      if (alreadyPrepared) {
        return preparedResponse({
          message:
            'Warm SMS live-send gates are already eligible for this recipient and message version. No duplicate evidence was created and no Telnyx call was made.',
          readiness,
          evidence: metadataRecord(generationInputs.warm_sms_telnyx_execution),
          duplicatePrevented: true,
        })
      }

      const preparedAt = new Date().toISOString()
      const preparedEvidence = {
        version: 'warm-outreach-sms-telnyx-live-send/v1',
        status: 'eligible_for_execution',
        provider: 'telnyx_messaging',
        provider_action: 'messages.create',
        contact_submission_id: item.contact_submission_id,
        outreach_queue_id: item.id,
        recipient_phone_reference: 'contact_submissions.phone_number',
        message_body_reference: `outreach_queue:${item.id}:body`,
        message_version_key: expectedAuthorization.messageVersionKey,
        sms_send_idempotency_key: expectedAuthorization.idempotencyKey,
        submitted_evidence_key: expectedAuthorization.submittedEvidenceKey,
        idempotency_key: expectedAuthorization.idempotencyKey,
        prepared_by: authResult.user.id,
        prepared_at: preparedAt,
        dry_run: bodyInput.dryRun === true,
        execution_flag_enabled: executionEnabled(),
        execute_request_submitted: bodyInput.executeSmsSend === true,
        telnyx_api_called: false,
        external_send_performed: false,
      }
      const history = Array.isArray(generationInputs.warm_sms_telnyx_execution_history)
        ? generationInputs.warm_sms_telnyx_execution_history
        : []
      const prepareRes = await supabaseAdmin
        .from('outreach_queue')
        .update({
          generation_inputs: {
            ...generationInputs,
            warm_sms_telnyx_execution: preparedEvidence,
            warm_sms_telnyx_execution_history: [preparedEvidence, ...history].slice(0, 25),
          },
          updated_at: preparedAt,
        })
        .eq('id', item.id)
        .eq('status', 'approved')
        .select('id')
        .single()

      if (prepareRes.error || !prepareRes.data?.id) {
        return blockedResponse({
          message: 'Warm SMS execution gates passed, but Portfolio could not record eligible execution state.',
          blockers: ['eligible SMS execution evidence write failed.'],
          status: 503,
          readiness,
        })
      }

      return preparedResponse({
        message:
          'Warm SMS live-send gates passed in readiness mode. Portfolio recorded eligibility and no Telnyx call was made.',
        readiness,
        evidence: preparedEvidence,
        duplicatePrevented: false,
      })
    }

    const requestErrors = requestAuthorizationErrors({
      body: bodyInput,
      expected: expectedAuthorization,
    })
    if (requestErrors.length > 0) {
      return blockedResponse({
        message: `Explicit per-recipient SMS send authorization is required. ${requestErrors[0]}`,
        blockers: requestErrors,
        status: 403,
        readiness,
      })
    }

    const fromPhone = senderRuntimeValue()
    if (!fromPhone) {
      return blockedResponse({
        message: 'Warm SMS execution blocked. Telnyx sender/profile runtime value is missing.',
        blockers: ['Telnyx sender/profile runtime value is missing.'],
        status: 409,
        readiness,
      })
    }

    const now = new Date().toISOString()
    const claim = {
      version: 'warm-outreach-sms-telnyx-live-send/v1',
      status: 'sending',
      provider: 'telnyx_messaging',
      provider_action: 'messages.create',
      contact_submission_id: item.contact_submission_id,
      outreach_queue_id: item.id,
      recipient_phone_reference: 'contact_submissions.phone_number',
      message_body_reference: `outreach_queue:${item.id}:body`,
      message_version_key: expectedAuthorization.messageVersionKey,
      sms_send_idempotency_key: expectedAuthorization.idempotencyKey,
      submitted_evidence_key: expectedAuthorization.submittedEvidenceKey,
      idempotency_key: expectedAuthorization.idempotencyKey,
      claimed_by: authResult.user.id,
      claimed_at: now,
      telnyx_api_called: false,
      external_send_performed: false,
    }
    const history = Array.isArray(generationInputs.warm_sms_telnyx_execution_history)
      ? generationInputs.warm_sms_telnyx_execution_history
      : []
    const claimRes = await supabaseAdmin
      .from('outreach_queue')
      .update({
        generation_inputs: {
          ...generationInputs,
          warm_sms_telnyx_execution: claim,
          warm_sms_telnyx_execution_history: [claim, ...history].slice(0, 25),
        },
        updated_at: now,
      })
      .eq('id', item.id)
      .eq('status', 'approved')
      .select('id')
      .single()

    if (claimRes.error || !claimRes.data?.id) {
      return duplicateResponse({
        message: 'Warm SMS execution could not claim the approved row. No duplicate SMS was sent.',
        readiness,
        evidence: {
          status: 'sending',
          idempotencyKey: expectedAuthorization.idempotencyKey,
          submittedEvidenceKey: expectedAuthorization.submittedEvidenceKey,
        },
      })
    }

    const providerResult = await sendWarmSmsViaTelnyx({
      toPhone: item.contact_submissions!.phone_number!,
      fromPhone,
      messageBody: item.body!,
      idempotencyKey: expectedAuthorization.idempotencyKey,
    })

    if (!providerResult.ok) {
      await supabaseAdmin
        .from('outreach_queue')
        .update({
          status: 'approved',
          generation_inputs: {
            ...generationInputs,
            warm_sms_telnyx_execution: {
              ...claim,
              status: 'failed_provider_call',
              failed_at: new Date().toISOString(),
              failure_reason: providerResult.error,
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
      return blockedResponse({
        message: `Telnyx could not accept the authorized SMS request. ${providerResult.error}`,
        blockers: [providerResult.error],
        status: 502,
        readiness,
      })
    }

    const sentAt = new Date().toISOString()
    const finalEvidence = {
      ...claim,
      status: 'sent',
      provider_message_id: providerResult.providerMessageId,
      delivery_status: providerResult.deliveryStatus,
      sent_by: authResult.user.id,
      sent_at: sentAt,
      submitted_at: sentAt,
      telnyx_api_called: true,
      external_send_performed: true,
      external_send_enabled: true,
      provider_execution_enabled: true,
    }
    const finalHistory = [finalEvidence, claim, ...history].slice(0, 25)
    const finalRes = await supabaseAdmin
      .from('outreach_queue')
      .update({
        status: 'sent',
        sent_at: sentAt,
        message_id: providerResult.providerMessageId,
        generation_inputs: {
          ...generationInputs,
          warm_sms_telnyx_execution: finalEvidence,
          warm_sms_telnyx_execution_history: finalHistory,
        },
        updated_at: sentAt,
      })
      .eq('id', item.id)
      .select('id')
      .single()

    if (finalRes.error || !finalRes.data?.id) {
      return NextResponse.json(
        {
          version: 'warm-outreach-sms-telnyx-live-send/v1',
          status: 'tracking_failed_after_send',
          message:
            'Telnyx accepted the authorized SMS, but Portfolio could not persist final sent evidence. Repair tracking before any further SMS attempt.',
          telnyxApiCalled: true,
          externalSendPerformed: true,
          sentEvidence: finalEvidence,
          executionBoundary: redactedBoundary(true),
          liveSendReadiness: readiness,
        },
        { status: 502 },
      )
    }

    const communication = await logCommunication({
      contactSubmissionId: item.contact_submission_id,
      channel: 'sms',
      direction: 'outbound',
      messageType: 'cold_outreach',
      subject: item.subject,
      body: item.body!,
      sourceSystem: 'outreach_queue',
      sourceId: item.id,
      status: 'sent',
      sentAt,
      sentBy: authResult.user.id,
      metadata: {
        outreach_queue_id: item.id,
        telnyx_message_id: providerResult.providerMessageId,
        sms_send_idempotency_key: expectedAuthorization.idempotencyKey,
        submitted_evidence_key: expectedAuthorization.submittedEvidenceKey,
        warm_sms_send_authorization: approval,
        warm_sms_telnyx_execution: finalEvidence,
        raw_phone_returned: false,
        raw_message_body_returned: false,
      },
    })

    return NextResponse.json({
      version: 'warm-outreach-sms-telnyx-live-send/v1',
      status: communication?.id ? 'sent' : 'sent_secondary_log_repair_required',
      message: communication?.id
        ? 'Authorized warm SMS sent through Telnyx and Portfolio sent evidence was recorded.'
        : 'Telnyx accepted the authorized SMS and queue evidence was recorded, but the secondary communication timeline log needs repair.',
      contactId: item.contact_submission_id,
      outreachQueueId: item.id,
      providerMessageId: providerResult.providerMessageId,
      deliveryStatus: providerResult.deliveryStatus,
      sentAt,
      idempotency: {
        messageVersionKey: expectedAuthorization.messageVersionKey,
        smsSendIdempotencyKey: expectedAuthorization.idempotencyKey,
        submittedEvidenceKey: expectedAuthorization.submittedEvidenceKey,
      },
      telnyxApiCalled: true,
      externalSendPerformed: true,
      sentEvidence: finalEvidence,
      communicationLog: communication?.id
        ? { status: 'recorded', communicationId: communication.id }
        : { status: 'repair_required', communicationId: null },
      executionBoundary: redactedBoundary(true),
      liveSendReadiness: readiness,
    })
  } catch (error) {
    console.error('POST /api/admin/outreach/leads/[id]/sms-telnyx-live-send:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 },
    )
  }
}
