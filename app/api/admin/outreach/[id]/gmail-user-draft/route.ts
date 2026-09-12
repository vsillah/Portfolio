import { CONFIRMED_PREFLIGHT_REJECTION } from '@/lib/warm-outreach-action-outcome'
import { validateGmailMessageHeaders } from '@/lib/gmail-message-copy'
import { warmFinalCopyFingerprint } from '@/lib/warm-outreach-copy-fingerprint'
import { warmCopyBlocker, warmCopyEvidenceBlocker } from '@/lib/warm-outreach-copy-quality'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { decryptRefreshToken } from '@/lib/gmail-user-oauth-crypto'
import {
  createUserGmailDraft,
  updateUserGmailDraft,
  isGmailUserOAuthClientConfigured,
} from '@/lib/gmail-user-api'
import { isGmailUserOauthSecretConfigured } from '@/lib/gmail-user-oauth-secret'
import { logCommunication } from '@/lib/communications'
import { resolveBusinessEmailConfig } from '@/lib/business-email-config'

export const dynamic = 'force-dynamic'

const MAX_BODY_CHARS = 500_000
const GMAIL_DRAFT_AUTHORIZATION = 'create_gmail_draft_for_recipient'

type RequestBody = {
  prepareDraftUpdate?: boolean
  updateGmailDraft?: boolean
  gmailDraftId?: string
  expectedUpdatedAt?: string
  finalCopyFingerprint?: string
  subject?: string
  body?: string
  noSendSmoke?: boolean
  dryRun?: boolean
  smokeMode?: boolean
  createGmailDraft?: boolean
  draftAuthorization?: string
  idempotencyKey?: string
  recipientEmail?: string
  contactSubmissionId?: string | number
  channel?: string
}

type MetadataRecord = Record<string, unknown>

function metadataRecord(value: unknown): MetadataRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as MetadataRecord)
    : {}
}

function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function buildGmailDraftIdempotencyKey(input: {
  queueId: string
  contactSubmissionId: number | string
  channel: string
}) {
  return [
    'warm-outreach',
    'gmail-draft',
    'v1',
    input.queueId,
    String(input.contactSubmissionId),
    input.channel,
  ].join(':')
}

function providerDraftCanaryReadiness(input: {
  queueId: string
  contactSubmissionId: number | string
  recipientEmail: string
  channel: string
  requiredSender: string
  connectedAs: string
  expectedUpdatedAt: string
  finalCopyFingerprint: string
}) {
  const expectedAuthorization = {
    expectedUpdatedAt: input.expectedUpdatedAt,
    finalCopyFingerprint: input.finalCopyFingerprint,
    createGmailDraft: true,
    draftAuthorization: GMAIL_DRAFT_AUTHORIZATION,
    contactSubmissionId: input.contactSubmissionId,
    recipientEmail: input.recipientEmail,
    channel: input.channel,
    idempotencyKey: buildGmailDraftIdempotencyKey({
      queueId: input.queueId,
      contactSubmissionId: input.contactSubmissionId,
      channel: input.channel,
    }),
  }

  return {
    version: 'warm-outreach-provider-gmail-draft-canary-readiness/v1',
    state: 'ready_for_explicit_provider_draft_approval',
    label: 'Provider draft canary ready',
    queueId: input.queueId,
    contactSubmissionId: input.contactSubmissionId,
    recipientEmail: input.recipientEmail,
    requiredSender: input.requiredSender,
    connectedAs: input.connectedAs,
    expectedAuthorization,
    exactApprovalSentence:
      `Create one Gmail provider draft for outreach queue ${input.queueId} and contact ${input.contactSubmissionId} using authorization ${GMAIL_DRAFT_AUTHORIZATION}. Do not send email.`,
    executionBoundary: {
      providerCallsEnabled: false,
      gmailDraftCreated: false,
      trackingPersisted: false,
      externalSendEnabled: false,
      liveProviderCallRequiresSeparateApproval: true,
    },
  }
}

