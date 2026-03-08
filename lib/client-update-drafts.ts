/**
 * Client Update Drafts — Generate, Render, Send
 *
 * Builds draft client-update emails from completed meeting_action_tasks,
 * stores them in client_update_drafts, and sends via the progress-update
 * n8n webhook when the admin clicks "Send".
 */

import { supabaseAdmin } from './supabase'
import { n8nWebhookUrl } from './n8n'
import type { MeetingActionTask } from './meeting-action-tasks'
import { getAllActiveUpsellPaths, matchesNextProblemSignals, formatUpsellRecommendation } from './upsell-paths'
import { resolveProgressUpdateTemplate } from './progress-update-templates'

// ============================================================================
// Types
// ============================================================================

export type DraftType = 'client_update' | 'lead_followup'

export interface ClientUpdateDraft {
  id: string
  client_project_id: string | null
  contact_submission_id: number | null
  draft_type: DraftType
  meeting_record_id: string | null
  subject: string
  body: string
  slack_body: string | null
  client_email: string
  client_name: string
  task_ids: string[]
  status: 'draft' | 'sent'
  sent_at: string | null
  sent_via: 'email' | 'slack' | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface GenerateDraftInput {
  /** Which project this update is for */
  clientProjectId: string
  /** Optional: restrict to tasks from a specific meeting */
  meetingRecordId?: string
  /** Optional: explicit list of task IDs (overrides auto-detection) */
  taskIds?: string[]
  /** Optional: custom note to prepend */
  customNote?: string
  /** Who is generating the draft */
  userId?: string
}

export interface TaskWithTargetDate {
  taskId: string
  targetDate?: string | null
}

export interface GenerateLeadFollowupInput {
  /** Which lead (contact_submission) this follow-up is for */
  contactSubmissionId: number
  /** Optional: restrict to tasks from a specific meeting */
  meetingRecordId?: string
  /** Tasks to include with optional per-task target dates (any status) */
  tasks?: TaskWithTargetDate[]
  /** Optional: explicit list of task IDs (legacy, no target dates) */
  taskIds?: string[]
  /** Optional: custom note */
  customNote?: string
  /** Who is generating the draft */
  userId?: string
}

export interface CreateDraftDirectInput {
  /** Which project this draft is for (optional for lead follow-ups) */
  clientProjectId: string | null
  /** Which lead this draft is for (optional, used when clientProjectId is null) */
  contactSubmissionId?: number | null
  /** Email subject */
  subject: string
  /** Email body */
  body: string
  /** Client email address */
  clientEmail: string
  /** Client name */
  clientName: string
  /** Optional: link to a meeting record */
  meetingRecordId?: string
  /** Optional: source identifier (e.g. 'gmail_reply', 'manual') */
  source?: string
  /** Who is creating the draft */
  userId?: string
}

export interface SendDraftInput {
  /** Draft ID to send */
  draftId: string
  /** Send via email or slack (default: email) */
  channel?: 'email' | 'slack'
}

/** Webhook payload reusing the progress-update shape */
interface ClientUpdateWebhookPayload {
  client_project_id: string
  client_name: string
  client_email: string
  client_company: string | null
  slack_channel: string | null
  channel: 'email' | 'slack'
  update_type: 'action_items_update'
  email_subject: string
  email_body: string
  slack_body: string
  reply_to?: string
  callback_url: string
}

// ============================================================================
// Configuration
// ============================================================================

const N8N_PROGRESS_UPDATE_WEBHOOK_URL = process.env.N8N_PROGRESS_UPDATE_WEBHOOK_URL
  || n8nWebhookUrl('progress-update')

// ============================================================================
// Generate draft from completed tasks
// ============================================================================

/**
 * Gather completed tasks (since last sent update), render a subject + body,
 * and insert a client_update_drafts row.
 *
 * Returns the created draft or null on failure.
 */
export async function generateUpdateDraft(
  input: GenerateDraftInput
): Promise<ClientUpdateDraft | null> {
  const { clientProjectId, meetingRecordId, taskIds, customNote, userId } = input

  // 1. Fetch project context
  const { data: project, error: projErr } = await supabaseAdmin
    .from('client_projects')
    .select('id, client_name, client_email, client_company, project_name, slack_channel')
    .eq('id', clientProjectId)
    .single()

  if (projErr || !project) {
    console.error('[Draft] Project not found:', clientProjectId)
    return null
  }

  // 2. Determine which completed tasks to include
  let completedTasks: MeetingActionTask[]

  if (taskIds && taskIds.length > 0) {
    // Explicit list
    const { data } = await supabaseAdmin
      .from('meeting_action_tasks')
      .select('*')
      .in('id', taskIds)
      .eq('status', 'complete')
      .order('display_order')

    completedTasks = (data || []) as MeetingActionTask[]
  } else {
    // Auto: all completed tasks for this project not yet included in a sent draft
    const alreadySentIds = await getAlreadySentTaskIds(clientProjectId)

    let query = supabaseAdmin
      .from('meeting_action_tasks')
      .select('*')
      .eq('client_project_id', clientProjectId)
      .eq('status', 'complete')
      .order('completed_at', { ascending: true })

    if (meetingRecordId) {
      query = query.eq('meeting_record_id', meetingRecordId)
    }

    const { data } = await query
    completedTasks = ((data || []) as MeetingActionTask[]).filter(
      t => !alreadySentIds.has(t.id)
    )
  }

  if (completedTasks.length === 0) {
    console.warn('[Draft] No unsent completed tasks found')
    return null
  }

  // 3. Optionally fetch meeting info for context
  let meetingType: string | null = null
  if (meetingRecordId) {
    const { data: mtg } = await supabaseAdmin
      .from('meeting_records')
      .select('meeting_type')
      .eq('id', meetingRecordId)
      .single()
    meetingType = mtg?.meeting_type ?? null
  }

  // 4. Render subject + body
  const { subject, body: baseBody } = renderUpdateEmail({
    clientName: project.client_name,
    projectName: project.project_name || 'your project',
    completedTasks,
    meetingType,
    customNote,
  })

  // 4b. Check if completed tasks match any upsell path signals
  // If so, append an upgrade recommendation to the email body
  let body = baseBody
  try {
    const upsellPaths = await getAllActiveUpsellPaths()
    const taskTitles = completedTasks.map(t => t.title)
    const taskDescriptions = completedTasks.map(t => t.description || t.title)
    const observedSignals = [...taskTitles, ...taskDescriptions]

    for (const path of upsellPaths) {
      const { matches } = matchesNextProblemSignals(path, observedSignals)
      if (matches) {
        body += '\n\n---\n\n'
        body += formatUpsellRecommendation(path)
        body += '\n\n*This recommendation is based on your current progress. Reply to this email or schedule a call to discuss.*'
        break // Only include one recommendation per update
      }
    }
  } catch (upsellErr) {
    // Non-critical — continue without upsell recommendation
    console.error('[Draft] Error checking upsell signals:', upsellErr)
  }

  // 5. Insert draft
  const { data: draft, error: insertErr } = await supabaseAdmin
    .from('client_update_drafts')
    .insert({
      client_project_id: clientProjectId,
      draft_type: 'client_update',
      meeting_record_id: meetingRecordId || null,
      subject,
      body,
      client_email: project.client_email,
      client_name: project.client_name,
      task_ids: completedTasks.map(t => t.id),
      status: 'draft',
      created_by: userId || null,
    })
    .select('*')
    .single()

  if (insertErr || !draft) {
    console.error('[Draft] Insert failed:', insertErr?.message)
    return null
  }

  return draft as ClientUpdateDraft
}

// ============================================================================
// Generate lead follow-up draft from completed tasks
// ============================================================================

/**
 * Generates a status report draft for a lead/contact.
 * Accepts tasks of any status (not just completed) with optional target dates.
 */
export async function generateLeadFollowup(
  input: GenerateLeadFollowupInput
): Promise<ClientUpdateDraft | null> {
  const { contactSubmissionId, meetingRecordId, tasks: tasksWithDates, taskIds, customNote, userId } = input

  // 1. Fetch lead context
  const { data: lead, error: leadErr } = await supabaseAdmin
    .from('contact_submissions')
    .select('id, name, email')
    .eq('id', contactSubmissionId)
    .single()

  if (leadErr || !lead || !lead.email) {
    console.error('[Lead followup] Lead not found or missing email:', contactSubmissionId)
    return null
  }

  // 2. Resolve which tasks to include
  let selectedTasks: MeetingActionTask[]
  let targetDateMap = new Map<string, string | null>()

  if (tasksWithDates && tasksWithDates.length > 0) {
    const ids = tasksWithDates.map(t => t.taskId)
    const { data } = await supabaseAdmin
      .from('meeting_action_tasks')
      .select('*')
      .in('id', ids)
      .order('display_order')
    selectedTasks = (data || []) as MeetingActionTask[]
    for (const t of tasksWithDates) {
      if (t.targetDate) targetDateMap.set(t.taskId, t.targetDate)
    }
  } else if (taskIds && taskIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('meeting_action_tasks')
      .select('*')
      .in('id', taskIds)
      .order('display_order')
    selectedTasks = (data || []) as MeetingActionTask[]
  } else {
    // Fallback: all non-cancelled tasks for this contact's meetings
    const { data: meetings } = await supabaseAdmin
      .from('meeting_records')
      .select('id')
      .eq('contact_submission_id', contactSubmissionId)

    const meetingIds = (meetings || []).map((m: { id: string }) => m.id)
    if (meetingIds.length === 0) {
      console.warn('[Lead followup] No meetings linked to lead:', contactSubmissionId)
      return null
    }

    let query = supabaseAdmin
      .from('meeting_action_tasks')
      .select('*')
      .in('meeting_record_id', meetingIds)
      .neq('status', 'cancelled')
      .order('display_order')

    if (meetingRecordId) {
      query = query.eq('meeting_record_id', meetingRecordId)
    }

    const { data } = await query
    selectedTasks = (data || []) as MeetingActionTask[]
  }

  if (selectedTasks.length === 0) {
    console.warn('[Lead followup] No tasks found for contact')
    return null
  }

  // 3. Fetch meeting context for each task (meeting_type, meeting_date, optional agenda from structured_notes)
  const meetingIds = [...new Set(selectedTasks.map(t => t.meeting_record_id).filter(Boolean))] as string[]
  let meetingMap: Record<string, { meeting_type: string; meeting_date: string; agenda_topic: string }> = {}
  if (meetingIds.length > 0) {
    const { data: meetings } = await supabaseAdmin
      .from('meeting_records')
      .select('id, meeting_type, meeting_date, structured_notes')
      .in('id', meetingIds)
    for (const m of meetings || []) {
      const notes = m.structured_notes
      const summary = (notes && typeof notes === 'object' && notes !== null && 'summary' in notes)
        ? String((notes as { summary?: string }).summary || '').trim().slice(0, 80)
        : ''
      const agendaTopic = summary || (m.meeting_type || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
      meetingMap[m.id] = {
        meeting_type: m.meeting_type || 'meeting',
        meeting_date: m.meeting_date || '',
        agenda_topic: agendaTopic || (m.meeting_type || 'meeting').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      }
    }
  }

  // 4. Render status report email (HTML) + Slack (mrkdwn)
  const { subject, body, slackBody } = await renderStatusReportEmail({
    contactName: lead.name,
    tasks: selectedTasks,
    targetDateMap,
    meetingMap,
    customNote,
  })

  // 5. Insert draft
  const { data: draft, error: insertErr } = await supabaseAdmin
    .from('client_update_drafts')
    .insert({
      client_project_id: null,
      contact_submission_id: contactSubmissionId,
      draft_type: 'lead_followup',
      meeting_record_id: meetingRecordId || null,
      subject,
      body,
      slack_body: slackBody,
      client_email: lead.email,
      client_name: lead.name,
      task_ids: selectedTasks.map(t => t.id),
      status: 'draft',
      created_by: userId || null,
    })
    .select('*')
    .single()

  if (insertErr || !draft) {
    console.error('[Lead followup] Insert failed:', insertErr?.message)
    return null
  }

  return draft as ClientUpdateDraft
}

// ============================================================================
// Create draft directly (subject + body, no task generation)
// ============================================================================

/**
 * Create a draft directly from a subject and body.
 * Used by the Gmail reply workflow and any external system that provides
 * pre-composed email content (e.g. LLM-generated replies).
 */
export async function createDraftDirect(
  input: CreateDraftDirectInput
): Promise<ClientUpdateDraft | null> {
  const {
    clientProjectId,
    subject,
    body,
    clientEmail,
    clientName,
    meetingRecordId,
    source,
    userId,
  } = input

  const { data: draft, error: insertErr } = await supabaseAdmin
    .from('client_update_drafts')
    .insert({
      client_project_id: clientProjectId || null,
      contact_submission_id: input.contactSubmissionId || null,
      draft_type: clientProjectId ? 'client_update' : 'lead_followup',
      meeting_record_id: meetingRecordId || null,
      subject,
      body,
      client_email: clientEmail,
      client_name: clientName,
      task_ids: [],
      status: 'draft',
      created_by: userId || null,
      ...(source ? { source } : {}),
    })
    .select('*')
    .single()

  if (insertErr || !draft) {
    console.error('[Draft direct] Insert failed:', insertErr?.message)
    return null
  }

  return draft as ClientUpdateDraft
}

// ============================================================================
// Send draft via n8n
// ============================================================================

/**
 * Send a draft client-update email via the n8n progress-update webhook.
 * Marks the draft as sent on success.
 */
export async function sendDraft(
  input: SendDraftInput
): Promise<{ sent: boolean; message: string }> {
  const { draftId, channel = 'email' } = input

  // 1. Load draft
  const { data: draft, error: draftErr } = await supabaseAdmin
    .from('client_update_drafts')
    .select('*')
    .eq('id', draftId)
    .single()

  if (draftErr || !draft) {
    return { sent: false, message: 'Draft not found' }
  }

  if (draft.status === 'sent') {
    return { sent: false, message: 'Draft already sent' }
  }

  // 2. Load project for Slack channel
  const { data: project } = await supabaseAdmin
    .from('client_projects')
    .select('client_company, slack_channel')
    .eq('id', draft.client_project_id)
    .single()

  // 3. Fire n8n webhook (reusing the progress-update pipeline)
  if (!N8N_PROGRESS_UPDATE_WEBHOOK_URL) {
    return { sent: false, message: 'N8N_PROGRESS_UPDATE_WEBHOOK_URL not configured' }
  }

  // Fetch business owner email for reply-to header
  const { getBusinessOwnerEmail } = await import('./site-settings')
  const replyTo = await getBusinessOwnerEmail()

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  const payload: ClientUpdateWebhookPayload = {
    client_project_id: draft.client_project_id,
    client_name: draft.client_name,
    client_email: draft.client_email,
    client_company: project?.client_company ?? null,
    slack_channel: project?.slack_channel ?? null,
    channel,
    update_type: 'action_items_update',
    email_subject: draft.subject,
    email_body: draft.body,
    slack_body: draft.slack_body || draft.body,
    reply_to: replyTo,
    callback_url: `${baseUrl}/api/client-update-drafts/${draftId}/delivered`,
  }

  try {
    const res = await fetch(N8N_PROGRESS_UPDATE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[Draft send] n8n returned ${res.status}: ${text}`)
      return { sent: false, message: `n8n returned ${res.status}` }
    }
  } catch (err) {
    console.error('[Draft send] Webhook failed:', err)
    return { sent: false, message: String(err) }
  }

  // 4. Mark sent — conditional update to prevent double-send race condition
  const { data: updatedDraft, error: updateErr } = await supabaseAdmin
    .from('client_update_drafts')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_via: channel,
    })
    .eq('id', draftId)
    .eq('status', 'draft') // Only update if still a draft
    .select('id')
    .single()

  if (updateErr || !updatedDraft) {
    // Draft was already sent by another request (race condition)
    return { sent: false, message: 'Draft was already sent (concurrent request)' }
  }

  return { sent: true, message: 'Draft sent via n8n' }
}

// ============================================================================
// List / update drafts
// ============================================================================

export async function listDrafts(filters: {
  clientProjectId?: string
  status?: 'draft' | 'sent'
}): Promise<ClientUpdateDraft[]> {
  let query = supabaseAdmin
    .from('client_update_drafts')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters.clientProjectId) {
    query = query.eq('client_project_id', filters.clientProjectId)
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to list drafts: ${error.message}`)
  return (data || []) as ClientUpdateDraft[]
}

export async function updateDraft(
  draftId: string,
  updates: Partial<Pick<ClientUpdateDraft, 'subject' | 'body'>>
): Promise<ClientUpdateDraft> {
  const { data, error } = await supabaseAdmin
    .from('client_update_drafts')
    .update(updates)
    .eq('id', draftId)
    .eq('status', 'draft') // Only edit unsent drafts
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to update draft ${draftId}: ${error?.message}`)
  }
  return data as ClientUpdateDraft
}

export async function deleteDraft(draftId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('client_update_drafts')
    .delete()
    .eq('id', draftId)

  if (error) {
    throw new Error(`Failed to delete draft ${draftId}: ${error.message}`)
  }
}

// ============================================================================
// Email rendering
// ============================================================================

interface RenderContext {
  clientName: string
  projectName: string
  completedTasks: MeetingActionTask[]
  meetingType: string | null
  customNote?: string
}

function renderUpdateEmail(ctx: RenderContext): { subject: string; body: string } {
  const { clientName, projectName, completedTasks, meetingType, customNote } = ctx

  const meetingLabel = meetingType
    ? meetingType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : null

  const subject = meetingLabel
    ? `Action Items Update — ${meetingLabel} (${projectName})`
    : `Action Items Update — ${projectName}`

  const taskLines = completedTasks.map((t, i) => {
    const ownerNote = t.owner ? ` (${t.owner})` : ''
    const dateNote = t.completed_at
      ? ` — completed ${formatDate(t.completed_at)}`
      : ''
    return `${i + 1}. ✅ ${t.title}${ownerNote}${dateNote}`
  })

  const remainingNote =
    completedTasks.length === 1
      ? 'This action item has been completed.'
      : `These ${completedTasks.length} action items have been completed.`

  const body = [
    `Hi ${clientName},`,
    '',
    `Here's an update on action items from ${meetingLabel ? `our ${meetingLabel.toLowerCase()} meeting` : 'our recent meeting'} for **${projectName}**:`,
    '',
    ...taskLines,
    '',
    remainingNote,
    '',
    customNote ? `*Note:* ${customNote}\n` : '',
    'Please let us know if you have any questions or need more detail on any of these items.',
    '',
    'Best,',
    'AmaduTown',
  ]
    .filter(line => line !== undefined)
    .join('\n')

  return { subject, body }
}

// ============================================================================
// Internal helpers
// ============================================================================

/** Collect task IDs that have already been included in a sent draft */
async function getAlreadySentTaskIds(clientProjectId: string): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from('client_update_drafts')
    .select('task_ids')
    .eq('client_project_id', clientProjectId)
    .eq('status', 'sent')

  const ids = new Set<string>()
  for (const row of data || []) {
    for (const tid of (row.task_ids as string[]) || []) {
      ids.add(tid)
    }
  }
  return ids
}

/** Collect task IDs that have already been included in a sent draft for a lead */
async function getAlreadySentTaskIdsForLead(contactSubmissionId: number): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from('client_update_drafts')
    .select('task_ids')
    .eq('contact_submission_id', contactSubmissionId)
    .eq('status', 'sent')

