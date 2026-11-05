import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { verifyAuth, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { DECISION_FILE_VERSION } from '@/lib/accelerated-decision-file'
import { validateLearningState } from '@/lib/accelerated-member-progress'
import { getDashboardByToken } from '@/lib/client-dashboard'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers })

async function identity(request: NextRequest) {
  const result = await verifyAuth(request)
  return isAuthError(result) ? null : result.user.id
}

export async function GET(request: NextRequest) {
  const userId = await identity(request)
  if (!userId) return fail('Sign in to view member progress.', 401)
  const [enrollment, lessonRows, worksheet, audits, memberships, recommendations, ownedFiles] = await Promise.all([
    supabaseAdmin.from('accelerated_member_enrollments').select('current_lesson_id,updated_at').eq('user_id', userId).eq('content_version', DECISION_FILE_VERSION).maybeSingle(),
    supabaseAdmin.from('accelerated_member_lessons').select('lesson_id,completed_at,video_seconds').eq('user_id', userId).eq('content_version', DECISION_FILE_VERSION),
    supabaseAdmin.from('accelerated_member_worksheets').select('worksheet_id,answers,updated_at').eq('user_id', userId).eq('content_version', DECISION_FILE_VERSION).maybeSingle(),
    supabaseAdmin.from('diagnostic_audits').select('id,status,diagnostic_summary').eq('user_id', userId).eq('status', 'completed').order('id', { ascending: false }).limit(1),
    supabaseAdmin.from('verified_client_project_memberships').select('client_project_id').eq('user_id', userId),
    supabaseAdmin.from('accelerated_member_recommendations').select('id,offer_kind,offer_id,title,rationale').eq('user_id', userId).eq('review_status', 'approved'),
    supabaseAdmin.from('accelerated_decision_file_owners').select('intake_id').eq('user_id', userId),
  ])
  if ([enrollment, lessonRows, worksheet, audits, memberships, recommendations, ownedFiles].some((item) => item.error)) return fail('Member data is temporarily unavailable.', 503)
  // Existing token projection is reused server-side. The token is never sent to the member.
  let assessment = null
  const audit = audits.data?.[0]
  if (audit) {
    const access = await supabaseAdmin.from('client_dashboard_access').select('access_token').eq('diagnostic_audit_id', audit.id).eq('is_active', true).limit(1).maybeSingle()
    if (!access.error && access.data?.access_token) {
      const projected = await getDashboardByToken(access.data.access_token)
      if (!projected.error && projected.stage === 'lead') assessment = projected.data
    }
  }
  const projects = []
  for (const member of memberships.data ?? []) {
    const access = await supabaseAdmin.from('client_dashboard_access').select('access_token').eq('client_project_id', member.client_project_id).eq('is_active', true).limit(1).maybeSingle()
    if (access.error || !access.data?.access_token) continue
    const projected = await getDashboardByToken(access.data.access_token)
    if (!projected.error && projected.stage === 'client' && projected.data) projects.push(projected.data)
  }
  return NextResponse.json({
    version: DECISION_FILE_VERSION,
    enrollment: enrollment.data,
    lessons: lessonRows.data ?? [],
    worksheet: worksheet.data,
    decisionFileCount: ownedFiles.data?.length ?? 0,
    assessmentStatus: audit ? { status: audit.status, summary: audit.diagnostic_summary } : null,
    assessment,
    recommendations: recommendations.data ?? [],
    projects,
  }, { headers })
}

