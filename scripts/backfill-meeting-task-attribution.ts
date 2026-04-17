/**
 * Backfill script for Phase 4 (Meeting Task Attribution + Outreach Integration).
 *
 * What it does (idempotent):
 *   1. Re-cascades meeting_action_tasks.contact_submission_id from
 *      meeting_records.contact_submission_id for any task where the task is
 *      NULL and the parent meeting has a value. (Safety net — the
 *      2026_04_17 migration already did this; re-running is cheap.)
 *
 *   2. Re-classifies meeting_action_tasks.task_category by running
 *      inferTaskCategory(title, description) against every task that is
 *      currently 'internal' (the migration default). Flips 'internal' →
 *      'outreach' when the heuristic matches. Never flips 'outreach' → anything
 *      (preserves admin retargeting).
 *
 * What it does NOT do:
 *   - Populate meeting_action_tasks.outreach_queue_id on historical rows
 *     (no durable mapping to past outreach_queue drafts).
 *   - Populate outreach_queue.source_task_id on historical rows
 *     (same reason).
 *   - Touch orphan tasks where meeting_record_id IS NULL AND the parent
 *     meeting never had a contact attribution (requires manual admin action
 *     via /admin/meeting-tasks).
 *
 * Usage:
 *   Dry run (dev):              npx tsx scripts/backfill-meeting-task-attribution.ts
 *   Apply to dev:               npx tsx scripts/backfill-meeting-task-attribution.ts --apply
 *   Dry run against production: npx tsx scripts/backfill-meeting-task-attribution.ts --prod
 *   Apply to production:        npx tsx scripts/backfill-meeting-task-attribution.ts --prod --apply
 *
 * Exits non-zero on error; idempotent and safe to re-run.
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { inferTaskCategory } from '../lib/meeting-action-task-category'

const args = new Set(process.argv.slice(2))
const isProd = args.has('--prod')
const apply = args.has('--apply')

const supabaseUrl = isProd
  ? process.env.PROD_SUPABASE_URL
  : process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = isProd
  ? process.env.PROD_SUPABASE_SERVICE_ROLE_KEY
  : process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    `Missing ${isProd ? 'PROD_' : ''}SUPABASE env vars. ` +
      `Need ${isProd ? 'PROD_SUPABASE_URL + PROD_SUPABASE_SERVICE_ROLE_KEY' : 'NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'} in .env.local.`
  )
  process.exit(1)
}

console.log(`Target:   ${isProd ? 'PRODUCTION' : 'DEV'}  (${supabaseUrl})`)
console.log(`Mode:     ${apply ? 'APPLY (writes)' : 'DRY RUN (no writes)'}`)
console.log('')

const sb = createClient(supabaseUrl, serviceRoleKey)

// Supabase row shapes kept minimal; we select only what we touch.
interface TaskRow {
  id: string
  meeting_record_id: string | null
  contact_submission_id: number | null
  task_category: 'internal' | 'outreach' | null
  title: string
  description: string | null
}

interface MeetingRow {
  id: string
  contact_submission_id: number | null
}

async function step1_cascadeContactSubmissionId(): Promise<{
  scanned: number
  wouldUpdate: number
  updated: number
}> {
  console.log('─── Step 1: Cascade contact_submission_id from meeting_records ───')

  const { data: tasks, error: tasksErr } = await sb
    .from('meeting_action_tasks')
    .select('id, meeting_record_id, contact_submission_id')
    .is('contact_submission_id', null)
    .not('meeting_record_id', 'is', null)

  if (tasksErr) throw new Error(`Fetch tasks failed: ${tasksErr.message}`)
  const scanned = tasks?.length ?? 0
  if (scanned === 0) {
    console.log('  No tasks with NULL contact_submission_id and a parent meeting. Nothing to do.\n')
    return { scanned: 0, wouldUpdate: 0, updated: 0 }
  }

  const meetingIds = Array.from(
    new Set((tasks as TaskRow[]).map(t => t.meeting_record_id).filter((x): x is string => Boolean(x)))
  )

  const { data: meetings, error: mErr } = await sb
    .from('meeting_records')
    .select('id, contact_submission_id')
    .in('id', meetingIds)

  if (mErr) throw new Error(`Fetch meetings failed: ${mErr.message}`)

  const contactByMeeting = new Map<string, number>()
  for (const m of (meetings as MeetingRow[]) ?? []) {
    if (m.contact_submission_id != null) contactByMeeting.set(m.id, m.contact_submission_id)
  }

  const toUpdate: Array<{ id: string; contact_submission_id: number }> = []
  for (const t of tasks as TaskRow[]) {
    if (!t.meeting_record_id) continue
    const cid = contactByMeeting.get(t.meeting_record_id)
    if (cid != null) toUpdate.push({ id: t.id, contact_submission_id: cid })
  }

  console.log(`  Scanned:       ${scanned} tasks with NULL contact_submission_id`)
  console.log(`  Eligible:      ${toUpdate.length} (parent meeting has a contact)`)
  console.log(`  Not eligible:  ${scanned - toUpdate.length} (parent meeting also NULL)`)

  if (!apply) {
    if (toUpdate.length > 0) console.log('  [dry-run] Sample:', toUpdate.slice(0, 3))
    console.log('')
    return { scanned, wouldUpdate: toUpdate.length, updated: 0 }
  }

  // Writes must be per-row to avoid bypassing RLS semantics or ON DELETE hooks.
  let updated = 0
  for (const row of toUpdate) {
    const { error } = await sb
      .from('meeting_action_tasks')
      .update({ contact_submission_id: row.contact_submission_id })
      .eq('id', row.id)
      .is('contact_submission_id', null) // safety: only if still null
    if (error) {
      console.error(`  FAILED to update task ${row.id}: ${error.message}`)
    } else {
      updated += 1
    }
  }
  console.log(`  Updated:       ${updated}\n`)
  return { scanned, wouldUpdate: toUpdate.length, updated }
}

async function step2_reclassifyTaskCategory(): Promise<{
  scanned: number
  wouldFlip: number
  flipped: number
}> {
  console.log('─── Step 2: Re-classify task_category via inferTaskCategory ───')

  // Only scan tasks currently 'internal' (default from migration) — never
  // demote existing 'outreach' rows. We also include NULL rows defensively,
  // in case any slipped through before the DEFAULT applied.
  const { data: tasks, error } = await sb
    .from('meeting_action_tasks')
    .select('id, task_category, title, description')
    .or('task_category.eq.internal,task_category.is.null')

  if (error) throw new Error(`Fetch tasks failed: ${error.message}`)
  const scanned = tasks?.length ?? 0
  if (scanned === 0) {
    console.log('  No internal/NULL tasks. Nothing to do.\n')
    return { scanned: 0, wouldFlip: 0, flipped: 0 }
  }

  const toFlip: Array<{ id: string; title: string }> = []
  for (const t of tasks as TaskRow[]) {
    const inferred = inferTaskCategory(t.title ?? '', t.description)
    if (inferred === 'outreach') toFlip.push({ id: t.id, title: t.title })
  }

  console.log(`  Scanned:       ${scanned} internal/NULL tasks`)
  console.log(`  Would flip to outreach: ${toFlip.length}`)

  if (!apply) {
    if (toFlip.length > 0) {
      console.log('  [dry-run] Sample titles that would flip:')
      for (const s of toFlip.slice(0, 5)) console.log(`    - ${s.title}`)
    }
    console.log('')
    return { scanned, wouldFlip: toFlip.length, flipped: 0 }
  }

  let flipped = 0
  for (const row of toFlip) {
    const { error: updErr } = await sb
      .from('meeting_action_tasks')
      .update({ task_category: 'outreach' })
      .eq('id', row.id)
      .or('task_category.eq.internal,task_category.is.null') // safety: don't clobber manual outreach
    if (updErr) {
      console.error(`  FAILED to flip task ${row.id}: ${updErr.message}`)
    } else {
      flipped += 1
    }
  }
  console.log(`  Flipped:       ${flipped}\n`)
  return { scanned, wouldFlip: toFlip.length, flipped }
}

async function main() {
  const s1 = await step1_cascadeContactSubmissionId()
  const s2 = await step2_reclassifyTaskCategory()

  console.log('─── Summary ───')
  console.log(
    `Step 1 cascade:     scanned=${s1.scanned} eligible=${s1.wouldUpdate} updated=${s1.updated}`
  )
  console.log(
    `Step 2 reclassify:  scanned=${s2.scanned} wouldFlip=${s2.wouldFlip} flipped=${s2.flipped}`
  )
  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to write changes.')
  }
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
