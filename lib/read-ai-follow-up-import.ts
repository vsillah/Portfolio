import type { SupabaseClient } from '@supabase/supabase-js'
import { createDraftDirect } from '@/lib/client-update-drafts'
import { insertEmailMessageFromCommunication } from '@/lib/email-messages'
import { promoteActionItems } from '@/lib/meeting-action-tasks'
import { getMeetingDetail, type ReadAiMeeting } from '@/lib/read-ai'
import { supabaseAdmin } from '@/lib/supabase'

type DbClient = SupabaseClient | typeof supabaseAdmin

export interface ReadAiFollowUpDraftInput {
  subject: string
  body: string
  gmailDraftId?: string | null
  gmailThreadId?: string | null
  gmailMessageId?: string | null
  sourceEmailThreadId?: string | null
}

export interface ImportReadAiFollowUpInput {
  readAiMeetingId: string
  contactName: string
  contactEmail: string
  company?: string | null
  projectName?: string | null
  draft?: ReadAiFollowUpDraftInput | null
  userId?: string
}

export interface ImportReadAiFollowUpResult {
  contactSubmissionId: number
  meetingRecordId: string
  actionTasks: { created: number; skipped: number }
  clientUpdateDraftId: string | null
  contactCommunicationId: string | null
  emailMessageId: string | null
  meetingWasExisting: boolean
}

interface ImportReadAiFollowUpOptions {
  db?: DbClient
  meeting?: ReadAiMeeting | Record<string, unknown>
}

export function normalizeReadAiTranscript(meeting: ReadAiMeeting | Record<string, unknown>): string {
  const transcript = (meeting as Record<string, unknown>).transcript
  if (!transcript) return ''
  if (typeof transcript === 'string') return transcript.trim()
  if (typeof transcript === 'object' && !Array.isArray(transcript)) {
    const obj = transcript as Record<string, unknown>
    if (typeof obj.text === 'string') return obj.text.trim()
    if (Array.isArray(obj.speaker_blocks)) return transcriptBlocksToText(obj.speaker_blocks)
    if (Array.isArray(obj.blocks)) return transcriptBlocksToText(obj.blocks)
    if (Array.isArray(obj.turns)) return transcriptBlocksToText(obj.turns)
  }
  if (Array.isArray(transcript)) return transcriptBlocksToText(transcript)
  return ''
}

export function normalizeReadAiActionItems(input: unknown): Array<{ text: string; assignee?: string }> {
  if (!Array.isArray(input)) return []

  return input.flatMap((item) => {
    if (typeof item === 'string') {
      const text = item.trim()
      return text ? [{ text }] : []
    }
    if (!item || typeof item !== 'object') return []

    const raw = item as Record<string, unknown>
    const text = stringValue(raw.text ?? raw.action ?? raw.title)
    if (!text) return []

    const assignee = stringValue(raw.assignee ?? raw.owner)
    return assignee ? [{ text, assignee }] : [{ text }]
  })
}

export function buildReadAiMeetingRecordPayload(
  meeting: ReadAiMeeting | Record<string, unknown>,
  input: ImportReadAiFollowUpInput,
): Record<string, unknown> {
  const summary = normalizeSummary((meeting as Record<string, unknown>).summary)
  const actionItems = normalizeReadAiActionItems((meeting as Record<string, unknown>).action_items)
  const startMs = numberValue((meeting as Record<string, unknown>).start_time_ms)
  const endMs = numberValue((meeting as Record<string, unknown>).end_time_ms)
  const meetingDate = startMs ? new Date(startMs).toISOString() : new Date().toISOString()
  const durationMinutes = startMs && endMs && endMs > startMs
    ? Math.round((endMs - startMs) / 60000)
    : null

  return {
    contact_submission_id: null,
    client_project_id: null,
    read_ai_meeting_id: input.readAiMeetingId,
    meeting_type: 'progress_checkin',
    meeting_date: meetingDate,
    duration_minutes: durationMinutes,
    transcript: normalizeReadAiTranscript(meeting),
    raw_notes: buildRawNotes(stringValue((meeting as Record<string, unknown>).title), summary),
    attendees: normalizeParticipants((meeting as Record<string, unknown>).participants),
    action_items: actionItems,
    key_decisions: [],
    open_questions: normalizeOpenQuestions((meeting as Record<string, unknown>).key_questions),
    structured_notes: {
      title: stringValue((meeting as Record<string, unknown>).title) || 'Read.ai meeting',
      summary,
      topics: (meeting as Record<string, unknown>).topics ?? [],
      project_name: input.projectName ?? null,
      source: 'read_ai_follow_up_import',
    },
    meeting_data: {
      read_ai_meeting_id: input.readAiMeetingId,
      report_url: stringValue((meeting as Record<string, unknown>).report_url) || null,
      platform: stringValue((meeting as Record<string, unknown>).platform) || null,
      owner: (meeting as Record<string, unknown>).owner ?? null,
      source: 'read_ai_follow_up_import',
      gmail_draft_id: input.draft?.gmailDraftId ?? null,
      gmail_thread_id: input.draft?.gmailThreadId ?? null,
      gmail_message_id: input.draft?.gmailMessageId ?? null,
      source_email_thread_id: input.draft?.sourceEmailThreadId ?? null,
    },
  }
}

