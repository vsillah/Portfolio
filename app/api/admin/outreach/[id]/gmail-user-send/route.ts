import { NextRequest, NextResponse } from 'next/server'

import { GET as getRelationshipPacket } from '@/app/api/admin/outreach/leads/[id]/relationship-packet/route'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { resolveBusinessEmailConfig } from '@/lib/business-email-config'
import { logCommunication } from '@/lib/communications'
import { decryptRefreshToken } from '@/lib/gmail-user-oauth-crypto'
import { isGmailUserOauthSecretConfigured } from '@/lib/gmail-user-oauth-secret'
import {
  isGmailUserOAuthClientConfigured,
  sendUserGmailDraft,
} from '@/lib/gmail-user-api'
import { supabaseAdmin } from '@/lib/supabase'
import type {
  WarmOutreachEmailSendLifecycle,
  WarmOutreachResponseMonitoring,
} from '@/lib/warm-outreach-response-monitoring'

export const dynamic = 'force-dynamic'

const GMAIL_SEND_AUTHORIZATION =
  'execute_warm_gmail_send_for_authorized_recipient'

type RequestBody = {
  executeGmailSend?: boolean
  dryRun?: boolean
  sendAuthorization?: string
  idempotencyKey?: string
  submittedEvidenceKey?: string
  messageVersionKey?: string
  contactSubmissionId?: string | number
  recipientEmail?: string
  gmailDraftId?: string
  channel?: string
}

type MetadataRecord = Record<string, unknown>

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
        email: string | null
        company: string | null
        outreach_status?: string | null
        do_not_contact?: boolean | null
        removed_at?: string | null
      }
    | null
}

type CredentialRow = {
  refresh_token_cipher?: string | null
  refresh_token_iv?: string | null
  refresh_token_tag?: string | null
  google_email?: string | null
}

type RelationshipPacketBody = {
  error?: string
  responseMonitoring?: WarmOutreachResponseMonitoring
}

function metadataRecord(value: unknown): MetadataRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as MetadataRecord
    : {}
}

function stringValue(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || null
}

function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function parseBody(raw: unknown): RequestBody {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const value = raw as Record<string, unknown>
  return {
    executeGmailSend: value.executeGmailSend === true,
    dryRun: value.dryRun === true,
    sendAuthorization:
      typeof value.sendAuthorization === 'string' ? value.sendAuthorization : undefined,
    idempotencyKey:
      typeof value.idempotencyKey === 'string' ? value.idempotencyKey : undefined,
    submittedEvidenceKey:
      typeof value.submittedEvidenceKey === 'string' ? value.submittedEvidenceKey : undefined,
    messageVersionKey:
      typeof value.messageVersionKey === 'string' ? value.messageVersionKey : undefined,
    contactSubmissionId:
      typeof value.contactSubmissionId === 'string' ||
      typeof value.contactSubmissionId === 'number'
        ? value.contactSubmissionId
        : undefined,
    recipientEmail:
      typeof value.recipientEmail === 'string' ? value.recipientEmail : undefined,
    gmailDraftId: typeof value.gmailDraftId === 'string' ? value.gmailDraftId : undefined,
    channel: typeof value.channel === 'string' ? value.channel : undefined,
  }
}

function executionEnabled(): boolean {
  return process.env.ENABLE_WARM_GMAIL_SEND_EXECUTION === 'true'
}

function providerExecutionReadiness(input?: {
  enabled?: boolean
  lifecycle?: WarmOutreachEmailSendLifecycle
  state?: string
  message?: string
}) {
  const enabled = input?.enabled ?? executionEnabled()
  return {
    version: 'warm-outreach-gmail-provider-execution-readiness/v1',
    state: enabled ? 'admin_activation_enabled_requires_exact_scope' : 'admin_activation_required',
    label: enabled ? 'Provider execution gate enabled' : 'Provider execution gate disabled',
    liveExecutionEnabled: enabled,
    providerCallsEnabled: enabled,
    externalSendEnabled: enabled,
    adminActivationGate: {
      key: 'ENABLE_WARM_GMAIL_SEND_EXECUTION',
      enabled,
      detail: enabled
        ? 'The admin/provider activation flag is enabled. This route still requires exact per-recipient authorization, matching idempotency keys, sender evidence, suppression clearance, and draft evidence.'
        : 'The admin/provider activation flag is disabled. Portfolio can record readiness only; no Gmail send will be called.',
    },
    exactExecutionGate: {
      route: '/api/admin/outreach/[id]/gmail-user-send',
      method: 'POST',
      sendAuthorization: GMAIL_SEND_AUTHORIZATION,
      executeGmailSendRequired: true,
      messageVersionKey: input?.lifecycle?.messageVersionKey ?? null,
      sendQueueIdempotencyKey: input?.lifecycle?.sendQueueIdempotencyKey ?? null,
      submittedEvidenceKey: input?.lifecycle?.submittedEvidenceKey ?? null,
    },
    currentCheck: {
      state: input?.state ?? 'not_evaluated',
      detail: input?.message ?? 'Warm Gmail execution readiness has not been evaluated for a specific queue row.',
    },
  }
}