  const ids = new Set<string>()
  for (const row of data || []) {
    for (const tid of (row.task_ids as string[]) || []) {
      ids.add(tid)
    }
  }
  return ids
}

interface StatusReportRenderContext {
  contactName: string
  tasks: MeetingActionTask[]
  targetDateMap: Map<string, string | null>
  meetingMap: Record<string, { meeting_type: string; meeting_date: string; agenda_topic: string }>
  customNote?: string
}

/**
 * Renders the status report email + Slack body.
 *
 * Tries to resolve a template from progress_update_templates (update_type =
 * 'action_items_update'). If the DB template is missing or malformed, falls
 * back to hardcoded copy so the send flow never breaks.
 */
async function renderStatusReportEmail(
  ctx: StatusReportRenderContext
): Promise<{ subject: string; body: string; slackBody: string }> {
  const tokens = buildStatusReportTokens(ctx)

  // Try DB template first
  try {
    const template = await resolveProgressUpdateTemplate('action_items_update', null, null)
    if (template) {
      const subject = replaceTokens(template.email_subject, tokens)
      const body = replaceTokens(template.email_body, tokens)
      const slackBody = replaceTokens(template.slack_body, tokens)
      return { subject, body, slackBody }
    }
  } catch (err) {
    console.warn('[Draft] Failed to resolve action_items_update template, using fallback:', err)
  }

  // Hardcoded fallback (original copy)
  return renderStatusReportFallback(ctx, tokens)
}