function hasSuppressedStatus(row: unknown): boolean {
  const record = metadataRecord(row)
  const metadata = metadataRecord(record.metadata)
  const status = String(record.status ?? '').toLowerCase()
  const outreachStatus = String(record.outreach_status ?? '').toLowerCase()
  const metadataStatus = String(metadata.status ?? '').toLowerCase()
  return Boolean(
    record.do_not_contact === true ||
      record.unsubscribed === true ||
      record.email_unsubscribed === true ||
      record.suppressed === true ||
      metadata.do_not_contact === true ||
      metadata.unsubscribed === true ||
      metadata.suppressed === true ||
      status === 'opted_out' ||
      status === 'unsubscribed' ||
      status === 'suppressed' ||
      outreachStatus === 'opted_out' ||
      outreachStatus === 'unsubscribed' ||
      outreachStatus === 'suppressed' ||
      metadataStatus === 'opted_out' ||
      metadataStatus === 'unsubscribed' ||
      metadataStatus === 'suppressed',
  )
}

function hasRelationshipEvidence(input: {
  contact: MetadataRecord
  item: MetadataRecord
  contactCommunications: MetadataRecord[]
  emailMessages: MetadataRecord[]
}) {
  const leadSource = String(input.contact.lead_source ?? '').toLowerCase()
  const generationInputs = metadataRecord(input.item.generation_inputs)
  return Boolean(
    String(input.contact.relationship_strength ?? '').trim() ||
      String(input.contact.warm_source_detail ?? '').trim() ||
      /warm|referral|meeting|client|google_contacts|linkedin|facebook/.test(leadSource) ||
      metadataRecord(generationInputs.warm_relationship).version ===
        'warm-outreach-relationship/v1' ||
      input.contactCommunications.length > 0 ||
      input.emailMessages.length > 0,
  )
}

function existingDraftEvidence(
  rows: MetadataRecord[],
  expectedIdempotencyKey: string,
): {
  draftId: string | null
  messageId: string | null
  threadId: string | null
  communicationId: string | null
} | null {
  for (const row of rows) {
    const metadata = metadataRecord(row.metadata)
    const authorization = metadataRecord(
      metadata.warm_outreach_gmail_draft_authorization,
    )
    const idempotencyKey =
      String(metadata.gmail_draft_idempotency_key ?? '') ||
      String(authorization.idempotency_key ?? '')
    const draftId = String(metadata.gmail_user_draft_id ?? '')
    if (idempotencyKey === expectedIdempotencyKey && draftId) {
      return {
        draftId,
        messageId: String(metadata.gmail_user_message_id ?? '') || null,
        threadId: String(metadata.gmail_user_thread_id ?? '') || null,
        communicationId: String(row.id ?? '') || null,
      }
    }
  }
  return null
}

function duplicateDraftResponse(input: {
  draftId: string | null
  messageId: string | null
  threadId: string | null
  communicationId: string | null
  idempotencyKey: string
  duplicatePrevented: boolean
}) {
  return {
    duplicateDraftEvidence: {
      createdOnce: Boolean(input.draftId || input.messageId || input.threadId),
      duplicatePrevented: input.duplicatePrevented,
      draftId: input.draftId,
      messageId: input.messageId,
      threadId: input.threadId,
      communicationId: input.communicationId,
      idempotencyKey: input.idempotencyKey,
      noSendStatus: 'no_send',
    },
    operatingLoopTransition: {
      state: 'draft_created',
      nextState: 'send_approval_requested',
      nextAction: 'request_send_approval',
      gmailSendCalled: false,
    },
    externalSendBlocked: true,
    externalSendEnabled: false,
  }
}

function parseBody(raw: unknown): RequestBody {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const o = raw as Record<string, unknown>
  return {
    prepareDraftUpdate: o.prepareDraftUpdate === true,
    updateGmailDraft: o.updateGmailDraft === true,
    gmailDraftId: typeof o.gmailDraftId === 'string' ? o.gmailDraftId : undefined,
    expectedUpdatedAt: typeof o.expectedUpdatedAt === 'string' ? o.expectedUpdatedAt : undefined,
    finalCopyFingerprint: typeof o.finalCopyFingerprint === 'string' ? o.finalCopyFingerprint : undefined,
    subject: typeof o.subject === 'string' ? o.subject : undefined,
    body: typeof o.body === 'string' ? o.body : undefined,
    noSendSmoke: o.noSendSmoke === true,
    dryRun: o.dryRun === true,
    smokeMode: o.smokeMode === true,
    createGmailDraft: o.createGmailDraft === true,
    draftAuthorization:
      typeof o.draftAuthorization === 'string' ? o.draftAuthorization : undefined,
    idempotencyKey:
      typeof o.idempotencyKey === 'string' ? o.idempotencyKey : undefined,
    recipientEmail: typeof o.recipientEmail === 'string' ? o.recipientEmail : undefined,
    contactSubmissionId:
      typeof o.contactSubmissionId === 'string' ||
      typeof o.contactSubmissionId === 'number'
        ? o.contactSubmissionId
        : undefined,
    channel: typeof o.channel === 'string' ? o.channel : undefined,
  }
}