function executionBoundary(enabled = false) {
  return {
    portfolioAuthorizationRequired: true,
    senderDraftEvidenceRequired: true,
    duplicateSubmittedEvidenceRequired: true,
    providerCallsEnabled: enabled,
    gmailSendEnabled: enabled,
    externalSendEnabled: enabled,
    schedulingEnabled: false,
    slackActionEnabled: false,
  }
}

function authorizationDecision(generationInputs: MetadataRecord): MetadataRecord {
  return metadataRecord(generationInputs.warm_gmail_send_authorization)
}

function draftCreationEvidence(generationInputs: MetadataRecord): MetadataRecord {
  return metadataRecord(generationInputs.gmail_draft_creation)
}

function sendExecutionEvidence(generationInputs: MetadataRecord): MetadataRecord {
  return metadataRecord(generationInputs.warm_gmail_send_execution)
}

function executionScopeMatches(execution: MetadataRecord, input: {
  item: QueueRow
  lifecycle: WarmOutreachEmailSendLifecycle
}) {
  return (
    execution.outreach_queue_id === input.item.id &&
    Number(execution.contact_submission_id) === input.item.contact_submission_id &&
    execution.message_version_key === input.lifecycle.messageVersionKey &&
    (
      execution.send_queue_idempotency_key === input.lifecycle.sendQueueIdempotencyKey ||
      execution.idempotency_key === input.lifecycle.sendQueueIdempotencyKey
    ) &&
    execution.submitted_evidence_key === input.lifecycle.submittedEvidenceKey
  )
}

function existingSubmittedEvidenceFromRows(rows: MetadataRecord[], input: {
  sendQueueIdempotencyKey: string
  submittedEvidenceKey: string
}): MetadataRecord | null {
  for (const row of rows) {
    const metadata = metadataRecord(row.metadata)
    const execution = metadataRecord(metadata.warm_gmail_send_execution)
    const idempotencyKey =
      stringValue(metadata.gmail_send_idempotency_key) ??
      stringValue(execution.idempotency_key) ??
      stringValue(execution.send_queue_idempotency_key)
    const submittedEvidenceKey =
      stringValue(metadata.submitted_evidence_key) ??
      stringValue(execution.submitted_evidence_key)
    const status = stringValue(row.status)?.toLowerCase()
    if (
      idempotencyKey === input.sendQueueIdempotencyKey ||
      submittedEvidenceKey === input.submittedEvidenceKey
    ) {
      return {
        source_id: stringValue(row.id),
        status,
        idempotency_key: idempotencyKey,
        submitted_evidence_key: submittedEvidenceKey,
        gmail_message_id: stringValue(metadata.gmail_user_sent_message_id) ??
          stringValue(execution.gmail_message_id),
        gmail_thread_id: stringValue(metadata.gmail_user_thread_id) ??
          stringValue(execution.gmail_thread_id),
      }
    }
  }
  return null
}

function blockedResponse(input: {
  message: string
  blockers: string[]
  status?: number
  lifecycle?: WarmOutreachEmailSendLifecycle
  expectedAuthorization?: Record<string, unknown>
}) {
  return NextResponse.json(
    {
      version: 'warm-outreach-gmail-send-execution/v1',
      status: 'blocked_no_send',
      message: input.message,
      blockers: input.blockers,
      gmailSendCalled: false,
      externalSendPerformed: false,
      executionBoundary: executionBoundary(false),
      providerExecutionReadiness: providerExecutionReadiness({
        enabled: false,
        lifecycle: input.lifecycle,
        state: 'blocked_no_send',
        message: input.message,
      }),
      idempotency: input.lifecycle
        ? {
            messageVersionKey: input.lifecycle.messageVersionKey,
            sendQueueIdempotencyKey: input.lifecycle.sendQueueIdempotencyKey,
            submittedEvidenceKey: input.lifecycle.submittedEvidenceKey,
          }
        : undefined,
      expectedAuthorization: input.expectedAuthorization,
    },
    { status: input.status ?? 409 },
  )
}