export async function POST(request: NextRequest) {
  const userId = await identity(request)
  if (!userId) return fail('Sign in before saving member progress.', 401)
  if (Number(request.headers.get('content-length') || 0) > 45000) return fail('Progress is too large.', 413)
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return fail('Invalid progress data.', 400) }
  if (JSON.stringify(body).length > 45000) return fail('Progress is too large.', 413)
  const checked = validateLearningState(body.state)
  if (!checked.ok) return fail(checked.error, 400)
  if (body.action !== 'claim' && body.action !== 'save') return fail('Invalid progress action.', 400)
  if (body.action === 'claim' && body.consent !== true) return fail('Explicit consent is required to claim guest progress.', 400)
  const { state } = checked
  const digest = createHash('sha256').update(JSON.stringify(state)).digest('hex')
  const priorEnrollment = await supabaseAdmin.from('accelerated_member_enrollments').select('claim_sha256').eq('user_id', userId).eq('content_version', DECISION_FILE_VERSION).maybeSingle()
  if (priorEnrollment.error) return fail('Could not check enrollment.', 503)
  if (body.action === 'claim' && priorEnrollment.data?.claim_sha256) {
    if (priorEnrollment.data.claim_sha256 !== digest) return fail('Guest progress was already claimed with different evidence.', 409)
    return NextResponse.json({ saved: true, replay: true }, { headers })
  }
  if (body.action === 'save' && !priorEnrollment.data) return fail('Claim guest progress before saving member changes.', 409)
  const existing = await supabaseAdmin.from('accelerated_member_worksheets').select('worksheet_id').eq('user_id', userId).eq('content_version', DECISION_FILE_VERSION).maybeSingle()
  if (existing.error) return fail('Could not check worksheet ownership.', 503)
  if (existing.data && existing.data.worksheet_id !== state.worksheet.worksheetId) return fail('This member already has a different worksheet for this course edition.', 409)
  const foreign = await supabaseAdmin.from('accelerated_member_worksheets').select('user_id').eq('worksheet_id', state.worksheet.worksheetId).maybeSingle()
  if (foreign.error) return fail('Could not check worksheet ownership.', 503)
  if (foreign.data && foreign.data.user_id !== userId) return fail('This worksheet belongs to another member.', 409)
  const enrollment = await supabaseAdmin.from('accelerated_member_enrollments').upsert({ user_id: userId, content_version: DECISION_FILE_VERSION, current_lesson_id: state.currentLessonId, claim_sha256: priorEnrollment.data?.claim_sha256 ?? null, updated_at: new Date().toISOString() }, { onConflict: 'user_id,content_version' })
  if (enrollment.error) return fail('Could not save enrollment.', 503)
  const worksheet = existing.data
    ? await supabaseAdmin.from('accelerated_member_worksheets').update({ answers: state.worksheet.answers, updated_at: new Date().toISOString() }).eq('worksheet_id', state.worksheet.worksheetId).eq('user_id', userId).eq('content_version', DECISION_FILE_VERSION)
    : await supabaseAdmin.from('accelerated_member_worksheets').insert({ worksheet_id: state.worksheet.worksheetId, user_id: userId, content_version: DECISION_FILE_VERSION, answers: state.worksheet.answers, updated_at: new Date().toISOString() })
  if (worksheet.error) return fail(worksheet.error.code === '23505' ? 'A different worksheet is already linked to this member.' : 'Could not save worksheet.', worksheet.error.code === '23505' ? 409 : 503)
  const priorLessons = await supabaseAdmin.from('accelerated_member_lessons').select('lesson_id').eq('user_id', userId).eq('content_version', DECISION_FILE_VERSION)
  if (priorLessons.error) return fail('Could not check prior lesson progress.', 503)
  const rows = new Set([...state.completed, ...Object.keys(state.videoSeconds), ...(priorLessons.data ?? []).map((item) => item.lesson_id)])
  if (rows.size) {
    const result = await supabaseAdmin.from('accelerated_member_lessons').upsert([...rows].map((id) => ({ user_id: userId, content_version: DECISION_FILE_VERSION, lesson_id: id, completed_at: state.completed.includes(id) ? new Date().toISOString() : null, video_seconds: state.videoSeconds[id] ?? 0, updated_at: new Date().toISOString() })), { onConflict: 'user_id,content_version,lesson_id' })
    if (result.error) return fail('Could not save lesson progress.', 503)
  }
  if (body.action === 'claim') {
    const receipt = await supabaseAdmin.from('accelerated_member_enrollments').update({ claim_sha256: digest }).eq('user_id', userId).eq('content_version', DECISION_FILE_VERSION).is('claim_sha256', null)
    if (receipt.error) return fail('Could not record the claim receipt.', 503)
  }
  return NextResponse.json({ saved: true }, { headers })
}
