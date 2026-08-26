import { NextRequest, NextResponse } from 'next/server'

import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildWarmBatchReview,
  hasSuppressedWarmBatchStatus,
  parseWarmBatchContactIds,
  rowContactId,
} from '@/lib/warm-outreach-batch-review'
import type { WarmOutreachSourceInventoryRows } from '@/lib/warm-outreach-source-inventory'
import { warmOutreachChannels, type WarmOutreachChannel } from '@/lib/warm-outreach-relationship-intelligence'

export const dynamic = 'force-dynamic'

const MAX_BATCH_RECIPIENTS = 50
const DEFAULT_OBJECTIVE =
  'Review selected warm outreach recipients before any individualized draft generation.'
const CHANNELS = new Set<string>(warmOutreachChannels)

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

/**
 * POST /api/admin/outreach/batch-review
 *
 * Builds a one-to-many warm outreach review packet from existing /admin/outreach
 * lead selections. This endpoint is read-only and does not generate drafts,
 * call LLM/provider APIs, create Gmail drafts, dispatch n8n, notify Slack, or
 * enable send/scheduling authority.
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
          'id, contact_submission_id, meeting_record_id, title, status, due_date, task_category, outreach_queue_id, created_at',
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
    })

    return NextResponse.json(review)
  } catch (error) {
    console.error('Error in POST /api/admin/outreach/batch-review:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