function duplicateResponse(input: {
  message: string
  lifecycle: WarmOutreachEmailSendLifecycle
  evidence: MetadataRecord
}) {
  return NextResponse.json({
    version: 'warm-outreach-gmail-send-execution/v1',
    status: 'duplicate_prevented',
    message: input.message,
    duplicatePrevented: true,
    gmailSendCalled: false,
    externalSendPerformed: false,
    sentEvidence: input.evidence,
    idempotency: {
      messageVersionKey: input.lifecycle.messageVersionKey,
      sendQueueIdempotencyKey: input.lifecycle.sendQueueIdempotencyKey,
      submittedEvidenceKey: input.lifecycle.submittedEvidenceKey,
    },
    executionBoundary: executionBoundary(false),
    providerExecutionReadiness: providerExecutionReadiness({
      enabled: false,
      lifecycle: input.lifecycle,
      state: 'duplicate_prevented',
      message: input.message,
    }),
  })
}

function preparedResponse(input: {
  message: string
  lifecycle: WarmOutreachEmailSendLifecycle
  evidence: MetadataRecord
  duplicatePrevented: boolean
  expectedAuthorization: Record<string, unknown>
}) {
  return NextResponse.json({
    version: 'warm-outreach-gmail-send-execution/v1',
    status: 'eligible_for_execution',
    message: input.message,
    duplicatePrevented: input.duplicatePrevented,
    gmailSendCalled: false,
    externalSendPerformed: false,
    preparedExecutionEvidence: input.evidence,
    expectedAuthorization: input.expectedAuthorization,
    idempotency: {
      messageVersionKey: input.lifecycle.messageVersionKey,
      sendQueueIdempotencyKey: input.lifecycle.sendQueueIdempotencyKey,
      submittedEvidenceKey: input.lifecycle.submittedEvidenceKey,
    },
    executionBoundary: executionBoundary(false),
    providerExecutionReadiness: providerExecutionReadiness({
      enabled: false,
      lifecycle: input.lifecycle,
      state: 'eligible_for_execution',
      message: input.message,
    }),
  })
}

function expectedAuthorization(input: {
  item: QueueRow
  lifecycle: WarmOutreachEmailSendLifecycle
  recipientEmail: string
  gmailDraftId: string | null
}) {
  return {
    executeGmailSend: true,
    sendAuthorization: GMAIL_SEND_AUTHORIZATION,
    idempotencyKey: input.lifecycle.sendQueueIdempotencyKey,
    submittedEvidenceKey: input.lifecycle.submittedEvidenceKey,
    messageVersionKey: input.lifecycle.messageVersionKey,
    contactSubmissionId: input.item.contact_submission_id,
    recipientEmail: input.recipientEmail,
    gmailDraftId: input.gmailDraftId,
    channel: 'email',
  }
}

function requestAuthorizationErrors(input: {
  body: RequestBody
  item: QueueRow
  lifecycle: WarmOutreachEmailSendLifecycle
  recipientEmail: string
  gmailDraftId: string
}) {
  const body = input.body
  return [
    body.executeGmailSend === true ? null : 'executeGmailSend must be true.',
    body.dryRun === true ? 'dryRun must be false or omitted for live execution.' : null,
    body.sendAuthorization === GMAIL_SEND_AUTHORIZATION
      ? null
      : `sendAuthorization must be ${GMAIL_SEND_AUTHORIZATION}.`,
    body.idempotencyKey === input.lifecycle.sendQueueIdempotencyKey
      ? null
      : 'idempotencyKey does not match this contact, channel, and message version.',
    body.submittedEvidenceKey === input.lifecycle.submittedEvidenceKey
      ? null
      : 'submittedEvidenceKey does not match this contact, channel, and message version.',
    body.messageVersionKey === input.lifecycle.messageVersionKey
      ? null
      : 'messageVersionKey does not match current warm outreach lifecycle evidence.',
    String(body.contactSubmissionId ?? '') === String(input.item.contact_submission_id)
      ? null
      : 'contactSubmissionId does not match this outreach item.',
    normalizeEmail(body.recipientEmail) === normalizeEmail(input.recipientEmail)
      ? null
      : 'recipientEmail does not match this outreach item.',
    body.gmailDraftId === input.gmailDraftId
      ? null
      : 'gmailDraftId does not match the tracked Gmail draft evidence.',
    body.channel === 'email' ? null : 'channel must be email.',
  ].filter(Boolean) as string[]
}

