import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { socialContentDecisionHref } from '@/lib/social-content-decision-routing'
import { DARK_CASTLE_COPY_CONTENT_ID, inspectDarkCastleCopyReviewBinding } from '@/lib/dark-castle-copy-review-binding'

export const dynamic = 'force-dynamic'

async function inspect(request: NextRequest, id: string) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return { response: NextResponse.json({ error: auth.error }, { status: auth.status }) }
  if (id !== DARK_CASTLE_COPY_CONTENT_ID) return { response: NextResponse.json({ error: 'This operator workflow is bound to the Dark Castle YouTube record.' }, { status: 404 }) }
  const [{ data: item, error: itemError }, { data: calendars, error: calendarError }] = await Promise.all([
    supabaseAdmin.from('social_content_queue').select('id, updated_at, rag_context').eq('id', id).single(),
    supabaseAdmin.from('social_content_calendar_items').select('id, social_content_id, due_status').eq('social_content_id', id),
  ])
  if (itemError || calendarError) return { response: NextResponse.json({ error: 'Unable to inspect persisted content and calendar bindings.' }, { status: 500 }) }
  return { auth, report: inspectDarkCastleCopyReviewBinding(item, calendars ?? []) }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const result = await inspect(request, params.id)
  return result.response ?? NextResponse.json(result.report)
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const result = await inspect(request, params.id)
  if (result.response) return result.response
  if (!result.report?.ready) return NextResponse.json(result.report, { status: 409 })
  const { data: packet, error } = await supabaseAdmin.rpc('prepare_social_content_copy_review', {
    p_social_content_id: DARK_CASTLE_COPY_CONTENT_ID,
    p_expected_content_updated_at: result.report.content_updated_at,
    p_triggered_by_user_id: result.auth!.user.id,
  })
  if (error || !packet) return NextResponse.json({ error: error?.message || 'Copy-review preparation failed; no packet was returned.' }, { status: 409 })
  if (typeof packet.work_item_id !== 'string' || !packet.work_item_id
    || packet.current_gate !== 'copy_review' || packet.external_execution !== false) {
    return NextResponse.json({ error: 'The preparation result has no valid Decision Queue binding.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, packet,
    canonical_href: socialContentDecisionHref({ contentId: DARK_CASTLE_COPY_CONTENT_ID, workItemId: packet.work_item_id, gate: 'copy_review' }),
    external_execution: false })
}
