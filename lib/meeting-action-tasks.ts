/**
 * Meeting Action Tasks — Promote, CRUD, Slack Sync
 *
 * Promotes action_items from meeting_records into first-class
 * meeting_action_tasks rows, and provides helpers for listing,
 * updating status, and (optionally) mirroring to Slack channels.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './supabase'
import { n8nWebhookUrl, isN8nOutboundDisabled, logDisabledOutbound } from './n8n'
// TaskCategory lives in ./meeting-action-task-category so backfill scripts can
// import it without pulling in Supabase (lib/supabase.ts validates env at load
// time). Imported locally here and re-exported below for consumers.
import type { TaskCategory } from './meeting-action-task-category'
import { inferTaskCategory } from './meeting-action-task-category'
import {
  normalizeActionItemsFromUnknownList,
  resolveActionItemsRawList,
} from './meeting-action-items-resolve'
import { syncRoadmapTaskFromProjection } from './client-ai-ops-roadmap-db'

// ============================================================================
// Types
// ============================================================================

/** Shape of an action item as stored in meeting_records.action_items JSONB */
export interface MeetingActionItem {
  /** Display text; WF-MCH AI uses "action", Read.ai uses "text", some sources use "title" */
  title?: string
  action?: string
  text?: string
  description?: string
  owner?: string
  assignee?: string
  due_date?: string
  status?: string
}

/** Row shape for meeting_action_tasks */
export interface MeetingActionTask {
  id: string
  meeting_record_id: string | null
  client_project_id: string | null
  contact_submission_id: number | null
  task_category: TaskCategory
  outreach_queue_id: string | null
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
  roadmap_task_id?: string | null
}

export type TaskStatus = MeetingActionTask['status']
export type { TaskCategory }
export const TASK_CATEGORIES: TaskCategory[] = ['internal', 'outreach']

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
 *
 * @param options.db Optional Supabase client (e.g. prod service-role from a script).
 *                    Defaults to `supabaseAdmin` (dev URL from env in local scripts).
 */
export async function promoteActionItems(
  meetingRecordId: string,
  options?: { db?: SupabaseClient }
): Promise<{ created: number; skipped: number }> {
  const db = options?.db ?? supabaseAdmin
  if (!db) {
    throw new Error('promoteActionItems: no database client (pass options.db or run server-side)')
  }

  // 1. Fetch the meeting record (include key_decisions, structured_notes for fallback when action_items is empty)
  const { data: record, error: fetchErr } = await db
    .from('meeting_records')
    .select('id, client_project_id, contact_submission_id, action_items, key_decisions, structured_notes')
    .eq('id', meetingRecordId)
    .single()

  if (fetchErr || !record) {
    throw new Error(`Meeting record not found: ${meetingRecordId}`)
  }

  const rawList = resolveActionItemsRawList(record)
  const normalized = normalizeActionItemsFromUnknownList(rawList)

  if (normalized.length === 0) {
    return { created: 0, skipped: 0 }
  }

  // Dedupe within this meeting by title (case-insensitive) before global check
  const uniqueByTitle: typeof normalized = []
  const seenLocal = new Set<string>()
  for (const n of normalized) {
    const k = n.title.toLowerCase()
    if (seenLocal.has(k)) continue
    seenLocal.add(k)
    uniqueByTitle.push(n)
  }

  // 2. Check which titles already exist globally (prevents cross-meeting duplicates)
  const { data: existing } = await supabaseAdmin
    .from('meeting_action_tasks')
    .select('title, meeting_record_id')

  const existingTitles = new Set(
    (existing || []).map((t: { title: string }) => t.title.toLowerCase().trim())
  )

  // 3. Build rows for new tasks only (same field rules as meeting detail / normalize helper)
  const toInsert = uniqueByTitle
    .filter((item) => {
      const title = item.title.trim()
      return title.length > 0 && !existingTitles.has(title.toLowerCase())
    })
    .map((item, idx) => {
      const title = item.title.trim()
      const description = item.description
      return {
        meeting_record_id: meetingRecordId,
        client_project_id: record.client_project_id ?? null,
        contact_submission_id: (record.contact_submission_id as number | null) ?? null,
        task_category: inferTaskCategory(title, description),
        title,
        description,
        owner: normaliseOwner(item.owner ?? undefined),
        due_date: normaliseDueDate(item.due_date),
        status: normaliseStatus(item.status ?? undefined),
        display_order: (existing?.length || 0) + idx,
      }
    })

  if (toInsert.length === 0) {
    return { created: 0, skipped: normalized.length }
  }

  // 4. Insert
  const { error: insertErr } = await supabaseAdmin
    .from('meeting_action_tasks')
    .insert(toInsert)

  if (insertErr) {
    throw new Error(`Failed to insert tasks: ${insertErr.message}`)
  }

  return { created: toInsert.length, skipped: normalized.length - toInsert.length }
}

