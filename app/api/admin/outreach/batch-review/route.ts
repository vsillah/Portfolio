import { NextRequest, NextResponse } from 'next/server'

import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildWarmBatchReview,
  hasSuppressedWarmBatchStatus,
  parseWarmBatchContactIds,
  rowContactId,
  type WarmBatchReview,
  type WarmBatchReviewContactInput,
  type WarmBatchReviewRecipient,
  type WarmPlannedDraftActionRow,
  type WarmPlannedDraftExecutionRecord,
} from '@/lib/warm-outreach-batch-review'
import type { WarmOutreachSourceInventoryRows } from '@/lib/warm-outreach-source-inventory'
import { warmOutreachChannels, type WarmOutreachChannel } from '@/lib/warm-outreach-relationship-intelligence'

export const dynamic = 'force-dynamic'

const MAX_BATCH_RECIPIENTS = 50
const DEFAULT_OBJECTIVE =
  'Review selected warm outreach recipients before any individualized draft generation.'
const CHANNELS = new Set<string>(warmOutreachChannels)
const EXECUTE_PLANNED_ACTION = 'create_planned_draft_handoff_records'
const CREATE_GMAIL_RECORDS_ACTION = 'create_gmail_draft_records'

type PortfolioRow = NonNullable<WarmOutreachSourceInventoryRows['contactSubmission']>

function parsePreferredChannel(value: unknown): WarmOutreachChannel | undefined {
  return typeof value === 'string' && CHANNELS.has(value)
    ? value as WarmOutreachChannel
    : undefined
}

function groupByContactId(rows: PortfolioRow[] | null | undefined): Map<number, PortfolioRow[]> {
  const grouped = new Map<number, PortfolioRow[]>()
  for (const row of rows ?? []) {
    const id = rowContactId(row)
    if (!id) continue
    const list = grouped.get(id) ?? []
    list.push(row)
    grouped.set(id, list)
  }
  return grouped
}

function rowsFor(grouped: Map<number, PortfolioRow[]>, contactId: number): PortfolioRow[] {
  return grouped.get(contactId) ?? []
}

