import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { DECISION_FILE_VERSION, validateDecisionFile } from '@/lib/accelerated-decision-file'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers })
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request)
  if (isAuthError(auth)) return fail('Sign in to save your Decision File.', 401)
  if (Number(request.headers.get('content-length') || 0) > 38000) return fail('Decision File is too large.', 413)
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return fail('Invalid Decision File command.', 400) }
  if (JSON.stringify(body).length > 38000) return fail('Decision File is too large.', 413)
  const checked = validateDecisionFile(body.draft)
  if (!checked.ok) return fail(checked.error, 400)
  const { draft } = checked
  const action = body.action
  if (action !== 'save' && action !== 'delete' && action !== 'submit') return fail('Invalid action.', 400)
  if (typeof body.commandId !== 'string' || !uuid.test(body.commandId)) return fail('Command identity is required.', 400)
  if (!Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 0) return fail('Reload to get the latest saved revision.', 400)
  if (action === 'delete' && Object.keys(draft.answers).length) return fail('Delete requires an empty Decision File.', 400)
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = auth.user.email?.trim().toLowerCase() ?? ''
  if (action === 'submit') {
    if (body.consent !== true) return fail('Review and consent are required before sending.', 400)
    if (!name || name.length > 120 || !email || !Object.values(draft.answers).some((answer) => answer.trim())) return fail('Name, account email, and an answer are required.', 400)
    if (body.email !== email) return fail('Submission email must match your signed-in account.', 409)
  }
  const answers = Object.fromEntries(Object.entries(draft.answers).sort(([a], [b]) => a.localeCompare(b)))
  const commandHash = createHash('sha256').update(JSON.stringify({ action, version: DECISION_FILE_VERSION, worksheetId: draft.worksheetId, answers, name: action === 'submit' ? name : '', email: action === 'submit' ? email : '', consent: action === 'submit' })).digest('hex')
  const intakeHash = action === 'submit' ? createHash('sha256').update(JSON.stringify({ worksheet_id: draft.worksheetId, content_version: DECISION_FILE_VERSION, learner_name: name, learner_email: email, answers })).digest('hex') : null
  const { data, error } = await supabaseAdmin.rpc('accelerated_commit_completion_workspace', {
    p_user_id: auth.user.id, p_version: DECISION_FILE_VERSION, p_worksheet_id: draft.worksheetId,
    p_answers: answers, p_expected_revision: body.expectedRevision, p_command_id: body.commandId,
    p_action: action, p_payload_sha256: commandHash, p_intake_sha256: intakeHash,
    p_learner_name: name || null, p_learner_email: email || null, p_consent: body.consent === true,
  })
  if (error) return error.code === 'P0001' || error.code === '23505' ? fail(error.message, 409) : fail('Decision File could not be saved.', 503)
  const receipt = data?.[0]
  if (!receipt || !Number.isSafeInteger(receipt.revision)) return fail('Decision File receipt is unavailable.', 503)
  return NextResponse.json({ revision: receipt.revision, replay: receipt.replay, submitted: Boolean(receipt.intake_id) }, { status: receipt.replay ? 200 : 201, headers })
}
