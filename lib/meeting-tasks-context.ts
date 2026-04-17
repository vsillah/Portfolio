/**
 * Meeting tasks context for email generation.
 *
 * Loads open outreach-category action items attributed to a contact and formats
 * them for inclusion in cold-outreach and follow-up email prompts. Uses
 * Mustache-style sentinels so the prompt block vanishes entirely when the
 * contact has no open action items (no dangling "## Open Action Items" header
 * with an empty list).
 *
 * Consumers:
 *   - lib/outreach-queue-generator.ts  (cold outreach, step 1 only)
 *   - lib/delivery-email.ts             (follow-up template)
 *
 * Safety:
 *   - Only includes tasks with status IN ('pending', 'in_progress') so completed
 *     and cancelled items never leak into prompts.
 *   - Only includes task_category = 'outreach' so internal-only tasks
 *     (e.g. "Update the CRM") never leak into prospect-facing emails.
 *   - Caps the list at MEETING_ACTION_ITEMS_MAX to keep prompts bounded.
 */

import { supabaseAdmin } from '@/lib/supabase'

export interface MeetingActionItemContext {
  id: string
  title: string
  status: 'pending' | 'in_progress'
  due_date: string | null
  created_at: string
}

/** Max action items surfaced in a single prompt. Keeps token cost bounded. */
export const MEETING_ACTION_ITEMS_MAX = 5

export async function loadOpenOutreachTasksForContact(
  contactId: number,
  limit: number = MEETING_ACTION_ITEMS_MAX
): Promise<MeetingActionItemContext[]> {
  if (!supabaseAdmin) return []
  if (!contactId || contactId <= 0) return []

  const { data, error } = await supabaseAdmin
    .from('meeting_action_tasks')
    .select('id, title, status, due_date, created_at')
    .eq('contact_submission_id', contactId)
    .eq('task_category', 'outreach')
    .in('status', ['pending', 'in_progress'])
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[meeting-tasks-context] fetch failed:', error)
    return []
  }
  return (data ?? []) as MeetingActionItemContext[]
}

/**
 * Format tasks as a plain-text bulleted list. Returns `null` when the input
 * list is empty so callers can distinguish "no tasks" (hide the section) from
 * "tasks exist but format produced empty string" (shouldn't happen).
 *
 * Format:
 *   - <title> (due <locale date>)
 *   - <title>                         // no due date
 */
export function formatMeetingActionItemsBlock(
  tasks: MeetingActionItemContext[]
): string | null {
  if (tasks.length === 0) return null
  return tasks
    .map(t => {
      const title = t.title.trim()
      const due = t.due_date ? ` (due ${formatDate(t.due_date)})` : ''
      return `- ${title}${due}`
    })
    .join('\n')
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

/**
 * Apply `{{meeting_action_items}}` + `{{#meeting_action_items}}…{{/meeting_action_items}}`
 * Mustache-style placeholder replacement.
 *
 * - When `block` is non-null: the sentinel block is kept and `{{meeting_action_items}}`
 *   is replaced with the formatted bullets.
 * - When `block` is null (no open tasks): the entire `{{#...}}…{{/...}}` block
 *   is removed and a bare `{{meeting_action_items}}` placeholder becomes empty
 *   string (defensive — should always appear inside the sentinels).
 *
 * The sentinel pattern matches the existing convention in lib/delivery-email.ts
 * for other optional blocks (`{{#company}}…`, `{{#calendly_link}}…`, etc).
 */
export function applyMeetingActionItemsPlaceholders(
  prompt: string,
  block: string | null
): string {
  const withSection = prompt.replace(
    /\{\{#meeting_action_items\}\}([\s\S]*?)\{\{\/meeting_action_items\}\}/g,
    block ? '$1' : ''
  )
  return withSection.replace(/\{\{meeting_action_items\}\}/g, block ?? '')
}