// ============================================================================
// CRUD helpers
// ============================================================================

/** List tasks, optionally filtered by meeting, project, contact, category, or status */
export async function listTasks(filters: {
  meetingRecordId?: string
  clientProjectId?: string
  contactSubmissionId?: number
  taskCategory?: TaskCategory | TaskCategory[]
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
  if (typeof filters.contactSubmissionId === 'number') {
    query = query.eq('contact_submission_id', filters.contactSubmissionId)
  }
  if (filters.taskCategory) {
    const cats = Array.isArray(filters.taskCategory) ? filters.taskCategory : [filters.taskCategory]
    query = query.in('task_category', cats)
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
  updates: Partial<Pick<MeetingActionTask,
    'title' | 'description' | 'owner' | 'due_date' | 'status' |
    'external_id' | 'slack_message_ts' | 'slack_channel_id' |
    'contact_submission_id' | 'task_category' | 'outreach_queue_id'
  >>,
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

  if (updates.status) {
    await syncRoadmapTaskFromProjection('meeting', taskId, updates.status).catch((err) => {
      console.error('Error syncing roadmap task from meeting task:', err)
    })
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
  if (isN8nOutboundDisabled()) {
    logDisabledOutbound('syncTasksToSlack', N8N_TASK_SLACK_SYNC_URL, payload)
    return { synced: false, message: 'N8N_DISABLE_OUTBOUND is true' }
  }

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

/** Map AI-extracted owner names to canonical names */
const OWNER_ALIASES: Record<string, string> = {
  'dipesh': 'Pesh Chalise',
  'pesh': 'Pesh Chalise',
  'pesh chalise': 'Pesh Chalise',
  'dipesh and vambah': 'Pesh Chalise',
  'vambah': 'Vambah Sillah',
  'vambah sillah': 'Vambah Sillah',
  'ethan': 'Ethan Wager',
  'ethan wager': 'Ethan Wager',
  'amadou': 'Amadou Town',
  'amadou town': 'Amadou Town',
  'host': 'Amadou Town',
}

function normaliseOwner(raw?: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  return OWNER_ALIASES[trimmed.toLowerCase()] ?? trimmed
}

/**
 * Accept only values the Postgres `date` column can parse; AI extractors often emit
 * fuzzy phrases like "Next month" or "End of week" which would fail the insert.
 * We keep ISO YYYY-MM-DD (optionally with time) and drop anything else to null.
 */
function normaliseDueDate(raw?: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  // Accept "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM…"; strip time portion for date column.
  const m = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:[T ].*)?$/)
  if (!m) return null
  const dateOnly = m[1]
  const t = Date.parse(dateOnly)
  return Number.isNaN(t) ? null : dateOnly
}

// inferTaskCategory is defined in a Supabase-free module so backfill scripts
// can import it before dotenv populates process.env. Re-exported here to keep
// existing imports working.
export { inferTaskCategory } from './meeting-action-task-category'

/** Normalise various status strings from AI extraction to our enum */
function normaliseStatus(raw?: string): TaskStatus {
  if (!raw) return 'pending'
  const lower = raw.toLowerCase().trim()
  if (lower === 'complete' || lower === 'completed' || lower === 'done') return 'complete'
  if (lower === 'in_progress' || lower === 'in progress' || lower === 'active') return 'in_progress'
  if (lower === 'cancelled' || lower === 'canceled' || lower === 'dropped') return 'cancelled'
  return 'pending'
}
