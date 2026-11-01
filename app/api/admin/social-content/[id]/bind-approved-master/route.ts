import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { socialContentDecisionHref } from '@/lib/social-content-decision-routing'
import { DARK_CASTLE_COPY_CONTENT_ID } from '@/lib/dark-castle-copy-review-binding'
import { inspectDarkCastleApprovedBinding } from '@/lib/dark-castle-approved-binding'
import { verifiedDarkCastleApprovedArtifacts } from '@/lib/dark-castle-approved-artifacts'

export const dynamic = 'force-dynamic'
const fixture = 'dark_castle_binding_readiness_v1'

async function inspect(request: NextRequest, id: string) {
  if (id !== DARK_CASTLE_COPY_CONTENT_ID) return { response: NextResponse.json({ error: 'Unrelated Social Content record.' }, { status: 404 }) }
  if (request.method === 'GET' && process.env.NODE_ENV !== 'production' && request.nextUrl.searchParams.get('qa_fixture') === fixture) {
    try { await verifiedDarkCastleApprovedArtifacts() }
    catch { return { response: NextResponse.json({ error: 'Approved local artifact validation failed.' }, { status: 409 }) } }
    return { response: NextResponse.json({ ready: false, packetPrepared: false,
      blockers: ['Six persisted copy-review evidence receipts are missing.'], externalExecution: false,
      fixture: true, assetStatus: 'Approved master and Direction C verified in the repository; canonical binding pending.' }) }
  }
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return { response: NextResponse.json({ error: auth.error }, { status: auth.status }) }
  let approved
  try { approved = await verifiedDarkCastleApprovedArtifacts() }
  catch { return { response: NextResponse.json({ error: 'Approved local artifact validation failed.' }, { status: 409 }) } }
  const [{ data: item, error: itemError }, { data: calendars, error: calendarError }] = await Promise.all([
    supabaseAdmin.from('social_content_queue').select('id, updated_at, platform, status, youtube_title, youtube_description, video_url, image_url, rag_context').eq('id', id).single(),
    supabaseAdmin.from('social_content_calendar_items').select('id, social_content_id, due_status').eq('social_content_id', id),
  ])
  if (itemError || calendarError || !item) return { response: NextResponse.json({ error: 'Unable to inspect canonical content and calendar.' }, { status: 500 }) }
  const descriptionSha = typeof item.youtube_description === 'string'
    ? createHash('sha256').update(item.youtube_description).digest('hex') : ''
  const report = inspectDarkCastleApprovedBinding({ ...item, description_sha256: descriptionSha }, calendars ?? [], approved)
  return { auth, report, approved }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const result = await inspect(request, params.id)
  return result.response ?? NextResponse.json({ ...result.report, assetStatus: 'Approved artifact files verified by SHA-256.',
    canonical_href: result.report?.ready && result.report.workItemId
      ? socialContentDecisionHref({ contentId: DARK_CASTLE_COPY_CONTENT_ID, workItemId: result.report.workItemId, gate: 'copy_review' }) : null })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const result = await inspect(request, params.id)
  if (result.response) return result.response
  if (!result.report?.ready || !result.approved) return NextResponse.json(result.report, { status: 409 })
  const { data: packet, error } = await supabaseAdmin.rpc('bind_dark_castle_youtube_copy_review', {
    p_social_content_id: DARK_CASTLE_COPY_CONTENT_ID,
    p_expected_content_updated_at: result.report.contentUpdatedAt,
    p_triggered_by_user_id: result.auth!.user.id,
    p_master_sha256: result.approved.masterSha256,
    p_thumbnail_sha256: result.approved.thumbnailSha256,
    p_thumbnail_direction: result.approved.thumbnailDirection,
    p_thumbnail_selection_receipt_id: result.approved.selectionReceiptId,
    p_description_receipt_id: result.approved.descriptionReceiptId,
    p_evidence_receipt_id: result.approved.evidenceReceiptId,
  })
  if (error || !packet) return NextResponse.json({ error: error?.message || 'Atomic binding failed; no packet was returned.' }, { status: 409 })
  if (typeof packet.work_item_id !== 'string' || !packet.work_item_id
    || packet.current_gate !== 'copy_review' || packet.external_execution !== false) {
    return NextResponse.json({ error: 'Binding result lacks a valid Decision Queue packet.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, packet,
    canonical_href: socialContentDecisionHref({ contentId: DARK_CASTLE_COPY_CONTENT_ID, workItemId: packet.work_item_id, gate: 'copy_review' }),
    external_execution: false })
}
