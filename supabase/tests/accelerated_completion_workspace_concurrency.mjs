// Run against staging with ACCELERATED_STAGING_PROJECT_REF set to the URL's
// project ref. Creates one synthetic auth user and removes it in finally.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
require('dotenv').config({ path: '.env.local', quiet: true })
const { createClient } = require('@supabase/supabase-js')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const expectedRef = process.env.ACCELERATED_STAGING_PROJECT_REF
assert.ok(url && key && expectedRef, 'Staging URL, service key, and explicit project ref are required')
assert.equal(new URL(url).hostname, `${expectedRef}.supabase.co`, 'Refusing to run against an unexpected project')

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const fixtureId = randomUUID()
let userId = null
const worksheetId = randomUUID()
const commandId = randomUUID()
const version = 'accelerated-l01-l16-ed73dee7'
let created = false

async function rows(table, column = 'user_id') {
  const result = await db.from(table).select('*').eq(column, userId)
  if (result.error) throw result.error
  return result.data ?? []
}

try {
  const createdUser = await db.auth.admin.createUser({
    email: `accelerated-completion-${fixtureId}@example.invalid`,
    email_confirm: true,
  })
  if (createdUser.error) throw createdUser.error
  userId = createdUser.data.user?.id
  assert.ok(userId, 'Synthetic user ID is required for cleanup')
  created = true

  const enrollment = await db.from('accelerated_member_enrollments').insert({
    user_id: userId, content_version: version, claim_sha256: 'a'.repeat(64),
  })
  if (enrollment.error) throw enrollment.error
  const worksheet = await db.from('accelerated_member_worksheets').insert({
    worksheet_id: worksheetId, user_id: userId, content_version: version, answers: {},
  })
  if (worksheet.error) throw worksheet.error

  const args = {
    p_user_id: userId, p_version: version, p_worksheet_id: worksheetId,
    p_answers: { L01: 'Synthetic concurrent save' }, p_expected_revision: 0,
    p_command_id: commandId, p_action: 'save', p_payload_sha256: 'b'.repeat(64),
    p_intake_sha256: null, p_learner_name: null, p_learner_email: null, p_consent: false,
  }
  const [first, second] = await Promise.all([
    db.rpc('accelerated_commit_completion_workspace', args),
    db.rpc('accelerated_commit_completion_workspace', args),
  ])
  if (first.error) throw first.error
  if (second.error) throw second.error
  assert.deepEqual([first.data?.[0]?.replay, second.data?.[0]?.replay].sort(), [false, true])
  assert.equal(first.data?.[0]?.revision, 1)
  assert.equal(second.data?.[0]?.revision, 1)
  assert.equal((await rows('accelerated_completion_commands')).length, 1)
  assert.equal((await rows('accelerated_member_enrollments'))[0]?.revision, 1)
  assert.deepEqual((await rows('accelerated_member_worksheets'))[0]?.answers, args.p_answers)

  const conflicting = await db.rpc('accelerated_commit_completion_workspace', {
    ...args, p_answers: { L01: 'Different evidence' }, p_payload_sha256: 'c'.repeat(64),
  })
  assert.equal(conflicting.error?.code, 'P0001', 'Same command with changed evidence must fail')
  const stale = await db.rpc('accelerated_commit_completion_workspace', {
    ...args, p_command_id: randomUUID(), p_payload_sha256: 'c'.repeat(64),
  })
  assert.equal(stale.error?.code, 'P0001', 'New command with stale revision must fail')
  assert.equal((await rows('accelerated_completion_commands')).length, 1)
  console.log('Concurrent exact replay, conflicting command, and stale revision passed')
} finally {
  if (created) {
    const deleted = await db.auth.admin.deleteUser(userId)
    if (deleted.error) throw deleted.error
    for (const table of ['accelerated_member_enrollments', 'accelerated_member_worksheets', 'accelerated_completion_commands']) {
      assert.equal((await rows(table)).length, 0, `${table} retained synthetic data`)
    }
    console.log('Synthetic staging user and all dependent rows removed')
  }
}