function withSuppressionFromRelatedRows(contact: PortfolioRow, relatedRows: PortfolioRow[]) {
  const suppressed = relatedRows.some(hasSuppressedWarmBatchStatus)
  if (!suppressed) return contact
  return {
    ...contact,
    unsubscribed: true,
    suppression_reason:
      'A selected local Portfolio communication, email, or queue row is unsubscribed, opted-out, or suppressed.',
  }
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function rowText(row: PortfolioRow, key: string): string | null {
  const value = (row as Record<string, unknown>)[key]
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function appendRowsToContactInputs(
  contactInputs: WarmBatchReviewContactInput[],
  appended: {
    outreachQueue: PortfolioRow[]
    actionTasks: PortfolioRow[]
  },
): WarmBatchReviewContactInput[] {
  const outreachByContact = groupByContactId(appended.outreachQueue)
  const tasksByContact = groupByContactId(appended.actionTasks)

  return contactInputs.map((input) => {
    const contactId = Number(input.contact.id)
    const outreachRows = [
      ...(input.rows.outreachQueue ?? []),
      ...rowsFor(outreachByContact, contactId),
    ]
    const actionTasks = [
      ...(input.rows.actionTasks ?? []),
      ...rowsFor(tasksByContact, contactId),
    ]

    return {
      ...input,
      rows: {
        ...input.rows,
        outreachQueue: outreachRows,
        actionTasks,
      },
      existingOutreachRows: [
        ...(input.existingOutreachRows ?? []),
        ...rowsFor(outreachByContact, contactId),
      ],
    }
  })
}

function recipientFor(review: WarmBatchReview, row: WarmPlannedDraftActionRow): WarmBatchReviewRecipient | null {
  return review.recipients.find((recipient) => recipient.contactId === row.contactId) ?? null
}

function existingManualTask(
  contactInputs: WarmBatchReviewContactInput[],
  row: WarmPlannedDraftActionRow,
): PortfolioRow | null {
  const input = contactInputs.find((entry) => Number(entry.contact.id) === row.contactId)
  const match = (input?.rows.actionTasks ?? []).find((task) =>
    rowText(task, 'external_id') === row.recordKey &&
    rowText(task, 'status') !== 'cancelled',
  )
  return match ?? null
}

function gmailDraftInsertFor(
  row: WarmPlannedDraftActionRow,
  recipient: WarmBatchReviewRecipient,
  batchIdempotencyKey: string,
) {
  return {
    contact_submission_id: row.contactId,
    channel: 'email',
    subject: `Warm follow-up: ${row.contactName}`,
    body: recipient.individualizedDraftPreview,
    sequence_step: 1,
    status: 'draft',
    generation_model: 'portfolio-local-planner',
    generation_prompt_summary: 'planned_warm_gmail_draft_intent:no_provider',
    generation_inputs: {
      version: 'warm-planned-draft-execution/v1',
      record_key: row.recordKey,
      batch_idempotency_key: batchIdempotencyKey,
      recipient_draft_idempotency_key: recipient.draftIdempotencyKey,
      template_key: recipient.promptTemplateKey,
      channel: 'email',
      queue_intent: 'draft_only_planned',
      warm_relationship: recipient.contextSummary,
      draft_action_packet: row.draftActionPacket,
      approval_boundary: 'draft_only_no_external_send',
      provider_calls_enabled: false,
      gmail_provider_draft_created: false,
      gmail_send_enabled: false,
      slack_dispatch_enabled: false,
      sms_delivery_enabled: false,
      social_provider_calls_enabled: false,
      n8n_dispatch_enabled: false,
      external_requests: [],
    },
  }
}

function manualTaskInsertFor(row: WarmPlannedDraftActionRow) {
  const channel = row.recommendedChannel === 'phone_contact'
    ? 'phone contact'
    : row.recommendedChannel
  return {
    meeting_record_id: null,
    contact_submission_id: row.contactId,
    task_category: 'outreach',
    title: `Manual ${channel} handoff: ${row.contactName}`,
    description:
      `${row.reason} Use the existing outreach workroom manual handoff controls. ` +
      'Record timestamp, channel, and a non-sensitive note only; do not post or call providers.',
    owner: 'Vambah',
    due_date: null,
    status: 'pending',
    display_order: 0,
    external_id: row.recordKey,
  }
}

async function createPlannedDraftHandoffRecords(args: {
  review: WarmBatchReview
  contactInputs: WarmBatchReviewContactInput[]
  action: string
}): Promise<{
  records: WarmPlannedDraftExecutionRecord[]
  outreachQueue: PortfolioRow[]
  actionTasks: PortfolioRow[]
}> {
  if (!supabaseAdmin) {
    throw new Error('Database not available')
  }

  const now = new Date().toISOString()
  const rows = args.review.plannedDraftActions.rows.filter((row) =>
    row.recordState === 'ready_to_create' &&
    (row.kind === 'gmail_draft_plan' || row.kind === 'manual_social_handoff') &&
    row.recordTable,
  )
  const targetRows = args.action === CREATE_GMAIL_RECORDS_ACTION
    ? rows.filter((row) => row.kind === 'gmail_draft_plan')
    : rows

  const records: WarmPlannedDraftExecutionRecord[] = []
  const existingManualRows: PortfolioRow[] = []
  for (const row of targetRows.filter((item) => item.kind === 'manual_social_handoff')) {
    const existing = existingManualTask(args.contactInputs, row)
    if (!existing) continue
    existingManualRows.push(existing)
    records.push({
      key: row.recordKey,
      kind: 'manual_social_handoff_task',
      contactId: row.contactId,
      channel: row.recommendedChannel as WarmPlannedDraftExecutionRecord['channel'],
      recordTable: 'meeting_action_tasks',
      recordId: rowText(existing, 'id') ?? row.recordKey,
      state: 'existing',
      createdAt: rowText(existing, 'created_at') ?? now,
      externalRequests: [],
    })
  }

  const gmailRows = targetRows
    .filter((row) => row.kind === 'gmail_draft_plan')
    .map((row) => {
      const recipient = recipientFor(args.review, row)
      return recipient ? gmailDraftInsertFor(row, recipient, args.review.batchIdempotencyKey) : null
    })
    .filter(Boolean) as ReturnType<typeof gmailDraftInsertFor>[]
  const manualRows = targetRows
    .filter((row) => row.kind === 'manual_social_handoff' && !existingManualTask(args.contactInputs, row))
    .map(manualTaskInsertFor)

  let insertedOutreachRows: PortfolioRow[] = []
  let insertedTaskRows: PortfolioRow[] = []

  if (gmailRows.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('outreach_queue')
      .insert(gmailRows)
      .select('id, contact_submission_id, channel, subject, sequence_step, status, thread_id, message_id, sent_at, replied_at, generation_inputs, created_at')
    if (error) throw new Error('Unable to create internal Gmail draft records.')
    insertedOutreachRows = Array.isArray(data) ? data as PortfolioRow[] : []
    for (const inserted of insertedOutreachRows) {
      const generationInputs = recordValue(inserted.generation_inputs)
      records.push({
        key: rowText(inserted, 'id') && typeof generationInputs.record_key === 'string'
          ? generationInputs.record_key
          : rowText(inserted, 'id') ?? '',
        kind: 'gmail_draft_record',
        contactId: Number(inserted.contact_submission_id),
        channel: 'gmail',
        recordTable: 'outreach_queue',
        recordId: rowText(inserted, 'id') ?? '',
        state: 'created',
        createdAt: rowText(inserted, 'created_at') ?? now,
        externalRequests: [],
      })
    }
  }

  if (manualRows.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('meeting_action_tasks')
      .insert(manualRows)
      .select('id, contact_submission_id, title, description, task_category, status, due_date, outreach_queue_id, external_id, created_at')
    if (error) throw new Error('Unable to create manual-social handoff tasks.')
    insertedTaskRows = Array.isArray(data) ? data as PortfolioRow[] : []
    for (const inserted of insertedTaskRows) {
      const key = rowText(inserted, 'external_id') ?? rowText(inserted, 'id') ?? ''
      const source = targetRows.find((row) => row.recordKey === key)
      records.push({
        key,
        kind: 'manual_social_handoff_task',
        contactId: Number(inserted.contact_submission_id),
        channel: (source?.recommendedChannel ?? 'linkedin') as WarmPlannedDraftExecutionRecord['channel'],
        recordTable: 'meeting_action_tasks',
        recordId: rowText(inserted, 'id') ?? key,
        state: 'created',
        createdAt: rowText(inserted, 'created_at') ?? now,
        externalRequests: [],
      })
    }
  }

  return {
    records: records.filter((record) => record.key && record.recordId),
    outreachQueue: insertedOutreachRows,
    actionTasks: [...existingManualRows, ...insertedTaskRows],
  }
}

/**
 * POST /api/admin/outreach/batch-review
 *
 * Builds a one-to-many warm outreach review packet from existing /admin/outreach
 * lead selections. Review mode is read-only. The planned execution action only
 * creates internal Portfolio draft/handoff rows; it does not call LLM/provider
 * APIs, create Gmail provider drafts, dispatch n8n, notify Slack, or enable
 * send/scheduling authority.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    let body: {
      contact_ids?: unknown
      objective?: unknown
      cohort_label?: unknown
      preferred_channel?: unknown
      action?: unknown
    } = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const contactIds = parseWarmBatchContactIds(body.contact_ids)
    if (contactIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one selected lead is required for warm batch review.' },
        { status: 400 },
      )
    }
    if (contactIds.length > MAX_BATCH_RECIPIENTS) {
      return NextResponse.json(
        { error: `Warm batch review is limited to ${MAX_BATCH_RECIPIENTS} recipients at a time.` },
        { status: 400 },
      )
    }

    const objective =
      typeof body.objective === 'string' && body.objective.trim()
        ? body.objective.trim()
        : DEFAULT_OBJECTIVE
    const cohortLabel =
      typeof body.cohort_label === 'string' && body.cohort_label.trim()
        ? body.cohort_label.trim()
        : null
    const preferredChannel = parsePreferredChannel(body.preferred_channel)
    const action =
      typeof body.action === 'string' && body.action.trim()
        ? body.action.trim()
        : 'review'
    if (
      action !== 'review' &&
      action !== CREATE_GMAIL_RECORDS_ACTION &&
      action !== EXECUTE_PLANNED_ACTION
    ) {
      return NextResponse.json(
        { error: 'Unsupported warm batch review action.' },
        { status: 400 },
      )
    }

    const [
      contactsRes,
      contactCommunicationsRes,
      outreachQueueRes,
      emailMessagesRes,
      meetingSummariesRes,
      actionTasksRes,
    ] = await Promise.all([
      supabaseAdmin
        .from('contact_submissions')
        .select(
          'id, name, email, company, industry, lead_source, outreach_status, do_not_contact, removed_at, phone_number, linkedin_url, facebook_profile_url, relationship_strength, warm_source_detail, created_at',
        )
        .in('id', contactIds),
      supabaseAdmin
        .from('contact_communications')
        .select(
          'id, contact_submission_id, channel, direction, message_type, subject, source_system, source_id, status, sent_at, metadata, created_at',
        )
        .in('contact_submission_id', contactIds)
        .order('sent_at', { ascending: false })
        .limit(250),
      supabaseAdmin
        .from('outreach_queue')
        .select(
          'id, contact_submission_id, channel, subject, sequence_step, status, thread_id, sent_at, replied_at, generation_inputs, created_at',
        )
        .in('contact_submission_id', contactIds)
        .order('created_at', { ascending: false })
        .limit(250),
      supabaseAdmin
        .from('email_messages')
        .select(
          'id, contact_submission_id, email_kind, channel, direction, status, subject, source_system, source_id, sent_at, metadata, created_at',
        )
        .in('contact_submission_id', contactIds)
        .order('created_at', { ascending: false })
        .limit(250),
      supabaseAdmin
        .from('meeting_records')
        .select(
          'id, contact_submission_id, meeting_type, meeting_date, structured_notes, key_decisions, created_at',
        )
        .in('contact_submission_id', contactIds)
        .order('meeting_date', { ascending: false })
        .limit(150),
      supabaseAdmin
        .from('meeting_action_tasks')
        .select(
          'id, contact_submission_id, meeting_record_id, title, description, status, due_date, task_category, outreach_queue_id, external_id, created_at',
        )
        .in('contact_submission_id', contactIds)
        .order('created_at', { ascending: false })
        .limit(250),
    ])

    if (contactsRes.error) {
      return NextResponse.json(
        { error: 'Unable to load selected outreach leads.' },
        { status: 500 },
      )
    }

    const relatedQueryErrors = [
      { source: 'contact_communications', error: contactCommunicationsRes.error },
      { source: 'outreach_queue', error: outreachQueueRes.error },
      { source: 'email_messages', error: emailMessagesRes.error },
      { source: 'meeting_records', error: meetingSummariesRes.error },
      { source: 'meeting_action_tasks', error: actionTasksRes.error },
    ].filter((result) => result.error)

    if (relatedQueryErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Unable to load warm outreach relationship evidence.',
          source: relatedQueryErrors[0].source,
        },
        { status: 500 },
      )
    }

    const contacts = Array.isArray(contactsRes.data) ? contactsRes.data as PortfolioRow[] : []
    const foundIds = new Set(contacts.map((contact) => Number(contact.id)))
    const missingIds = contactIds.filter((id) => !foundIds.has(id))
    if (missingIds.length > 0) {
      return NextResponse.json(
        { error: 'Some selected leads were not found.', missingContactIds: missingIds },
        { status: 404 },
      )
    }

    const contactCommunications = groupByContactId(contactCommunicationsRes.data as PortfolioRow[])
    const outreachQueue = groupByContactId(outreachQueueRes.data as PortfolioRow[])
    const emailMessages = groupByContactId(emailMessagesRes.data as PortfolioRow[])
    const meetingSummaries = groupByContactId(meetingSummariesRes.data as PortfolioRow[])
    const actionTasks = groupByContactId(actionTasksRes.data as PortfolioRow[])

    const contactInputs = contacts
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((contact) => {
        const contactId = Number(contact.id)
        const relatedRows = [
          ...rowsFor(contactCommunications, contactId),
          ...rowsFor(outreachQueue, contactId),
          ...rowsFor(emailMessages, contactId),
        ]
        const guardedContact = withSuppressionFromRelatedRows(contact, relatedRows)

        return {
          contact: guardedContact,
          rows: {
            contactSubmission: guardedContact,
            contactCommunications: rowsFor(contactCommunications, contactId),
            outreachQueue: rowsFor(outreachQueue, contactId),
            emailMessages: rowsFor(emailMessages, contactId),
            meetingSummaries: rowsFor(meetingSummaries, contactId),
            actionTasks: rowsFor(actionTasks, contactId),
          },
          existingOutreachRows: rowsFor(outreachQueue, contactId),
        }
      })

    const review = buildWarmBatchReview({
      contacts: contactInputs,
      objective,
      cohortLabel,
      preferredChannel,
      draftCreationReceiptAt:
        action === CREATE_GMAIL_RECORDS_ACTION
          ? new Date().toISOString()
          : null,
    })

    if (action === 'review') {
      return NextResponse.json(review)
    }

    const plannedRecords = await createPlannedDraftHandoffRecords({
      review,
      contactInputs,
      action,
    })
    const contactInputsWithRecords = appendRowsToContactInputs(contactInputs, {
      outreachQueue: plannedRecords.outreachQueue,
      actionTasks: plannedRecords.actionTasks,
    })
    const executedReview = buildWarmBatchReview({
      contacts: contactInputsWithRecords,
      objective,
      cohortLabel,
      preferredChannel,
      plannedDraftExecutionRecords: plannedRecords.records,
    })

    return NextResponse.json(executedReview)
  } catch (error) {
    console.error('Error in POST /api/admin/outreach/batch-review:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
