import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { verifyAuth, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { DECISION_FILE_VERSION } from '@/lib/accelerated-decision-file'
import { validateLearningState } from '@/lib/accelerated-member-progress'
import { getDashboardByProjectId } from '@/lib/client-dashboard'
import { loadWorkshopMemberAssessment } from '@/lib/workshop-member-assessment'
import { AGENTIFIED_VERSION } from '@/lib/agentified-workshop'
import { attributeWorkshopOrders } from '@/lib/workshop-order-attribution'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers })

async function identity(request: NextRequest) {
  const result = await verifyAuth(request)
  return isAuthError(result) ? null : result.user.id
}

async function loadMemberships(userId: string) {
  const current = await supabaseAdmin.from('verified_client_project_memberships')
    .select('client_project_id,workshop_intake_id').eq('user_id', userId)
  if (current.error?.code === '42703') return supabaseAdmin.from('verified_client_project_memberships')
    .select('client_project_id').eq('user_id', userId)
  return current
}

async function loadOrders(userId: string) {
  const current = await supabaseAdmin.from('orders')
    .select('id,status,final_amount,created_at,workshop_intake_id,order_items(id,quantity,price_at_purchase,products(title),services(title))')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(30)
  if (current.error?.code === '42703') return supabaseAdmin.from('orders')
    .select('id,status,final_amount,created_at,order_items(id,quantity,price_at_purchase,products(title),services(title))')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(30)
  return current
}

export async function GET(request: NextRequest) {
  const userId = await identity(request)
  if (!userId) return fail('Sign in to view member progress.', 401)
  const [profile, enrollment, lessonRows, worksheet, memberships, orders] = await Promise.all([
    supabaseAdmin.from('user_profiles').select('full_name').eq('id', userId).maybeSingle(),
    supabaseAdmin.from('accelerated_member_enrollments').select('current_lesson_id,revision,updated_at').eq('user_id', userId).eq('content_version', DECISION_FILE_VERSION).maybeSingle(),
    supabaseAdmin.from('accelerated_member_lessons').select('lesson_id,completed_at,video_seconds').eq('user_id', userId).eq('content_version', DECISION_FILE_VERSION),
    supabaseAdmin.from('accelerated_member_worksheets').select('worksheet_id,answers,updated_at').eq('user_id', userId).eq('content_version', DECISION_FILE_VERSION).maybeSingle(),
    loadMemberships(userId),
    loadOrders(userId),
  ])
  if ([profile, enrollment, lessonRows, worksheet, memberships, orders].some((item) => item.error)) return fail('Member data is temporarily unavailable.', 503)
  let workflow
  try { workflow = await loadWorkshopMemberAssessment(userId, DECISION_FILE_VERSION) }
  catch { return fail('Member assessment is temporarily unavailable.', 503) }
  const orderRows = (orders.data ?? []) as Array<{ workshop_intake_id?: string | null; [key: string]: unknown }>
  const orderIntakeIds = [...new Set(orderRows.map((order) => order.workshop_intake_id).filter((id): id is string => typeof id === 'string'))]
  const orderIntakes = orderIntakeIds.length ? await supabaseAdmin.from('accelerated_decision_file_intakes')
    .select('id,content_version').in('id', orderIntakeIds) : { data: [], error: null }
  if (orderIntakes.error) return fail('Workshop order identity is temporarily unavailable.', 503)
  let attributedOrders
  try { attributedOrders = attributeWorkshopOrders(orderRows, orderIntakes.data ?? []) }
  catch { return fail('Workshop order identity is unavailable.', 503) }
  const projects = []
  const projectMeetings: Record<string, unknown[]> = {}
  const projectWorkshops: Record<string, 'accelerated' | 'agentified'> = {}
  for (const member of memberships.data ?? []) {
    const projected = await getDashboardByProjectId(member.client_project_id)
    if (!projected.error && projected.stage === 'client' && projected.data) {
      projects.push(projected.data)
      if (member.workshop_intake_id) {
        const source = await supabaseAdmin.from('accelerated_decision_file_intakes')
          .select('content_version').eq('id', member.workshop_intake_id).maybeSingle()
        if (source.error) return fail('Project workshop identity is temporarily unavailable.', 503)
        if (source.data?.content_version === DECISION_FILE_VERSION) projectWorkshops[member.client_project_id] = 'accelerated'
        else if (source.data?.content_version === AGENTIFIED_VERSION) projectWorkshops[member.client_project_id] = 'agentified'
        else return fail('Project workshop identity is unavailable.', 503)
      }
      const meetings = await supabaseAdmin.from('meeting_records')
        .select('id,meeting_type,meeting_date,duration_minutes,structured_notes,key_decisions,action_items,open_questions,recording_url')
        .eq('client_project_id', member.client_project_id).order('meeting_date', { ascending: false }).limit(50)
      if (meetings.error) return fail('Member meetings are temporarily unavailable.', 503)
      projectMeetings[member.client_project_id] = meetings.data ?? []
    }
  }
  return NextResponse.json({
    version: DECISION_FILE_VERSION,
    profileName: profile.data?.full_name?.trim() || null,
    enrollment: enrollment.data,
    lessons: lessonRows.data ?? [],
    worksheet: worksheet.data,
    decisionFileCount: workflow.intakeCount,
    assessmentStatus: workflow.assessmentStatus,
    assessment: workflow.assessment,
    recommendations: workflow.recommendations,
    orders: attributedOrders,
    projects,
    projectWorkshops,
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
