/**
 * Seed meeting_records for Social Content / WF-SOC-001 local testing.
 * Rows are flagged is_test_data and keyed by read_ai_meeting_id for idempotent upserts.
 *
 * Run: npx tsx scripts/seed-social-content-test-meetings.ts
 *
 * Prerequisites: .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (dev project).
 * Refuses the production Supabase URL used in seed-dev.ts.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const PROD_URL_MARKER = 'byoriebhtbysanjhimlu'

const SEED_READ_AI_IDS = ['seed-social-demo-1', 'seed-social-demo-2', 'seed-social-demo-3'] as const

const DEMO_MEETINGS: Array<{
  read_ai_meeting_id: (typeof SEED_READ_AI_IDS)[number]
  title: string
  transcript: string
}> = [
  {
    read_ai_meeting_id: 'seed-social-demo-1',
    title: 'Demo: DEI and culture roadmap',
    transcript: `Facilitator: Thanks for joining. Let's recap priorities for Q2.

Alex: We want real movement on inclusion, not just training checkboxes. Our ERGs asked for budget for external speakers and mentorship pairings.

Jamie: Agreed. We should post a short series on LinkedIn about what we learned from the last employee survey—especially #diversity #inclusion and #workplace psychological safety.

Alex: One concrete win: we're piloting structured 1:1s between directors and frontline staff. I'll send bullet notes for comms to turn into posts.

Jamie: Perfect. Let's also highlight the new flexible work policy and how it ties to retention.

Action: Comms drafts three LinkedIn posts from this transcript by Friday.`,
  },
  {
    read_ai_meeting_id: 'seed-social-demo-2',
    title: 'Demo: Product launch sync',
    transcript: `PM: Launch is April 22. Messaging pillars: speed, security, and small-business friendly pricing.

Marketing: We'll run a thread on X and a carousel on LinkedIn. Hook: "We shipped the thing customers asked for loudest."

Sales: Need one customer quote—we have approval from Northwind LLC.

Engineering: Feature flag is at 10% canary; no blockers.

Action: Social team schedules teaser + launch day posts.`,
  },
  {
    read_ai_meeting_id: 'seed-social-demo-3',
    title: 'Demo: Weekly pipeline review',
    transcript: `Rep 1: Two discovery calls went well; both care about automating follow-ups after events.

Rep 2: Sent proposals to Acme and Contoso. Follow-up Thursday.

Manager: Let's share a post about "event follow-up that actually converts" using anonymized patterns—no names.

Action: Draft post from this call by EOD Wednesday.`,
  },
]

function assertDevUrl(url: string) {
  if (url.includes(PROD_URL_MARKER)) {
    console.error('ABORT: .env.local points at the production Supabase project.')
    console.error('Use your dev project URL only.')
    process.exit(1)
  }
}

async function upsertMeeting(sb: SupabaseClient, row: (typeof DEMO_MEETINGS)[number]) {
  const meetingDate = new Date().toISOString()
  const rawNotes = `${row.title}\n\n${row.transcript.slice(0, 500)}`

  const payload = {
    meeting_type: 'discovery',
    meeting_date: meetingDate,
    duration_minutes: 30,
    transcript: row.transcript,
    raw_notes: rawNotes,
    structured_notes: { title: row.title },
    attendees: [{ name: 'Demo User', email: 'social-seed-demo@example.com' }],
    is_test_data: true,
    read_ai_meeting_id: row.read_ai_meeting_id,
  }

  const { data: existing, error: selErr } = await sb
    .from('meeting_records')
    .select('id')
    .eq('read_ai_meeting_id', row.read_ai_meeting_id)
    .maybeSingle()

  if (selErr) {
    console.error(`Lookup failed for ${row.read_ai_meeting_id}:`, selErr.message)
    return false
  }

  if (existing?.id) {
    const { error } = await sb.from('meeting_records').update(payload).eq('id', existing.id)
    if (error) {
      console.error(`Update failed for ${row.read_ai_meeting_id}:`, error.message)
      return false
    }
    console.log(`Updated meeting_records id=${existing.id} (${row.read_ai_meeting_id})`)
    return true
  }

  const { data, error } = await sb.from('meeting_records').insert(payload).select('id').single()
  if (error) {
    console.error(`Insert failed for ${row.read_ai_meeting_id}:`, error.message)
    if (error.message.includes('meeting_type') || error.code === '23514') {
      console.error('Hint: If meeting_type CHECK rejects "discovery", widen the constraint or change meeting_type in this script.')
    }
    return false
  }
  console.log(`Inserted meeting_records id=${data.id} (${row.read_ai_meeting_id})`)
  return true
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }
  assertDevUrl(url)

  const sb = createClient(url, key)
  let ok = 0
  for (const row of DEMO_MEETINGS) {
    if (await upsertMeeting(sb, row)) ok++
  }

  console.log(`\nDone. ${ok}/${DEMO_MEETINGS.length} meetings ready.`)
  console.log('Open Admin → Social Content → Run Extraction; search "Demo:" or "seed" to pick these meetings.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