/** Token values shared between DB template and fallback. */
function buildStatusReportTokens(ctx: StatusReportRenderContext): Record<string, string> {
  const { contactName, tasks, targetDateMap, meetingMap, customNote } = ctx
  const firstName = contactName.trim().split(/\s+/)[0] || contactName

  const statusLabel: Record<string, string> = {
    complete: 'Complete',
    in_progress: 'In Progress',
    pending: 'To Do',
    cancelled: 'Cancelled',
  }

  const meetingLabel = (type: string, date: string) => {
    const label = type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    if (date) {
      try {
        const d = new Date(date)
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        return `${label} (${dateStr})`
      } catch {
        return label
      }
    }
    return label
  }

  const completedCount = tasks.filter(t => t.status === 'complete').length
  const totalCount = tasks.length
  const allTargetDates = tasks
    .filter(t => t.status !== 'complete' && t.status !== 'cancelled')
    .map(t => targetDateMap.get(t.id) || t.due_date)
    .filter(Boolean) as string[]
  const overallDate = allTargetDates.length > 0 ? allTargetDates.sort().reverse()[0] : null

  // HTML list items (for email)
  const htmlItems = tasks.map((t) => {
    const meeting = t.meeting_record_id ? meetingMap[t.meeting_record_id] : null
    const source = meeting ? meetingLabel(meeting.meeting_type, meeting.meeting_date) : 'Meeting'
    const agendaTopic = meeting?.agenda_topic || source
    const label = statusLabel[t.status] || t.status
    const targetDate = targetDateMap.get(t.id) || t.due_date
    const datePart = t.status === 'complete' && t.completed_at
      ? `Completed ${formatDate(t.completed_at)}`
      : targetDate
        ? `Target: ${formatDate(targetDate)}`
        : ''
    const ownerPart = t.owner ? `Owner: ${t.owner}` : ''
    const parts = [escapeHtml(t.title), `[${label}]`, datePart, ownerPart].filter(Boolean)
    const line = parts.join(' \u00B7 ')
    return `  <li><strong>${escapeHtml(source)}</strong> \u2014 ${escapeHtml(agendaTopic)}<br/>${line}</li>`
  })

  // Slack mrkdwn list items
  const mrkdwnItems = tasks.map((t) => {
    const meeting = t.meeting_record_id ? meetingMap[t.meeting_record_id] : null
    const source = meeting ? meetingLabel(meeting.meeting_type, meeting.meeting_date) : 'Meeting'
    const agendaTopic = meeting?.agenda_topic || source
    const label = statusLabel[t.status] || t.status
    const targetDate = targetDateMap.get(t.id) || t.due_date
    const datePart = t.status === 'complete' && t.completed_at
      ? `Completed ${formatDate(t.completed_at)}`
      : targetDate
        ? `Target: ${formatDate(targetDate)}`
        : ''
    const ownerPart = t.owner ? `Owner: ${t.owner}` : ''
    const parts = [t.title, `[${label}]`, datePart, ownerPart].filter(Boolean)
    const line = parts.join(' \u00B7 ')
    return `\u2022 *${source}* \u2014 ${agendaTopic}\n  ${line}`
  })

  const estimatedCompletion = overallDate
    ? ` Estimated completion for remaining items: ${formatDate(overallDate)}.`
    : ''

  return {
    first_name: firstName,
    completed_count: String(completedCount),
    total_count: String(totalCount),
    estimated_completion: estimatedCompletion,
    task_list_html: htmlItems.join('\n'),
    task_list_mrkdwn: mrkdwnItems.join('\n'),
    custom_note: customNote ? `<p><em>Note: ${escapeHtml(customNote)}</em></p>` : '',
    custom_note_mrkdwn: customNote ? `_Note: ${customNote}_` : '',
    sign_off_name: 'Vambah',
  }
}