export async function importReadAiFollowUp(
  input: ImportReadAiFollowUpInput,
  options?: ImportReadAiFollowUpOptions,
): Promise<ImportReadAiFollowUpResult> {
  const db = options?.db ?? supabaseAdmin
  if (!db) {
    throw new Error('Database is not available')
  }

  const normalizedEmail = input.contactEmail.trim().toLowerCase()
  const contactName = input.contactName.trim()
  if (!input.readAiMeetingId.trim()) throw new Error('readAiMeetingId is required')
  if (!contactName) throw new Error('contactName is required')
  if (!normalizedEmail) throw new Error('contactEmail is required')

  const meeting = options?.meeting ?? await getMeetingDetail(input.readAiMeetingId.trim())
  const contactSubmissionId = await ensureContactSubmission(db, {
    name: contactName,
    email: normalizedEmail,
    company: input.company ?? null,
    readAiMeetingId: input.readAiMeetingId.trim(),
  })

  const payload = {
    ...buildReadAiMeetingRecordPayload(meeting, input),
    contact_submission_id: contactSubmissionId,
  }
  const { meetingRecordId, existing } = await upsertMeetingRecord(db, input.readAiMeetingId.trim(), payload)
  const actionTasks = await promoteActionItems(meetingRecordId)

  let clientUpdateDraftId: string | null = null
  let contactCommunicationId: string | null = null
  let emailMessageId: string | null = null

  if (input.draft?.subject && input.draft.body) {
    const draft = await createDraftDirect({
      clientProjectId: null,
      contactSubmissionId,
      subject: input.draft.subject,
      body: input.draft.body,
      clientEmail: normalizedEmail,
      clientName: contactName,
      meetingRecordId,
      userId: input.userId,
    })
    clientUpdateDraftId = draft?.id ?? null

    const communication = await insertContactCommunication(db, {
      contactSubmissionId,
      subject: input.draft.subject,
      body: input.draft.body,
      sourceId: clientUpdateDraftId ?? input.draft.gmailDraftId ?? meetingRecordId,
      userId: input.userId,
      metadata: {
        read_ai_meeting_id: input.readAiMeetingId.trim(),
        meeting_record_id: meetingRecordId,
        client_update_draft_id: clientUpdateDraftId,
        gmail_draft_id: input.draft.gmailDraftId ?? null,
        gmail_thread_id: input.draft.gmailThreadId ?? null,
        gmail_message_id: input.draft.gmailMessageId ?? null,
        source_email_thread_id: input.draft.sourceEmailThreadId ?? null,
      },
    })
    contactCommunicationId = communication?.id ?? null

    if (communication?.id) {
      const emailMessage = await insertEmailMessageFromCommunication({
        contactCommunicationId: communication.id,
        contactSubmissionId,
        emailKind: 'follow_up',
        channel: 'email',
        recipientEmail: normalizedEmail,
        subject: input.draft.subject,
        body: input.draft.body,
        direction: 'outbound',
        status: 'draft',
        transport: 'logged_only',
        sourceSystem: 'manual',
        sourceId: input.draft.gmailDraftId ?? clientUpdateDraftId ?? meetingRecordId,
        metadata: {
          read_ai_meeting_id: input.readAiMeetingId.trim(),
          meeting_record_id: meetingRecordId,
          client_update_draft_id: clientUpdateDraftId,
          gmail_draft_id: input.draft.gmailDraftId ?? null,
          gmail_thread_id: input.draft.gmailThreadId ?? null,
          gmail_message_id: input.draft.gmailMessageId ?? null,
          source_email_thread_id: input.draft.sourceEmailThreadId ?? null,
        },
      })
      emailMessageId = emailMessage?.id ?? null
    }
  }

  return {
    contactSubmissionId,
    meetingRecordId,
    actionTasks,
    clientUpdateDraftId,
    contactCommunicationId,
    emailMessageId,
    meetingWasExisting: existing,
  }
}

async function ensureContactSubmission(
  db: DbClient,
  input: { name: string; email: string; company: string | null; readAiMeetingId: string },
): Promise<number> {
  const { data: existing, error: selectError } = await db
    .from('contact_submissions')
    .select('id')
    .ilike('email', input.email)
    .limit(1)
    .maybeSingle()

  if (selectError) {
    throw new Error(`Failed to look up contact submission: ${selectError.message}`)
  }

  const message = `Imported from Read.ai follow-up meeting ${input.readAiMeetingId}.`

  if (existing?.id) {
    const updatePayload: Record<string, unknown> = {
      name: input.name,
      message,
    }
    if (input.company) updatePayload.company = input.company

    const { error: updateError } = await db
      .from('contact_submissions')
      .update(updatePayload)
      .eq('id', existing.id)

    if (updateError) {
      throw new Error(`Failed to update contact submission: ${updateError.message}`)
    }
    return Number(existing.id)
  }

  const { data: inserted, error: insertError } = await db
    .from('contact_submissions')
    .insert({
      name: input.name,
      email: input.email,
      company: input.company,
      message,
      lead_source: 'warm_meeting',
      submission_source: 'read_ai_follow_up_import',
    })
    .select('id')
    .single()

  if (insertError || !inserted?.id) {
    throw new Error(`Failed to create contact submission: ${insertError?.message ?? 'no id returned'}`)
  }

  return Number(inserted.id)
}

