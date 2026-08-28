import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { decryptRefreshToken } from '@/lib/gmail-user-oauth-crypto'
import {
  createUserGmailDraft,
  isGmailUserOAuthClientConfigured,
} from '@/lib/gmail-user-api'
import { isGmailUserOauthSecretConfigured } from '@/lib/gmail-user-oauth-secret'
import { logCommunication } from '@/lib/communications'
import { resolveBusinessEmailConfig } from '@/lib/business-email-config'

export const dynamic = 'force-dynamic'

const MAX_BODY_CHARS = 500_000
const GMAIL_DRAFT_AUTHORIZATION = 'create_gmail_draft_for_recipient'

type RequestBody = {
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
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    if (
      !isGmailUserOAuthClientConfigured() ||
      !isGmailUserOauthSecretConfigured()
    ) {
      return NextResponse.json(
        { error: 'Gmail account connection is not configured for this site.' },
        { status: 503 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
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
      return NextResponse.json(
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
      return NextResponse.json(
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
      return NextResponse.json(
        { error: 'Outreach item not found.' },
        { status: 404 }
      )
    }

    if (item.status !== 'draft' && item.status !== 'approved') {
      return NextResponse.json(
        { error: 'Only draft or approved items can be saved to Gmail.' },
        { status: 400 }
      )
    }

    if (item.channel !== 'email') {
      return NextResponse.json(
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
      return NextResponse.json(
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
      return NextResponse.json(
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
      return NextResponse.json(
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
      return NextResponse.json(
        {
          error:
            'Relationship evidence is required before creating a Gmail draft for this warm outreach item.',
        },
        { status: 409 },
      )
    }

    const queueSubject = (item.subject as string | null)?.trim() ?? ''
    const queueBody = String(item.body ?? '')
    const subject =
      noSendSmoke && bodyInput.subject !== undefined
        ? bodyInput.subject.trim() || '(no subject)'
        : queueSubject || '(no subject)'
    const bodyText =
      noSendSmoke && bodyInput.body !== undefined ? bodyInput.body : queueBody

    if (bodyText.length > MAX_BODY_CHARS) {
      return NextResponse.json(
        {
          error:
            'Message is too long. Shorten it or save a smaller copy from the preview.',
        },
        { status: 400 }
      )
    }

    if (noSendSmoke) {
      return NextResponse.json({
        message:
          'No-send Gmail draft smoke passed. No Gmail draft was created and no email was sent.',
        noSendSmoke: true,
        wouldCreateDraft: true,
        queueId: item.id,
        to,
        subject,
        bodyChars: bodyText.length,
        requiredSender,
        connectedAs: creds.google_email,
        expectedAuthorization: {
          createGmailDraft: true,
          draftAuthorization: GMAIL_DRAFT_AUTHORIZATION,
          contactSubmissionId: item.contact_submission_id,
          recipientEmail: to,
          channel: item.channel,
          idempotencyKey: buildGmailDraftIdempotencyKey({
            queueId: item.id,
            contactSubmissionId: item.contact_submission_id,
            channel: item.channel,
          }),
        },
        externalSendBlocked: true,
      })
    }

    const expectedIdempotencyKey = buildGmailDraftIdempotencyKey({
      queueId: item.id,
      contactSubmissionId: item.contact_submission_id,
      channel: item.channel,
    })
    const authorizationErrors = [
      bodyInput.createGmailDraft === true ? null : 'createGmailDraft must be true.',
      bodyInput.draftAuthorization === GMAIL_DRAFT_AUTHORIZATION
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
      return NextResponse.json(
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
      return NextResponse.json(
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
    if (existing || item.thread_id || item.message_id) {
      return NextResponse.json({
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
      return NextResponse.json(
        { error: 'Something went wrong. Reconnect Gmail and try again.' },
        { status: 500 },
      )
    }

    let draft: { id: string; messageId?: string; threadId?: string }
    try {
      draft = await createUserGmailDraft(refreshToken, {
        to,
        subject,
        body: bodyText,
      })
    } catch (e) {
      console.error('[Gmail user draft] API error:', e)
      return NextResponse.json(
        {
          error:
            'Gmail could not create the draft. Try reconnecting your Gmail account.',
        },
        { status: 502 }
      )
    }

    if (!draft.threadId) {
      console.error('[Gmail user draft] Gmail API returned no thread id:', {
        outreach_queue_id: item.id,
        gmail_user_draft_id: draft.id,
        gmail_user_message_id: draft.messageId,
      })
      return NextResponse.json(
        {
          error:
            'Gmail created the draft, but did not return a thread id. Reply tracking is not safe for this draft.',
        },
        { status: 502 }
      )
    }

    const now = new Date().toISOString()
    const generationInputs = metadataRecord(item.generation_inputs)
    const gmailDraftCreation = {
      provider: 'gmail_user_oauth',
      provider_action: 'drafts.create',
      draft_id: draft.id,
      message_id: draft.messageId ?? null,
      thread_id: draft.threadId,
      connected_as: creds.google_email,
      required_sender: requiredSender,
      recipient_email: to,
      idempotency_key: expectedIdempotencyKey,
      authorization: GMAIL_DRAFT_AUTHORIZATION,
      authorized_by: authResult.user.id,
      created_at: now,
      external_send_blocked: true,
    }
    const { error: trackingError } = await supabaseAdmin
      .from('outreach_queue')
      .update({
        thread_id: draft.threadId,
        message_id: draft.messageId ?? null,
        generation_inputs: {
          ...generationInputs,
          gmail_draft_creation: gmailDraftCreation,
        },
        updated_at: now,
      })
      .eq('id', item.id)

    if (trackingError) {
      console.error('[Gmail user draft] failed to persist tracking:', trackingError)
      return NextResponse.json(
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
        gmail_user_draft_id: draft.id,
        gmail_user_message_id: draft.messageId,
        gmail_user_thread_id: draft.threadId,
        gmail_connected_as: creds.google_email,
        gmail_draft_idempotency_key: expectedIdempotencyKey,
        warm_outreach_gmail_draft_authorization: {
          idempotency_key: expectedIdempotencyKey,
          authorization: GMAIL_DRAFT_AUTHORIZATION,
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

    return NextResponse.json({
      message:
        'Draft saved in Gmail for review. No email was sent; sending remains blocked.',
      draftId: draft.id,
      messageId: draft.messageId ?? null,
      threadId: draft.threadId,
      openGmailUrl: 'https://mail.google.com/mail/#drafts',
      idempotencyKey: expectedIdempotencyKey,
      gmailDraftCreated: true,
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
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
