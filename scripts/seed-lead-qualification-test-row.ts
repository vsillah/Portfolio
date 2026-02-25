/**
 * Seed a contact_submissions row with id 99999 for Lead Qualification webhook testing.
 * The workflow's "Update a row" node filters by id = submissionId; if no row exists,
 * it returns 0 items and Route by Score never runs.
 *
 * Run with: npx tsx scripts/seed-lead-qualification-test-row.ts
 * Then: ./scripts/trigger-lead-qualification-webhook.sh
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(__dirname, '../.env.local')
try {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx)
    const value = trimmed.slice(eqIdx + 1)
    if (!process.env[key]) process.env[key] = value
  }
} catch {
  console.warn('No .env.local found; using existing env vars')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TEST_ID = 99999

const row = {
  id: TEST_ID,
  name: 'Test User',
  email: 'test-lead-qual-99999@example.com',
  company: 'Test Co',
  company_domain: 'test.com',
  linkedin_url: 'https://linkedin.com/in/test',
  annual_revenue: '100k_500k',
  interest_summary: 'AI adoption, process automation, lead qualification',
  message:
    'Interested in exploring AI automation for our sales team.',
  is_decision_maker: true,
  lead_source: 'website_form',
}

async function main() {
  const { data: existing } = await supabase
    .from('contact_submissions')
    .select('id')
    .eq('id', TEST_ID)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('contact_submissions')
      .update(row)
      .eq('id', TEST_ID)
    if (error) {
      console.error('Failed to update test row:', error.message)
      process.exit(1)
    }
    console.log(`Updated contact_submissions row id=${TEST_ID}`)
  } else {
    const { error } = await supabase
      .from('contact_submissions')
      .insert(row)
    if (error) {
      console.error('Failed to insert test row:', error.message)
      process.exit(1)
    }
    console.log(`Inserted contact_submissions row id=${TEST_ID}`)
  }

  console.log('Now run: ./scripts/trigger-lead-qualification-webhook.sh')
}

main()
