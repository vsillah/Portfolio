import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isAuthError, verifyAuth } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { AGENTIFIED_VERSION, validateAgentifiedState } from '@/lib/agentified-workshop'
import { loadWorkshopMemberAssessment } from '@/lib/workshop-member-assessment'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers })

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request)
  if (isAuthError(auth)) return fail('Sign in to view progress.', 401)
  const userId = auth.user.id
  const [enrollment, lessons, worksheet] = await Promise.all([
    supabaseAdmin.from('accelerated_member_enrollments').select('current_lesson_id,revision,updated_at').eq('user_id', userId).eq('content_version', AGENTIFIED_VERSION).maybeSingle(),
    supabaseAdmin.from('accelerated_member_lessons').select('lesson_id,completed_at,video_seconds').eq('user_id', userId).eq('content_version', AGENTIFIED_VERSION),
    supabaseAdmin.from('accelerated_member_worksheets').select('worksheet_id,answers,updated_at').eq('user_id', userId).eq('content_version', AGENTIFIED_VERSION).maybeSingle(),
  ])
  if (enrollment.error || lessons.error || worksheet.error) return fail('Member progress is unavailable.', 503)
  let workflow
  try { workflow = await loadWorkshopMemberAssessment(userId, AGENTIFIED_VERSION) }
  catch { return fail('Member assessment is temporarily unavailable.', 503) }
  return NextResponse.json({ version: AGENTIFIED_VERSION, enrollment: enrollment.data, lessons: lessons.data ?? [], worksheet: worksheet.data,
    operatingFileCount: workflow.intakeCount, assessmentStatus: workflow.assessmentStatus,
    assessment: workflow.assessment, recommendations: workflow.recommendations }, { headers })
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request)
  if (isAuthError(auth)) return fail('Sign in to save progress.', 401)
  if (Number(request.headers.get('content-length') || 0) > 45000) return fail('Progress is too large.', 413)
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return fail('Invalid progress.', 400) }
  if (JSON.stringify(body).length > 45000) return fail('Progress is too large.', 413)
  const checked = validateAgentifiedState(body.state)
  if (!checked.ok) return fail(checked.error, 400)
  if (body.action !== 'claim' && body.action !== 'save') return fail('Invalid action.', 400)
  if (body.action === 'claim' && body.consent !== true) return fail('Consent is required to claim guest progress.', 400)
  if (!Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 0) return fail('Reload to get the latest saved revision.', 400)
  const digest = createHash('sha256').update(JSON.stringify(checked.state)).digest('hex')
  const { data, error } = await supabaseAdmin.rpc('accelerated_write_member_progress', {
    p_user_id: auth.user.id, p_version: AGENTIFIED_VERSION, p_state: checked.state,
    p_action: body.action, p_expected_revision: body.expectedRevision, p_claim_sha256: digest,
  })
  if (error) return error.code === 'P0001' || error.code === '23505' ? fail(error.message, 409) : fail('Progress could not be saved.', 503)
  const receipt = data?.[0]
  if (!receipt || !Number.isSafeInteger(receipt.revision)) return fail('Save receipt is unavailable.', 503)
  return NextResponse.json({ saved: true, revision: receipt.revision, replay: receipt.replay }, { headers })
}
