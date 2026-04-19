/**
 * Retroactively run meeting action-item promotion for existing meeting_records.
 *
 * After code changes to `promoteActionItems` (aligned parsing with meeting detail),
 * re-run this script so historical meetings gain `meeting_action_tasks` rows for
 * text-only action items, structured_notes.action_items, etc. Idempotent: global
 * title dedupe in `promoteActionItems` skips existing tasks.
 *
 * Usage:
 *   Dry run (preview counts, no writes):
 *     npx tsx scripts/backfill-meeting-action-tasks-promotion.ts
 *     npx tsx scripts/backfill-meeting-action-tasks-promotion.ts --dry-run
 *
 *   Apply (call promoteActionItems per meeting):
 *     npx tsx scripts/backfill-meeting-action-tasks-promotion.ts --apply
 *
 *   Production (same flags; uses PROD_* env vars):
 *     npx tsx scripts/backfill-meeting-action-tasks-promotion.ts --prod --dry-run
 *     npx tsx scripts/backfill-meeting-action-tasks-promotion.ts --prod --apply
 *
 *   Options:
 *     --meeting-id=<uuid>   Only this meeting
 *     --limit=<n>           Max meetings to process (default: all)
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * (or PROD_* when --prod).
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

import { countResolvableActionItems } from '../lib/meeting-action-items-resolve'

const argv = process.argv.slice(2)
const args = new Set(argv)
const isProd = args.has('--prod')
/** Dry run unless --apply is passed (without --dry-run). */
const dryRun = args.has('--dry-run') || !args.has('--apply')

function argValue(prefix: string): string | null {
  const hit = argv.find((a) => a.startsWith(prefix))
  if (!hit) return null
  const [, v] = hit.split('=', 2)
  return v ?? null
}

const meetingIdFilter = argValue('--meeting-id')
const limitArg = argValue('--limit')
const limit = limitArg ? parseInt(limitArg, 10) : null
if (limitArg && (Number.isNaN(limit!) || limit! < 1)) {
  console.error('Invalid --limit')
  process.exit(1)
}

const supabaseUrl = isProd
  ? process.env.PROD_SUPABASE_URL
  : process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = isProd
  ? process.env.PROD_SUPABASE_SERVICE_ROLE_KEY
  : process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    `Missing ${isProd ? 'PROD_' : ''}Supabase env. Need URL + SERVICE_ROLE key in .env.local.`
  )
  process.exit(1)
}

console.log(`Target: ${isProd ? 'PRODUCTION' : 'DEV'} (${supabaseUrl})`)
console.log(`Mode:   ${dryRun ? 'DRY RUN (preview only)' : 'APPLY (promoteActionItems)'}`)
if (meetingIdFilter) console.log(`Filter: meeting id = ${meetingIdFilter}`)
if (limit) console.log(`Limit:  ${limit} meetings`)
console.log('')

const sb = createClient(supabaseUrl, serviceRoleKey)

async function loadMeetingIds(): Promise<string[]> {
  let q = sb.from('meeting_records').select('id').order('meeting_date', { ascending: false })
  if (meetingIdFilter) {
    q = q.eq('id', meetingIdFilter)
  }
  if (limit) {
    q = q.limit(limit)
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: { id: string }) => r.id)
}

async function main() {
  const ids = await loadMeetingIds()
  console.log(`Meetings to scan: ${ids.length}\n`)

  if (ids.length === 0) {
    console.log('Nothing to do.')
    return
  }

  const { promoteActionItems } = await import('../lib/meeting-action-tasks')

  let totalCreated = 0
  let totalSkipped = 0
  let previewLines = 0

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    if (dryRun) {
      const { data: row, error } = await sb
        .from('meeting_records')
        .select('id, action_items, structured_notes, key_decisions')
        .eq('id', id)
        .single()
      if (error || !row) {
        console.warn(`[${i + 1}/${ids.length}] ${id} fetch failed: ${error?.message}`)
        continue
      }
      const n = countResolvableActionItems(row)
      previewLines += n
      if (n > 0) {
        console.log(`[${i + 1}/${ids.length}] ${id} → ${n} resolvable action line(s)`)
      }
    } else {
      try {
        const { created, skipped } = await promoteActionItems(id)
        totalCreated += created
        totalSkipped += skipped
        if (created > 0 || skipped > 0) {
          console.log(`[${i + 1}/${ids.length}] ${id} → created ${created}, skipped ${skipped}`)
        }
      } catch (e) {
        console.error(`[${i + 1}/${ids.length}] ${id} ERROR:`, e instanceof Error ? e.message : e)
      }
    }
  }

  if (dryRun) {
    console.log(`\nDry run complete. Total resolvable action lines (sum per meeting): ${previewLines}`)
    console.log('Re-run with --apply to insert tasks (respecting global title dedupe).')
  } else {
    console.log(`\nDone. Total created: ${totalCreated}, total skipped (dupes/empty): ${totalSkipped}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