/** Hardcoded fallback when no DB template is available. */
function renderStatusReportFallback(
  _ctx: StatusReportRenderContext,
  tokens: Record<string, string>
): { subject: string; body: string; slackBody: string } {
  const subject = 'Status on action items from our prior meetings'

  const body = [
    `<p>Hey ${tokens.first_name},</p>`,
    `<p>Hope all is well. Here's a status on the action items from our prior meetings.</p>`,
    `<p>Progress: ${tokens.completed_count} of ${tokens.total_count} items complete.${tokens.estimated_completion}</p>`,
    '<ul>',
    tokens.task_list_html,
    '</ul>',
    tokens.custom_note,
    '<p>Let me know if you have any questions or if priorities have changed.</p>',
    `<p>${tokens.sign_off_name}</p>`,
  ]
    .filter(Boolean)
    .join('\n')

  const slackBody = [
    `Hey ${tokens.first_name},`,
    '',
    `Hope all is well. Here's a status on the action items from our prior meetings.`,
    '',
    `*Progress:* ${tokens.completed_count} of ${tokens.total_count} items complete.${tokens.estimated_completion}`,
    '',
    tokens.task_list_mrkdwn,
    tokens.custom_note_mrkdwn,
    'Let me know if you have any questions or if priorities have changed.',
    '',
    tokens.sign_off_name,
  ]
    .filter((line) => line !== undefined)
    .join('\n')

  return { subject, body, slackBody }
}

/** Replace {{token}} placeholders in a template string. */
function replaceTokens(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => tokens[key] ?? '')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