async function loadLifecycle(request: NextRequest, contactId: number) {
  const relationshipResponse = await getRelationshipPacket(request, {
    params: Promise.resolve({ id: String(contactId) }),
  })
  const relationshipBody = (await relationshipResponse.json().catch(() => ({}))) as RelationshipPacketBody
  if (!relationshipResponse.ok) {
    return {
      error: relationshipBody.error ?? 'Could not load warm outreach relationship readiness.',
      status: relationshipResponse.status,
      lifecycle: null,
    }
  }

  const lifecycle = relationshipBody.responseMonitoring?.sendReadiness.modes.warm_1_to_1
    .find((entry) => entry.channel === 'email')?.emailSendLifecycle ?? null
  return { error: null, status: 200, lifecycle }
}

/**
 * POST /api/admin/outreach/[id]/gmail-user-send
 *
 * Executes one already-authorized Gmail draft send only when Portfolio
 * authorization, sender/draft evidence, suppression checks, and idempotency
 * evidence all pass. The route is dry-run/no-send by default unless
 * ENABLE_WARM_GMAIL_SEND_EXECUTION=true and the request repeats the exact
 * per-recipient execution scope.
 */
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

    const { id } = await params
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
          email,
          company,
          outreach_status,
          do_not_contact,
          removed_at
        )
      `,
      )
      .eq('id', id)
      .single()

    if (error || !data?.id) {
      return NextResponse.json({ error: 'Outreach item not found.' }, { status: 404 })
    }

    const item = data as QueueRow
    if (item.channel !== 'email') {
      return blockedResponse({
        message: 'Warm Gmail send execution is only available for email outreach rows.',
        blockers: ['channel must be email'],
        status: 400,
      })
    }
    const recipientEmail = item.contact_submissions?.email?.trim() ?? ''
    if (!recipientEmail.includes('@')) {
      return blockedResponse({
        message: 'Warm Gmail send execution blocked. The contact has no usable recipient email.',
        blockers: ['recipient email is missing'],
        status: 400,
      })
    }

    const lifecycleResult = await loadLifecycle(request, item.contact_submission_id)
    if (lifecycleResult.error || !lifecycleResult.lifecycle) {
      return blockedResponse({
        message: lifecycleResult.error ?? 'No warm Gmail send lifecycle is available for this recipient.',
        blockers: [lifecycleResult.error ?? 'email lifecycle missing'],
        status: lifecycleResult.status,
      })
    }
    const lifecycle = lifecycleResult.lifecycle
    const generationInputs = metadataRecord(item.generation_inputs)
    const authorization = authorizationDecision(generationInputs)
    const draftEvidence = draftCreationEvidence(generationInputs)
    const executionEvidence = sendExecutionEvidence(generationInputs)
    const gmailDraftId = stringValue(draftEvidence.draft_id)
    const expected = expectedAuthorization({
      item,
      lifecycle,
      recipientEmail,
      gmailDraftId,
    })

    const [contactCommunicationsRes, emailMessagesRes] = await Promise.all([
      supabaseAdmin
        .from('contact_communications')
        .select('id, status, metadata, created_at')
        .eq('source_system', 'outreach_queue')
        .eq('source_id', item.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabaseAdmin
        .from('email_messages')
        .select('id, status, metadata, created_at')
        .eq('source_system', 'outreach_queue')
        .eq('source_id', item.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    if (contactCommunicationsRes.error || emailMessagesRes.error) {
      return blockedResponse({
        message: 'Warm Gmail send execution blocked. Portfolio could not verify submitted send evidence.',
        blockers: ['submitted sent evidence lookup failed'],
        status: 503,
        lifecycle,
        expectedAuthorization: expected,
      })
    }

    const submittedRows = [
      ...(Array.isArray(contactCommunicationsRes.data) ? contactCommunicationsRes.data as MetadataRecord[] : []),
      ...(Array.isArray(emailMessagesRes.data) ? emailMessagesRes.data as MetadataRecord[] : []),
    ]
    const submittedEvidence = existingSubmittedEvidenceFromRows(submittedRows, {
      sendQueueIdempotencyKey: lifecycle.sendQueueIdempotencyKey,
      submittedEvidenceKey: lifecycle.submittedEvidenceKey,
    })
    if (
      submittedEvidence ||
      stringValue(executionEvidence.status) === 'sent' ||
      executionEvidence.gmail_send_called === true ||
      item.status === 'sent'
    ) {
      return duplicateResponse({
        message: 'Warm Gmail send evidence already exists for this recipient and message version. No duplicate email was sent.',
        lifecycle,
        evidence: submittedEvidence ?? executionEvidence,
      })
    }
    if (stringValue(executionEvidence.status) === 'sending' || item.status === 'queued') {
      return duplicateResponse({
        message: 'Warm Gmail send execution is already claimed for this recipient and message version. No duplicate email was sent.',
        lifecycle,
        evidence: executionEvidence,
      })
    }

    const requiredSender = resolveBusinessEmailConfig().fromEmail.toLowerCase()
    let credential: CredentialRow | null = null
    const senderBlockers: string[] = []
    if (!isGmailUserOAuthClientConfigured() || !isGmailUserOauthSecretConfigured()) {
      senderBlockers.push('Gmail OAuth server configuration is missing.')
    } else {
      const { data: creds, error: credsError } = await supabaseAdmin
        .from('admin_gmail_user_credentials')
        .select('refresh_token_cipher, refresh_token_iv, refresh_token_tag, google_email')
        .eq('user_id', authResult.user.id)
        .maybeSingle()
      credential = creds as CredentialRow | null
      const connectedAs = normalizeEmail(credential?.google_email)
      if (credsError || !credential?.refresh_token_cipher || !credential.refresh_token_iv || !credential.refresh_token_tag) {
        senderBlockers.push(`Connected Gmail credential for ${requiredSender} is missing.`)
      } else if (connectedAs !== requiredSender) {
        senderBlockers.push(`Connected Gmail sender must be ${requiredSender}; current sender is ${connectedAs || 'missing'}.`)
      }
    }

    const authorizationBlockers = [
      authorization.status === 'approved'
        ? null
        : 'Portfolio warm Gmail send authorization is missing or not approved.',
      Number(authorization.contact_submission_id) === item.contact_submission_id
        ? null
        : 'Authorization contact id does not match this outreach item.',
      authorization.outreach_queue_id === item.id
        ? null
        : 'Authorization outreach queue id does not match this outreach item.',
      authorization.message_version_key === lifecycle.messageVersionKey
        ? null
        : 'Authorization message version is stale or mismatched.',
      authorization.send_queue_idempotency_key === lifecycle.sendQueueIdempotencyKey
        ? null
        : 'Authorization send queue idempotency key does not match current lifecycle evidence.',
    ].filter(Boolean) as string[]

    const draftBlockers = [
      gmailDraftId ? null : 'Tracked Gmail draft evidence is missing.',
      stringValue(draftEvidence.thread_id) || item.thread_id
        ? null
        : 'Tracked Gmail draft thread evidence is missing.',
      normalizeEmail(draftEvidence.connected_as) === requiredSender
        ? null
        : 'Tracked Gmail draft sender evidence does not match the required sender.',
      normalizeEmail(draftEvidence.recipient_email) === normalizeEmail(recipientEmail)
        ? null
        : 'Tracked Gmail draft recipient evidence does not match this contact.',
      draftEvidence.external_send_blocked === true
        ? null
        : 'Tracked Gmail draft evidence must show the prior draft phase blocked external send.',
    ].filter(Boolean) as string[]

    const suppressionBlockers = [
      lifecycle.externalSendReadiness.suppressionConsent.state === 'clear'
        ? null
        : lifecycle.externalSendReadiness.suppressionConsent.detail,
      lifecycle.suppressionCheck.status === 'clear'
        ? null
        : lifecycle.suppressionCheck.reasons[0] ?? 'Suppression or consent check is blocked.',
      item.contact_submissions?.do_not_contact
        ? 'Contact is marked do_not_contact.'
        : null,
      item.contact_submissions?.removed_at
        ? 'Contact has been removed.'
        : null,
    ].filter(Boolean) as string[]

    const statusBlockers = item.status === 'approved'
      ? []
      : [`Outreach item must be approved before Gmail send execution. Current status: ${item.status ?? 'unknown'}.`]
    const authorizationStatus = stringValue(authorization.status)?.toLowerCase()
    const blockers = [
      ...authorizationBlockers,
      authorization.approval_intent_recorded === true
        ? null
        : 'Portfolio authorization must record approval intent for this exact recipient and message version.',
      authorization.external_send_authorization_intent === true
        ? null
        : 'Portfolio authorization must record external send authorization intent for this exact recipient and message version.',
      authorization.gmail_send_called === false && authorization.external_send_performed === false
        ? null
        : 'Portfolio authorization evidence is invalid because it contains external-send execution evidence.',
      authorizationStatus === 'revoked'
        ? 'Portfolio warm Gmail send authorization was revoked.'
        : authorizationStatus === 'expired'
          ? 'Portfolio warm Gmail send authorization is expired.'
          : authorizationStatus === 'stale'
            ? 'Portfolio warm Gmail send authorization is stale.'
            : null,
      ...senderBlockers,
      ...draftBlockers,
      ...suppressionBlockers,
      ...statusBlockers,
    ].filter(Boolean) as string[]

    const enabled = executionEnabled()
    if (blockers.length > 0) {
      return blockedResponse({
        message: `Warm Gmail send execution blocked. ${blockers[0]}`,
        blockers,
        status: authorizationBlockers.length > 0 ? 403 : 409,
        lifecycle,
        expectedAuthorization: expected,
      })
    }

    if (!enabled || bodyInput.dryRun === true || bodyInput.executeGmailSend !== true) {
      const alreadyPrepared =
        executionScopeMatches(executionEvidence, { item, lifecycle }) &&
        stringValue(executionEvidence.status) === 'eligible_for_execution'
      if (alreadyPrepared) {
        return preparedResponse({
          message: 'Warm Gmail send execution is already eligible for this recipient and message version. No duplicate evidence was created and no Gmail send was called.',
          lifecycle,
          evidence: executionEvidence,
          duplicatePrevented: true,
          expectedAuthorization: expected,
        })
      }

      const preparedAt = new Date().toISOString()
      const preparedEvidence = {
        version: 'warm-outreach-gmail-send-execution/v1',
        status: 'eligible_for_execution',
        provider: 'gmail_user_oauth',
        provider_action: 'drafts.send',
        contact_submission_id: item.contact_submission_id,
        outreach_queue_id: item.id,
        recipient_email: recipientEmail,
        connected_as: credential?.google_email ?? null,
        required_sender: requiredSender,
        gmail_draft_id: gmailDraftId,
        gmail_thread_id: stringValue(draftEvidence.thread_id) ?? item.thread_id,
        gmail_message_id: stringValue(draftEvidence.message_id) ?? item.message_id,
        authorization_decision_key: stringValue(authorization.decision_key),
        message_version_key: lifecycle.messageVersionKey,
        send_queue_idempotency_key: lifecycle.sendQueueIdempotencyKey,
        submitted_evidence_key: lifecycle.submittedEvidenceKey,
        idempotency_key: lifecycle.sendQueueIdempotencyKey,
        prepared_by: authResult.user.id,
        prepared_at: preparedAt,
        dry_run: bodyInput.dryRun === true,
        execution_flag_enabled: enabled,
        execute_request_submitted: bodyInput.executeGmailSend === true,
        gmail_send_called: false,
        external_send_performed: false,
        external_send_enabled: false,
        provider_execution_enabled: false,
      }
      const history = Array.isArray(generationInputs.warm_gmail_send_execution_history)
        ? generationInputs.warm_gmail_send_execution_history
        : []
      const prepareRes = await supabaseAdmin
        .from('outreach_queue')
        .update({
          generation_inputs: {
            ...generationInputs,
            warm_gmail_send_execution: preparedEvidence,
            warm_gmail_send_execution_history: [preparedEvidence, ...history].slice(0, 25),
          },
          updated_at: preparedAt,
        })
        .eq('id', item.id)
        .eq('status', 'approved')
        .select('id')
        .single()

      if (prepareRes.error || !prepareRes.data?.id) {
        return blockedResponse({
          message: `Warm Gmail send execution gates passed, but Portfolio could not record eligible execution state. ${prepareRes.error?.message ?? 'The approved outreach row was not claimed.'}`,
          blockers: ['eligible send execution evidence write failed'],
          status: 503,
          lifecycle,
          expectedAuthorization: expected,
        })
      }

      return preparedResponse({
        message: enabled
          ? 'Warm Gmail send execution gates passed in QA/dry-run mode. Portfolio recorded eligibility and no Gmail send was called.'
          : 'Warm Gmail send execution gates passed, but live Gmail send execution is disabled. Portfolio recorded eligibility and no Gmail send was called.',
        lifecycle,
        evidence: preparedEvidence,
        duplicatePrevented: false,
        expectedAuthorization: expected,
      })
    }

    const requestErrors = requestAuthorizationErrors({
      body: bodyInput,
      item,
      lifecycle,
      recipientEmail,
      gmailDraftId: gmailDraftId!,
    })
    if (requestErrors.length > 0) {
      return blockedResponse({
        message: `Explicit per-recipient Gmail send execution authorization is required. ${requestErrors[0]}`,
        blockers: requestErrors,
        status: 403,
        lifecycle,
        expectedAuthorization: expected,
      })
    }

    const now = new Date().toISOString()
    const claim = {
      version: 'warm-outreach-gmail-send-execution/v1',
      status: 'sending',
      provider: 'gmail_user_oauth',
      provider_action: 'drafts.send',
      contact_submission_id: item.contact_submission_id,
      outreach_queue_id: item.id,
      recipient_email: recipientEmail,
      connected_as: credential?.google_email ?? null,
      required_sender: requiredSender,
      gmail_draft_id: gmailDraftId,
      gmail_thread_id: stringValue(draftEvidence.thread_id) ?? item.thread_id,
      gmail_message_id: stringValue(draftEvidence.message_id) ?? item.message_id,
      authorization_decision_key: stringValue(authorization.decision_key),
      message_version_key: lifecycle.messageVersionKey,
      send_queue_idempotency_key: lifecycle.sendQueueIdempotencyKey,
      submitted_evidence_key: lifecycle.submittedEvidenceKey,
      idempotency_key: lifecycle.sendQueueIdempotencyKey,
      claimed_by: authResult.user.id,
      claimed_at: now,
      gmail_send_called: false,
      external_send_performed: false,
    }
    const history = Array.isArray(generationInputs.warm_gmail_send_execution_history)
      ? generationInputs.warm_gmail_send_execution_history
      : []

    const claimRes = await supabaseAdmin
      .from('outreach_queue')
      .update({
        generation_inputs: {
          ...generationInputs,
          warm_gmail_send_execution: claim,
          warm_gmail_send_execution_history: [claim, ...history].slice(0, 25),
        },
        updated_at: now,
      })
      .eq('id', item.id)
      .eq('status', 'approved')
      .select('id')
      .single()

    if (claimRes.error || !claimRes.data?.id) {
      return duplicateResponse({
        message: 'Warm Gmail send execution could not claim the approved row. No duplicate email was sent.',
        lifecycle,
        evidence: claim,
      })
    }

    let refreshToken: string
    try {
      refreshToken = decryptRefreshToken(
        credential!.refresh_token_cipher as string,
        credential!.refresh_token_iv as string,
        credential!.refresh_token_tag as string,
      )
    } catch (error) {
      console.error('[Warm Gmail send] decrypt failed:', error)
      await supabaseAdmin
        .from('outreach_queue')
        .update({
          status: 'approved',
          generation_inputs: {
            ...generationInputs,
            warm_gmail_send_execution: {
              ...claim,
              status: 'failed_before_provider_call',
              failed_at: new Date().toISOString(),
              failure_reason: 'Gmail refresh token could not be decrypted.',
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
      return blockedResponse({
        message: 'Warm Gmail send execution blocked. Reconnect Gmail and try again.',
        blockers: ['Gmail refresh token could not be decrypted.'],
        status: 500,
        lifecycle,
        expectedAuthorization: expected,
      })
    }

    let sentMessage: { id?: string; threadId?: string; labelIds?: string[] }
    try {
      sentMessage = await sendUserGmailDraft(refreshToken, gmailDraftId!)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown Gmail API error'
      console.error('[Warm Gmail send] Gmail API error:', error)
      await supabaseAdmin
        .from('outreach_queue')
        .update({
          status: 'approved',
          generation_inputs: {
            ...generationInputs,
            warm_gmail_send_execution: {
              ...claim,
              status: 'failed_provider_call',
              failed_at: new Date().toISOString(),
              failure_reason: detail,
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
      return blockedResponse({
        message: `Gmail could not send the authorized draft. ${detail}`,
        blockers: [detail],
        status: 502,
        lifecycle,
        expectedAuthorization: expected,
      })
    }

    const sentAt = new Date().toISOString()
    const finalEvidence = {
      ...claim,
      status: 'sent',
      gmail_message_id: sentMessage.id ?? claim.gmail_message_id,
      gmail_thread_id: sentMessage.threadId ?? claim.gmail_thread_id,
      gmail_label_ids: sentMessage.labelIds ?? [],
      sent_by: authResult.user.id,
      sent_at: sentAt,
      submitted_at: sentAt,
      gmail_send_called: true,
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
        thread_id: finalEvidence.gmail_thread_id,
        message_id: finalEvidence.gmail_message_id,
        generation_inputs: {
          ...generationInputs,
          warm_gmail_send_execution: finalEvidence,
          warm_gmail_send_execution_history: finalHistory,
        },
        updated_at: sentAt,
      })
      .eq('id', item.id)
      .select('id')
      .single()

    if (finalRes.error || !finalRes.data?.id) {
      return NextResponse.json(
        {
          version: 'warm-outreach-gmail-send-execution/v1',
          status: 'tracking_failed_after_send',
          message:
            'Gmail sent the authorized draft, but Portfolio could not persist final sent evidence. Repair tracking before any further send attempt.',
          gmailSendCalled: true,
          externalSendPerformed: true,
          sentEvidence: finalEvidence,
          executionBoundary: executionBoundary(true),
          providerExecutionReadiness: providerExecutionReadiness({
            enabled: true,
            lifecycle,
            state: 'tracking_failed_after_send',
            message:
              'Gmail sent the authorized draft, but Portfolio could not persist final sent evidence. Repair tracking before any further send attempt.',
          }),
        },
        { status: 502 },
      )
    }

    let communicationLog:
      | { status: 'recorded'; communicationId: string | null; message: string }
      | { status: 'repair_required'; communicationId: null; message: string; error: string }

    try {
      const communication = await logCommunication({
        contactSubmissionId: item.contact_submission_id,
        channel: 'email',
        direction: 'outbound',
        messageType: 'cold_outreach',
        subject: item.subject,
        body: String(item.body ?? ''),
        sourceSystem: 'outreach_queue',
        sourceId: item.id,
        status: 'sent',
        sentAt,
        sentBy: authResult.user.id,
        recipientEmail,
        emailTransport: 'gmail_smtp',
        metadata: {
          outreach_queue_id: item.id,
          gmail_user_draft_id: gmailDraftId,
          gmail_user_sent_message_id: finalEvidence.gmail_message_id,
          gmail_user_thread_id: finalEvidence.gmail_thread_id,
          gmail_connected_as: credential?.google_email ?? null,
          gmail_send_idempotency_key: lifecycle.sendQueueIdempotencyKey,
          submitted_evidence_key: lifecycle.submittedEvidenceKey,
          warm_gmail_send_authorization: authorization,
          warm_gmail_send_execution: finalEvidence,
        },
      })
      communicationLog = communication?.id
        ? {
            status: 'recorded',
            communicationId: communication.id,
            message: 'Secondary communication timeline log was recorded.',
          }
        : {
            status: 'repair_required',
            communicationId: null,
            message:
              'Gmail send succeeded and Portfolio queue evidence was recorded, but the secondary communication timeline log was not created. Repair the communication log from queue evidence; do not send this Gmail draft again.',
            error: 'logCommunication returned no communication id',
          }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown communication logging error'
      console.error('[Warm Gmail send] secondary communication log failed after sent evidence persisted:', error)
      communicationLog = {
        status: 'repair_required',
        communicationId: null,
        message:
          'Gmail send succeeded and Portfolio queue evidence was recorded, but the secondary communication timeline log failed. Repair the communication log from queue evidence; do not send this Gmail draft again.',
        error: detail,
      }
    }

    return NextResponse.json({
      version: 'warm-outreach-gmail-send-execution/v1',
      status: communicationLog.status === 'recorded'
        ? 'sent'
        : 'sent_secondary_log_repair_required',
      message: communicationLog.status === 'recorded'
        ? 'Authorized warm Gmail draft sent and Portfolio sent evidence was recorded.'
        : communicationLog.message,
      contactId: item.contact_submission_id,
      outreachQueueId: item.id,
      gmailDraftId,
      messageId: finalEvidence.gmail_message_id,
      threadId: finalEvidence.gmail_thread_id,
      sentAt,
      idempotency: {
        messageVersionKey: lifecycle.messageVersionKey,
        sendQueueIdempotencyKey: lifecycle.sendQueueIdempotencyKey,
        submittedEvidenceKey: lifecycle.submittedEvidenceKey,
      },
      gmailSendCalled: true,
      externalSendPerformed: true,
      sentEvidence: finalEvidence,
      communicationLog,
      executionBoundary: executionBoundary(true),
      providerExecutionReadiness: providerExecutionReadiness({
        enabled: true,
        lifecycle,
        state: communicationLog.status === 'recorded'
          ? 'sent'
          : 'sent_secondary_log_repair_required',
        message: communicationLog.status === 'recorded'
          ? 'Authorized warm Gmail draft sent and Portfolio sent evidence was recorded.'
          : communicationLog.message,
      }),
    })
  } catch (error) {
    console.error('POST /api/admin/outreach/[id]/gmail-user-send:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 },
    )
  }
}