async function upsertMeetingRecord(
  db: DbClient,
  readAiMeetingId: string,
  payload: Record<string, unknown>,
): Promise<{ meetingRecordId: string; existing: boolean }> {
  const { data: existing, error: selectError } = await db
    .from('meeting_records')
    .select('id')
    .eq('read_ai_meeting_id', readAiMeetingId)
    .limit(1)
    .maybeSingle()

  if (selectError) {
    throw new Error(`Failed to look up meeting record: ${selectError.message}`)
  }

  if (existing?.id) {
    const { data: updated, error: updateError } = await db
      .from('meeting_records')
      .update(payload)
      .eq('id', existing.id)
      .select('id')
      .single()

    if (updateError || !updated?.id) {
      throw new Error(`Failed to update meeting record: ${updateError?.message ?? 'no id returned'}`)
    }
    return { meetingRecordId: String(updated.id), existing: true }
  }

  const { data: inserted, error: insertError } = await db
    .from('meeting_records')
    .insert(payload)
    .select('id')
    .single()

  if (insertError || !inserted?.id) {
    throw new Error(`Failed to create meeting record: ${insertError?.message ?? 'no id returned'}`)
  }

  return { meetingRecordId: String(inserted.id), existing: false }
}

async function insertContactCommunication(
  db: DbClient,
  input: {
    contactSubmissionId: number
    subject: string
    body: string
    sourceId: string
    userId?: string
    metadata: Record<string, unknown>
  },
): Promise<{ id: string } | null> {
  const { data, error } = await db
    .from('contact_communications')
    .insert({
      contact_submission_id: input.contactSubmissionId,
      channel: 'email',
      direction: 'outbound',
      message_type: 'follow_up',
      subject: input.subject,
      body: input.body,
      source_system: 'manual',
      source_id: input.sourceId,
      status: 'draft',
      sent_by: input.userId ?? null,
      metadata: input.metadata,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[read-ai-follow-up-import] contact_communications insert failed:', error.message)
    return null
  }

  return data ? { id: data.id } : null
}

function transcriptBlocksToText(blocks: unknown[]): string {
  return blocks.flatMap((block) => {
    if (typeof block === 'string') return block.trim() ? [block.trim()] : []
    if (!block || typeof block !== 'object') return []

    const obj = block as Record<string, unknown>
    const speakerObj = obj.speaker && typeof obj.speaker === 'object'
      ? obj.speaker as Record<string, unknown>
      : null
    const speaker = stringValue(obj.speaker_name ?? speakerObj?.name ?? obj.speaker ?? obj.name)
    const text = stringValue(obj.text ?? obj.transcript)
      || (Array.isArray(obj.words)
        ? obj.words.map((word) => stringValue((word as Record<string, unknown>)?.text ?? word)).filter(Boolean).join(' ')
        : '')
    if (!text) return []
    return speaker ? [`${speaker}: ${text}`] : [text]
  }).join('\n')
}

function normalizeParticipants(input: unknown): Array<{ name?: string; email?: string | null; attended?: boolean }> {
  if (!Array.isArray(input)) return []
  return input.flatMap((participant) => {
    if (!participant || typeof participant !== 'object') return []
    const obj = participant as Record<string, unknown>
    const name = stringValue(obj.name)
    const email = stringValue(obj.email) || null
    if (!name && !email) return []
    return [{
      ...(name ? { name } : {}),
      email,
      attended: Boolean(obj.attended),
    }]
  })
}

function normalizeOpenQuestions(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((item) => {
    const question = typeof item === 'string'
      ? item.trim()
      : item && typeof item === 'object'
        ? stringValue((item as Record<string, unknown>).text ?? (item as Record<string, unknown>).question)
        : ''
    return question ? [question] : []
  })
}

function normalizeSummary(input: unknown): string {
  if (typeof input === 'string') return input.trim()
  if (Array.isArray(input)) {
    return input.map((item) => stringValue(item)).filter(Boolean).join('\n')
  }
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>
    return stringValue(obj.text ?? obj.summary ?? obj.markdown)
      || JSON.stringify(input)
  }
  return ''
}

function buildRawNotes(title: string, summary: string): string {
  const chunks = [title, summary].map((chunk) => chunk.trim()).filter(Boolean)
  return chunks.join('\n\n').slice(0, 2000)
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
