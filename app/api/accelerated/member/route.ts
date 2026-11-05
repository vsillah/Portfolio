import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { verifyAuth, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { DECISION_FILE_VERSION } from '@/lib/accelerated-decision-file'
import { validateLearningState } from '@/lib/accelerated-member-progress'
import { getDashboardByProjectId, getDashboardByToken } from '@/lib/client-dashboard'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers })

async function identity(request: NextRequest) {
  const result = await verifyAuth(request)
  return isAuthError(result) ? null : result.user.id
}

async function loadRecommendations(userId: string) {
  const current = await supabaseAdmin.from('accelerated_member_recommendations')
    .select('id,offer_kind,offer_id,title,rationale,reviewed_at,approved_price,approved_is_quote_based,approved_is_print_on_demand,approved_variant_prices')
    .eq('user_id', userId).eq('review_status', 'approved')
  // Production may not yet have the staging-only commerce migration. Keep the
  // read-only dashboard available and withhold purchase actions until rollout.
  if (current.error?.code === '42703') {
    return supabaseAdmin.from('accelerated_member_recommendations')
      .select('id,offer_kind,offer_id,title,rationale,reviewed_at')
      .eq('user_id', userId).eq('review_status', 'approved')
  }
  return current
}

export async function GET(request: NextRequest) {
  const userId = await identity(request)
  if (!userId) return fail('Sign in to view member progress.', 401)
  const [enrollment, lessonRows, worksheet, audits, memberships, recommendations, ownedFiles, orders] = await Promise.all([
    supabaseAdmin.from('accelerated_member_enrollments').select('current_lesson_id,revision,updated_at').eq('user_id', userId).eq('content_version', DECISION_FILE_VERSION).maybeSingle(),
    supabaseAdmin.from('accelerated_member_lessons').select('lesson_id,completed_at,video_seconds').eq('user_id', userId).eq('content_version', DECISION_FILE_VERSION),
    supabaseAdmin.from('accelerated_member_worksheets').select('worksheet_id,answers,updated_at').eq('user_id', userId).eq('content_version', DECISION_FILE_VERSION).maybeSingle(),
    supabaseAdmin.from('diagnostic_audits').select('id,status,diagnostic_summary').eq('user_id', userId).eq('status', 'completed').order('id', { ascending: false }).limit(1),
    supabaseAdmin.from('verified_client_project_memberships').select('client_project_id').eq('user_id', userId),
    loadRecommendations(userId),
    supabaseAdmin.from('accelerated_decision_file_owners').select('intake_id').eq('user_id', userId),
    supabaseAdmin.from('orders').select('id,status,final_amount,created_at,order_items(id,quantity,price_at_purchase,products(title),services(title))')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
  ])
  if ([enrollment, lessonRows, worksheet, audits, memberships, recommendations, ownedFiles, orders].some((item) => item.error)) return fail('Member data is temporarily unavailable.', 503)
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
  const projectMeetings: Record<string, unknown[]> = {}
  for (const member of memberships.data ?? []) {
    const projected = await getDashboardByProjectId(member.client_project_id)
    if (!projected.error && projected.stage === 'client' && projected.data) {
      projects.push(projected.data)
      const meetings = await supabaseAdmin.from('meeting_records')
        .select('id,meeting_type,meeting_date,duration_minutes,structured_notes,key_decisions,action_items,open_questions,recording_url')
        .eq('client_project_id', member.client_project_id).order('meeting_date', { ascending: false }).limit(50)
      if (meetings.error) return fail('Member meetings are temporarily unavailable.', 503)
      projectMeetings[member.client_project_id] = meetings.data ?? []
    }
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
    orders: orders.data ?? [],
    projects,
    projectMeetings,
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
  if (!Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 0) return fail('A persisted progress revision is required. Reload before saving.', 400)
  const { data, error } = await supabaseAdmin.rpc('accelerated_write_member_progress', {
    p_user_id: userId,
    p_version: DECISION_FILE_VERSION,
    p_state: state,
    p_action: body.action,
    p_expected_revision: body.expectedRevision,
    p_claim_sha256: digest,
  })
  if (error) {
    if (error.code === 'P0001' || error.code === '23505') return fail(error.message, 409)
    return fail('Member progress could not be saved.', 503)
  }
  const result = data?.[0]
  if (!result || !Number.isSafeInteger(result.revision)) return fail('Member progress receipt was not recorded.', 503)
  return NextResponse.json({ saved: true, revision: result.revision, replay: result.replay }, { headers })
}
