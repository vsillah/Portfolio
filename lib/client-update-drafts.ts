/**
 * Client Update Drafts — Generate, Render, Send
 *
 * Builds draft client-update emails from completed meeting_action_tasks,
 * stores them in client_update_drafts, and sends via the progress-update
 * n8n webhook when the admin clicks "Send".
 */

import { supabaseAdmin } from './supabase'
import type { MeetingActionTask } from './meeting-action-tasks'
import { getAllActiveUpsellPaths, matchesNextProblemSignals, formatUpsellRecommendation } from './upsell-paths'

// ============================================================================
// Types
// ============================================================================

export interface ClientUpdateDraft {
  id: string
  client_project_id: string
  meeting_record_id: string | null
  subject: string
  body: string
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

export interface CreateDraftDirectInput {
  /** Which project this draft is for */
  clientProjectId: string
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
  callback_url: string
}

// ============================================================================
// Configuration
// ============================================================================

const N8N_PROGRESS_UPDATE_WEBHOOK_URL = process.env.N8N_PROGRESS_UPDATE_WEBHOOK_URL

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
      client_project_id: clientProjectId,
      meeting_record_id: meetingRecordId || null,
      subject,
      body,
      client_email: clientEmail,
      client_name: clientName,
      task_ids: [], // No tasks — this is a direct draft
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
    slack_body: draft.body, // Slack gets the same body (plain text)
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
    'Amadutown',
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