/**
 * POST /api/admin/outreach/[id]/gmail-user-draft
 * Creates a draft in the admin's own Gmail (OAuth), addressed to the lead.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let confirmedPreflight = true
  const json = (body: Record<string, unknown>, init?: { status?: number }) => NextResponse.json({ ...body,
    ...(confirmedPreflight && (init?.status ?? 200) >= 400 ? { actionOutcome: CONFIRMED_PREFLIGHT_REJECTION } : {}),
  }, init)
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    if (
      !isGmailUserOAuthClientConfigured() ||
      !isGmailUserOauthSecretConfigured()
    ) {
      return json(
        { error: 'Gmail account connection is not configured for this site.' },
        { status: 503 }
      )
    }

    if (!supabaseAdmin) {
      return json(
        { error: 'Something went wrong. Please try again.' },
        { status: 500 }
      )
    }

    const { id } = await params

    let bodyInput: RequestBody = {}
    try {
      const raw = await request.json()
      bodyInput = parseBody(raw)
    } catch {
      // use DB only
    }
    const noSendSmoke =
      bodyInput.noSendSmoke === true ||
      bodyInput.dryRun === true ||
      bodyInput.smokeMode === true

    const { data: creds, error: credsError } = await supabaseAdmin
      .from('admin_gmail_user_credentials')
      .select(
        'refresh_token_cipher, refresh_token_iv, refresh_token_tag, google_email'
      )
      .eq('user_id', authResult.user.id)
      .maybeSingle()

    if (credsError || !creds) {
      return json(
        {
          error:
            'Connect your Gmail account first (admin: Google sign-in for Gmail drafts).',
        },
        { status: 400 }
      )
    }

    const requiredSender = resolveBusinessEmailConfig().fromEmail.toLowerCase()
    const connectedEmail = String(creds.google_email ?? '').trim().toLowerCase()
    if (connectedEmail !== requiredSender) {
      return json(
        {
          error: `Customer-facing Gmail drafts must be created from ${requiredSender}. Reconnect Gmail with that account before saving this draft.`,
        },
        { status: 400 }
      )
    }

    const { data: item, error: fetchError } = await supabaseAdmin
      .from('outreach_queue')
      .select(
        `
        *,
        contact_submissions (
          id,
          name,
          email,
          company,
          lead_source,
          outreach_status,
          do_not_contact,
          removed_at,
          relationship_strength,
          warm_source_detail
        )
      `
      )
      .eq('id', id)
      .single()

    if (fetchError || !item) {
      return json(
        { error: 'Outreach item not found.' },
        { status: 404 }
      )
    }

    if (item.sent_at || ['queued', 'sent'].includes(item.status) || warmCopyEvidenceBlocker(item.generation_inputs)) confirmedPreflight = false
    if (item.status !== 'approved') {
      return json(
        { error: 'Approve final copy before creating a Gmail draft.' },
        { status: 400 }
      )
    }

    if (item.channel !== 'email') {
      return json(
        { error: 'Only email channel drafts can be saved to Gmail as mail drafts.' },
        { status: 400 }
      )
    }

    const contact = item.contact_submissions as
      | {
          id: number
          name: string
          email: string
          company: string | null
          lead_source?: string | null
          outreach_status?: string | null
          do_not_contact?: boolean
          removed_at?: string | null
          relationship_strength?: string | null
          warm_source_detail?: string | null
        }
      | null
    const to = contact?.email?.trim()
    if (!to?.includes('@')) {
      return json(
        { error: 'This lead has no email address.' },
        { status: 400 }
      )
    }

    const [contactCommunicationsRes, emailMessagesRes, existingDraftsRes] =
      await Promise.all([
        supabaseAdmin
          .from('contact_communications')
          .select('id, status, metadata, created_at')
          .eq('contact_submission_id', item.contact_submission_id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabaseAdmin
          .from('email_messages')
          .select('id, status, metadata, created_at')
          .eq('contact_submission_id', item.contact_submission_id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabaseAdmin
          .from('contact_communications')
          .select('id, metadata, created_at')
          .eq('source_system', 'outreach_queue')
          .eq('source_id', item.id)
          .eq('status', 'draft')
          .order('created_at', { ascending: false })
          .limit(10),
      ])

    const contactCommunications = Array.isArray(contactCommunicationsRes.data)
      ? (contactCommunicationsRes.data as MetadataRecord[])
      : []
    const emailMessages = Array.isArray(emailMessagesRes.data)
      ? (emailMessagesRes.data as MetadataRecord[])
      : []
    if (contactCommunicationsRes.error || emailMessagesRes.error) {
      return json(
        { error: 'Could not verify relationship and suppression state.' },
        { status: 503 },
      )
    }

    if (
      contact?.do_not_contact ||
      contact?.removed_at ||
      hasSuppressedStatus(contact) ||
      contactCommunications.some(hasSuppressedStatus) ||
      emailMessages.some(hasSuppressedStatus)
    ) {
      return json(
        { error: 'This contact is suppressed or blocked from outreach.' },
        { status: 409 },
      )
    }

    if (
      !hasRelationshipEvidence({
        contact: metadataRecord(contact),
        item: metadataRecord(item),
        contactCommunications,
        emailMessages,
      })
    ) {
      return json(
        {
          error:
            'Relationship evidence is required before creating a Gmail draft for this warm outreach item.',
        },
        { status: 409 },
      )
    }

    const revising = bodyInput.prepareDraftUpdate === true || bodyInput.updateGmailDraft === true
    const previousDraft = metadataRecord(item.generation_inputs?.gmail_draft_creation)
    if (revising && (!previousDraft.draft_id || !previousDraft.thread_id || item.sent_at || item.generation_inputs?.copy_revision_requires_provider_reconciliation !== true)) return json({ error: 'Only a known tracked unsent mailbox draft with approved revised copy can be updated.' }, { status: 409 })
    if (item.generation_inputs?.copy_revision_requires_provider_reconciliation === true && !revising) {
      return json({ error: 'Copy changed after the mailbox draft was created. Reconcile or replace that draft before continuing.' }, { status: 409 })
    }
    try { validateGmailMessageHeaders(to, item.subject ?? '') }
    catch (error) { return json({ error: error instanceof Error ? error.message : 'Invalid reviewed headers.' }, { status: 409 }) }
    const copyBlocker = warmCopyBlocker(item.body) ?? warmCopyEvidenceBlocker(item.generation_inputs)
    if (copyBlocker) return json({ error: copyBlocker }, { status: 409 })

    const fingerprint = warmFinalCopyFingerprint(item)
    if (!item.updated_at) return json({ error: 'Reload a versioned message before creating a mailbox draft.' }, { status: 409 })
    if ((bodyInput.subject !== undefined && bodyInput.subject !== (item.subject ?? '')) ||
      (bodyInput.body !== undefined && bodyInput.body !== (item.body ?? ''))) {
      return json({ error: 'Save and review copy changes before preparing a mailbox draft.' }, { status: 409 })
    }
    const subject = (item.subject as string | null) ?? ''
    const bodyText = String(item.body ?? '')

    if (bodyText.length > MAX_BODY_CHARS) {
      return json(
        {
          error:
            'Message is too long. Shorten it or save a smaller copy from the preview.',
        },
        { status: 400 }
      )
    }

    if (noSendSmoke) {
      const readiness = providerDraftCanaryReadiness({
        queueId: item.id,
        contactSubmissionId: item.contact_submission_id,
        recipientEmail: to,
        channel: item.channel,
        requiredSender,
        connectedAs: creds.google_email,
        expectedUpdatedAt: item.updated_at,
        finalCopyFingerprint: fingerprint,
      })

      if (revising) {
        readiness.label = 'Mailbox draft update ready'
        readiness.exactApprovalSentence = 'Update this known Gmail draft with the approved revised copy. Do not send email.'
        Object.assign(readiness.expectedAuthorization, { createGmailDraft: false, updateGmailDraft: true, gmailDraftId: previousDraft.draft_id, draftAuthorization: 'update_gmail_draft_for_recipient' })
      }
      return json({
        message:
          'No-send Gmail draft smoke passed. No Gmail draft was created and no email was sent.',
        reviewedCopy: { queueId: item.id, recipientEmail: to, subject, body: bodyText, sender: requiredSender, updatedAt: item.updated_at },
        noSendSmoke: true,
        wouldCreateDraft: !revising,
        ...(revising ? { wouldUpdateDraft: true } : {}),
        queueId: item.id,
        to,
        subject,
        bodyChars: bodyText.length,
        requiredSender,
        connectedAs: creds.google_email,
        expectedAuthorization: readiness.expectedAuthorization,
        providerDraftCanaryReadiness: readiness,
        externalSendBlocked: true,
      })
    }

    const expectedIdempotencyKey = buildGmailDraftIdempotencyKey({
      queueId: item.id,
      contactSubmissionId: item.contact_submission_id,
      channel: item.channel,
    })
    const authorizationErrors = [
      bodyInput.expectedUpdatedAt === item.updated_at ? null : 'Reviewed row version is stale.',
      bodyInput.finalCopyFingerprint === fingerprint ? null : 'Reviewed final copy is stale.',
      (revising ? bodyInput.updateGmailDraft === true && bodyInput.gmailDraftId === previousDraft.draft_id : bodyInput.createGmailDraft === true) ? null : 'Explicit mailbox action and tracked draft identity are required.',
      bodyInput.draftAuthorization === (revising ? 'update_gmail_draft_for_recipient' : GMAIL_DRAFT_AUTHORIZATION)
        ? null
        : `draftAuthorization must be ${GMAIL_DRAFT_AUTHORIZATION}.`,
      bodyInput.idempotencyKey === expectedIdempotencyKey
        ? null
        : 'idempotencyKey does not match this contact, channel, and message row.',
      String(bodyInput.contactSubmissionId ?? '') === String(item.contact_submission_id)
        ? null
        : 'contactSubmissionId does not match this outreach item.',
      normalizeEmail(bodyInput.recipientEmail) === normalizeEmail(to)
        ? null
        : 'recipientEmail does not match this outreach item.',
      bodyInput.channel === item.channel ? null : 'channel does not match this outreach item.',
    ].filter(Boolean) as string[]
    if (authorizationErrors.length > 0) {
      return json(
        {
          error:
            'Explicit per-recipient Gmail draft authorization is required before creating a provider draft.',
          authorizationErrors,
          externalSendBlocked: true,
        },
        { status: 403 },
      )
    }

    if (existingDraftsRes.error) {
      return json(
        { error: 'Could not verify existing Gmail draft state.' },
        { status: 503 },
      )
    }

    const existingDraftRows = Array.isArray(existingDraftsRes.data)
      ? (existingDraftsRes.data as MetadataRecord[])
      : []
    const existing = existingDraftEvidence(
      existingDraftRows,
      expectedIdempotencyKey,
    )
    if (!revising && (existing || item.thread_id || item.message_id || item.generation_inputs?.gmail_draft_creation)) {
      if (item.generation_inputs?.gmail_draft_creation?.final_copy_fingerprint !== fingerprint) {
        return json({ error: 'Existing mailbox draft is not bound to this exact copy. Reconcile it before continuing.' }, { status: 409 })
      }
      return json({
        message:
          'Gmail draft already exists for this recipient and message. No new draft was created.',
        existingDraft: true,
        duplicatePrevented: true,
        draftId: existing?.draftId ?? null,
        threadId: existing?.threadId ?? item.thread_id ?? null,
        messageId: existing?.messageId ?? item.message_id ?? null,
        communicationId: existing?.communicationId ?? null,
        idempotencyKey: expectedIdempotencyKey,
        ...duplicateDraftResponse({
          draftId: existing?.draftId ?? null,
          threadId: existing?.threadId ?? item.thread_id ?? null,
          messageId: existing?.messageId ?? item.message_id ?? null,
          communicationId: existing?.communicationId ?? null,
          idempotencyKey: expectedIdempotencyKey,
          duplicatePrevented: true,
        }),
      })
    }

    let refreshToken: string
    try {
      refreshToken = decryptRefreshToken(
        creds.refresh_token_cipher as string,
        creds.refresh_token_iv as string,
        creds.refresh_token_tag as string,
      )
    } catch (e) {
      console.error('[Gmail user draft] decrypt failed:', e)
      return json(
        { error: 'Something went wrong. Reconnect Gmail and try again.' },
        { status: 500 },
      )
    }

    const generationInputs = metadataRecord(item.generation_inputs)
    const claimedAt = new Date(Math.max(Date.now(), Date.parse(item.updated_at) + 1)).toISOString()
    const attempt = { status: revising ? 'updating' : 'creating', action: revising ? 'update' : 'create', draft_id: revising ? previousDraft.draft_id : null, final_copy_fingerprint: fingerprint, started_at: claimedAt, authorized_by: authResult.user.id }
    confirmedPreflight = false
    const { data: claimed, error: claimError } = await supabaseAdmin.from('outreach_queue')
      .update({ generation_inputs: { ...generationInputs, warm_gmail_draft_creation_attempt: attempt }, updated_at: claimedAt })
      .eq('id', item.id).eq('status', item.status).eq('updated_at', item.updated_at).select('id, updated_at')
    if (!claimError && !claimed?.length) return NextResponse.json({ error: 'The draft changed before the mailbox action. Refresh and review it again.', actionOutcome: CONFIRMED_PREFLIGHT_REJECTION }, { status: 409 })
    if (claimError || !claimed?.[0]?.updated_at) return json({ error: 'Mailbox draft claim was not confirmed. Reload and reconcile before retrying.' }, { status: 409 })
    const claimVersion = claimed[0].updated_at
    const markUnknown = async () => {
      try {
        await supabaseAdmin!.from('outreach_queue')
        .update({ generation_inputs: { ...generationInputs, warm_gmail_draft_creation_attempt: { ...attempt, status: 'outcome_unknown' } }, updated_at: new Date(Math.max(Date.now(), Date.parse(claimVersion) + 1)).toISOString() })
        .eq('id', item.id).eq('status', item.status).eq('updated_at', claimVersion).select('id')
      } catch {
        // The durable creating claim still prevents retry when the uncertainty update fails.
        console.error('[Gmail user draft] uncertainty tracking unavailable; claim retained')
      }
    }
    let draft: { id: string; messageId?: string; threadId?: string }
    try {
      draft = revising
        ? await updateUserGmailDraft(refreshToken, String(previousDraft.draft_id), { to, subject, body: bodyText })
        : await createUserGmailDraft(refreshToken, { to, subject, body: bodyText })
    } catch (e) {
      console.error('[Gmail user draft] API error:', e)
      await markUnknown()
      return json(
        {
          error:
            'Gmail draft outcome is unknown. Reconcile the mailbox before retrying; another draft will not be created automatically.',
        },
        { status: 502 }
      )
    }

    if (!draft?.id || !draft.threadId) {
      await markUnknown()
      console.error('[Gmail user draft] Gmail API returned no thread id:', {
        outreach_queue_id: item.id,
        gmail_user_draft_id: draft?.id,
        gmail_user_message_id: draft?.messageId,
      })
      return json(
        {
          error:
            'Gmail returned incomplete draft evidence. Reconcile the mailbox before retrying; creation outcome is unknown.',
        },
        { status: 502 }
      )
    }

    const now = new Date(Math.max(Date.now(), Date.parse(claimVersion) + 1)).toISOString()
    const gmailDraftCreation = {
      final_copy_fingerprint: fingerprint,
      provider: 'gmail_user_oauth',
      provider_action: revising ? 'drafts.update' : 'drafts.create',
      draft_id: draft.id,
      message_id: draft.messageId ?? null,
      thread_id: draft.threadId,
      connected_as: creds.google_email,
      required_sender: requiredSender,
      recipient_email: to,
      idempotency_key: expectedIdempotencyKey,
      authorization: revising ? 'update_gmail_draft_for_recipient' : GMAIL_DRAFT_AUTHORIZATION,
      authorized_by: authResult.user.id,
      created_at: now,
      external_send_blocked: true,
    }
    const revisionReset = revising ? {
      copy_revision_requires_provider_reconciliation: false,
      warm_gmail_send_authorization: null,
      warm_gmail_send_slack_approval_request: null,
      warm_gmail_review_slack_delivery: null,
      warm_gmail_send_execution: null,
      warm_gmail_mailbox_revision_history: [{
        previous_draft: previousDraft,
        copy_revision_history: generationInputs.warm_gmail_copy_revision_history ?? [],
        authorization: generationInputs.warm_gmail_send_authorization ?? null,
        approval_request: generationInputs.warm_gmail_send_slack_approval_request ?? null,
        slack_delivery: generationInputs.warm_gmail_review_slack_delivery ?? null,
        send_execution: generationInputs.warm_gmail_send_execution ?? null,
        updated_at: now,
      }, ...(Array.isArray(generationInputs.warm_gmail_mailbox_revision_history) ? generationInputs.warm_gmail_mailbox_revision_history : [])].slice(0, 25),
    } : {}
    const { data: tracked, error: trackingError } = await supabaseAdmin
      .from('outreach_queue')
      .update({
        thread_id: draft.threadId,
        message_id: draft.messageId ?? null,
        generation_inputs: {
          ...generationInputs,
          ...revisionReset,
          gmail_draft_creation: gmailDraftCreation,
          warm_gmail_draft_creation_attempt: { ...attempt, status: 'tracked' },
        },
        updated_at: now,
      })
      .eq('id', item.id).eq('status', item.status).eq('updated_at', claimVersion).select('id, updated_at')

    if (trackingError || !tracked?.length) {
      console.error('[Gmail user draft] failed to persist tracking:', trackingError)
      return json(
        {
          error:
            'Gmail created the draft, but Portfolio could not save thread tracking. Do not send this draft from Gmail until tracking is repaired.',
        },
        { status: 502 }
      )
    }

    void logCommunication({
      contactSubmissionId: item.contact_submission_id,
      channel: 'email',
      direction: 'outbound',
      messageType: 'manual',
      subject,
      body: bodyText.slice(0, 8000),
      sourceSystem: 'outreach_queue',
      sourceId: item.id,
      status: 'draft',
      sentBy: authResult.user.id,
      emailTransport: 'logged_only',
      recipientEmail: to,
      metadata: {
        outreach_queue_id: item.id,
        gmail_user_draft_id: draft?.id,
        gmail_user_message_id: draft?.messageId,
        gmail_user_thread_id: draft.threadId,
        gmail_connected_as: creds.google_email,
        gmail_draft_idempotency_key: expectedIdempotencyKey,
        warm_outreach_gmail_draft_authorization: {
          final_copy_fingerprint: fingerprint,
          idempotency_key: expectedIdempotencyKey,
          authorization: revising ? 'update_gmail_draft_for_recipient' : GMAIL_DRAFT_AUTHORIZATION,
          contact_submission_id: item.contact_submission_id,
          recipient_email: to,
          channel: item.channel,
          authorized_by: authResult.user.id,
          authorized_at: now,
          external_send_blocked: true,
        },
        external_send_blocked: true,
      },
    })

    return json({
      message: revising ? 'Gmail draft updated with approved revised copy. Previous authorization is invalidated; prepare a fresh review request.' : 'Draft saved in Gmail for review. No email was sent; sending remains blocked.',
      draftId: draft.id,
      messageId: draft.messageId ?? null,
      threadId: draft.threadId,
      openGmailUrl: 'https://mail.google.com/mail/#drafts',
      idempotencyKey: expectedIdempotencyKey,
      gmailDraftCreated: !revising,
      gmailDraftUpdated: revising,
      ...duplicateDraftResponse({
        draftId: draft.id,
        messageId: draft.messageId ?? null,
        threadId: draft.threadId,
        communicationId: null,
        idempotencyKey: expectedIdempotencyKey,
        duplicatePrevented: false,
      }),
    })
  } catch (error) {
    console.error('POST /api/admin/outreach/[id]/gmail-user-draft:', error)
    return json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
