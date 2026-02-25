/**
 * Meeting Action Tasks — Promote, CRUD, Slack Sync
 *
 * Promotes action_items from meeting_records into first-class
 * meeting_action_tasks rows, and provides helpers for listing,
 * updating status, and (optionally) mirroring to Slack channels.
 */

import { supabaseAdmin } from './supabase'
import { n8nWebhookUrl } from './n8n'

// ============================================================================
// Types
// ============================================================================

/** Shape of an action item as stored in meeting_records.action_items JSONB */
export interface MeetingActionItem {
  /** Display text; WF-MCH AI uses "action", some sources use "title" */
  title?: string
  action?: string
  description?: string
  owner?: string
  due_date?: string
  status?: string
}

/** Row shape for meeting_action_tasks */
export interface MeetingActionTask {
  id: string
  meeting_record_id: string
  client_project_id: string | null
  title: string
  description: string | null
  owner: string | null
  due_date: string | null
  status: 'pending' | 'in_progress' | 'complete' | 'cancelled'
  completed_at: string | null
  completed_by: string | null
  display_order: number
  external_id: string | null
  slack_message_ts: string | null
  slack_channel_id: string | null
  created_at: string
  updated_at: string
}

export type TaskStatus = MeetingActionTask['status']

/** Payload for the Slack task-sync n8n webhook */
export interface SlackTaskSyncPayload {
  action: 'create' | 'update_status'
  tasks: Array<{
    id: string
    title: string
    owner: string | null
    due_date: string | null
    status: TaskStatus
    meeting_type: string | null
    project_name: string | null
    client_name: string | null
  }>
}

// ============================================================================
// Promote: meeting_records.action_items → meeting_action_tasks
// ============================================================================

/**
 * Promote action_items from a single meeting_record into meeting_action_tasks.
 * Skips items that already exist (idempotent by meeting_record_id + title).
 *
 * Returns the number of tasks created.
 */
export async function promoteActionItems(
  meetingRecordId: string
): Promise<{ created: number; skipped: number }> {
  // 1. Fetch the meeting record
  const { data: record, error: fetchErr } = await supabaseAdmin
    .from('meeting_records')
    .select('id, client_project_id, action_items')
    .eq('id', meetingRecordId)
    .single()

  if (fetchErr || !record) {
    throw new Error(`Meeting record not found: ${meetingRecordId}`)
  }

  const rawItems: MeetingActionItem[] = Array.isArray(record.action_items)
    ? record.action_items
    : []

  if (rawItems.length === 0) {
    return { created: 0, skipped: 0 }
  }

  // 2. Check which titles already exist for this meeting (idempotency)
  const { data: existing } = await supabaseAdmin
    .from('meeting_action_tasks')
    .select('title')
    .eq('meeting_record_id', meetingRecordId)

  const existingTitles = new Set(
    (existing || []).map((t: { title: string }) => t.title.toLowerCase().trim())
  )

  // 3. Build rows for new tasks only
  // WF-MCH AI returns "action"; promote also accepts "title"
  const toInsert = rawItems
    .filter(item => {
      const title = (item.title || item.action || '').trim()
      return title.length > 0 && !existingTitles.has(title.toLowerCase())
    })
    .map((item, idx) => ({
      meeting_record_id: meetingRecordId,
      client_project_id: record.client_project_id ?? null,
      title: (item.title || item.action || 'Untitled action').trim(),
      description: item.description || null,
      owner: item.owner || null,
      due_date: item.due_date || null,
      status: normaliseStatus(item.status),
      display_order: (existing?.length || 0) + idx,
    }))

  if (toInsert.length === 0) {
    return { created: 0, skipped: rawItems.length }
  }

  // 4. Insert
  const { error: insertErr } = await supabaseAdmin
    .from('meeting_action_tasks')
    .insert(toInsert)

  if (insertErr) {
    throw new Error(`Failed to insert tasks: ${insertErr.message}`)
  }

  return { created: toInsert.length, skipped: rawItems.length - toInsert.length }
}

// ============================================================================
// CRUD helpers
// ============================================================================

/** List tasks, optionally filtered by meeting or project */
export async function listTasks(filters: {
  meetingRecordId?: string
  clientProjectId?: string
  status?: TaskStatus | TaskStatus[]
}): Promise<MeetingActionTask[]> {
  let query = supabaseAdmin
    .from('meeting_action_tasks')
    .select('*')
    .order('display_order', { ascending: true })

  if (filters.meetingRecordId) {
    query = query.eq('meeting_record_id', filters.meetingRecordId)
  }
  if (filters.clientProjectId) {
    query = query.eq('client_project_id', filters.clientProjectId)
  }
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
    query = query.in('status', statuses)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to list tasks: ${error.message}`)
  }

  return (data || []) as MeetingActionTask[]
}

/** Update one or more fields on a task */
export async function updateTask(
  taskId: string,
  updates: Partial<Pick<MeetingActionTask, 'title' | 'description' | 'owner' | 'due_date' | 'status' | 'external_id' | 'slack_message_ts' | 'slack_channel_id'>>,
  userId?: string
): Promise<MeetingActionTask> {
  // Auto-set completed_at / completed_by when status → complete
  const patch: Record<string, unknown> = { ...updates }
  if (updates.status === 'complete') {
    patch.completed_at = new Date().toISOString()
    if (userId) patch.completed_by = userId
  } else if (updates.status) {
    // Moving away from complete → clear completion fields
    patch.completed_at = null
    patch.completed_by = null
  }

  const { data, error } = await supabaseAdmin
    .from('meeting_action_tasks')
    .update(patch)
    .eq('id', taskId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to update task ${taskId}: ${error?.message}`)
  }

  return data as MeetingActionTask
}

// ============================================================================
// Slack sync (optional — fires n8n webhook to mirror tasks to Slack)
// ============================================================================

const N8N_TASK_SLACK_SYNC_URL = process.env.N8N_TASK_SLACK_SYNC_WEBHOOK_URL
  || n8nWebhookUrl('task-slack-sync')

/**
 * Fire the Slack task sync webhook so n8n can post or update
 * task messages in the appropriate Slack Kanban channel.
 */
export async function syncTasksToSlack(
  payload: SlackTaskSyncPayload
): Promise<{ synced: boolean; message: string }> {
  if (!N8N_TASK_SLACK_SYNC_URL) {
    console.warn('N8N_TASK_SLACK_SYNC_WEBHOOK_URL not configured — skipping Slack sync')
    return { synced: false, message: 'N8N_TASK_SLACK_SYNC_WEBHOOK_URL not configured' }
  }

  try {
    const res = await fetch(N8N_TASK_SLACK_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[Slack sync] n8n returned ${res.status}: ${text}`)
      return { synced: false, message: `n8n returned ${res.status}` }
    }

    return { synced: true, message: 'Tasks synced to Slack' }
  } catch (err) {
    console.error('[Slack sync] Failed:', err)
    return { synced: false, message: String(err) }
  }
}

// ============================================================================
// Helpers
// ============================================================================

/** Normalise various status strings from AI extraction to our enum */
function normaliseStatus(raw?: string): TaskStatus {
  if (!raw) return 'pending'
  const lower = raw.toLowerCase().trim()
  if (lower === 'complete' || lower === 'completed' || lower === 'done') return 'complete'
  if (lower === 'in_progress' || lower === 'in progress' || lower === 'active') return 'in_progress'
  if (lower === 'cancelled' || lower === 'canceled' || lower === 'dropped') return 'cancelled'
  return 'pending'
}
