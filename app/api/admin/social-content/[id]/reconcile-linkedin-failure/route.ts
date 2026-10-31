import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseSocialScheduleRecoveryRepository } from '@/lib/social-schedule-recovery'
import { historicalLinkedInFailureCandidate } from '@/lib/social-linkedin-failure-recovery'
import { socialReleaseGate, nextSocialReleaseVersion } from '@/lib/social-release-safety'

export const dynamic = 'force-dynamic'

/** Records a proven pre-post failure. It never calls LinkedIn or dispatches a retry. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const admin = supabaseAdmin
  if (!admin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  if (typeof body.expected_updated_at !== 'string' || typeof body.work_item_id !== 'string') {
    return NextResponse.json({ error: 'Current content version and recovery receipt are required.' }, { status: 400 })
  }
  const { data: item, error: itemError } = await admin.from('social_content_queue').select('*').eq('id', params.id).maybeSingle()
  if (itemError || !item || item.updated_at !== body.expected_updated_at) {
    return NextResponse.json({ error: 'Content changed. Refresh recovery evidence.' }, { status: 409 })
  }
  const { data: rows, error: rowsError } = await admin.from('social_content_publishes').select('*').eq('content_id', params.id)
  if (rowsError) return NextResponse.json({ error: 'Publish evidence unavailable.' }, { status: 409 })
  const workItems = await createSupabaseSocialScheduleRecoveryRepository(admin).readRecoveryItems(params.id)
  const candidate = historicalLinkedInFailureCandidate(item, rows ?? [], workItems as unknown as Record<string, unknown>[])
  if (!candidate || candidate.work_item_id !== body.work_item_id) {
    return NextResponse.json({ error: 'Deterministic failure evidence is incomplete or ambiguous.' }, { status: 409 })
  }
  const row = rows![0]
  if (row.status === 'pending') {
    const { data: marked, error } = await admin.from('social_content_publishes')
      .update({ status: 'failed', error_message: candidate.error })
      .eq('id', candidate.publish_row_id).eq('content_id', params.id)
      .eq('status', 'pending').eq('updated_at', row.updated_at)
      .is('platform_post_id', null).is('platform_post_url', null).is('published_at', null)
      .select('id').maybeSingle()
    if (error || !marked) return NextResponse.json({ error: 'Publish row changed. Refresh before reconciling.' }, { status: 409 })
  }
  const gate = socialReleaseGate(item.rag_context)
  const context = item.rag_context && typeof item.rag_context === 'object' ? item.rag_context as Record<string, unknown> : {}
  const nextContext = { ...context, platform_submission_gate: { ...gate, status: 'approved',
    reconciliation_required: false, deterministic_failure: {
      release_id: candidate.release_id, platform: 'linkedin', publish_row_id: candidate.publish_row_id,
      approved_fingerprint: candidate.approved_fingerprint, error: candidate.error,
      recovery_work_item_id: candidate.work_item_id,
    } } }
  const { data: saved, error: saveError } = await admin.from('social_content_queue')
    .update({ rag_context: nextContext, updated_at: nextSocialReleaseVersion(item.updated_at) })
    .eq('id', params.id).eq('updated_at', item.updated_at)
    .eq('rag_context->platform_submission_gate->>release_id', candidate.release_id)
    .eq('rag_context->platform_submission_gate->>status', 'uncertain')
    .select('id').maybeSingle()
  if (saveError || !saved) return NextResponse.json({ error: 'Recovery write unconfirmed. Refresh evidence; no retry was dispatched.' }, { status: 409 })
  return NextResponse.json({ reconciled: true, provider_error: candidate.error,
    publish_row_id: candidate.publish_row_id, release_id: candidate.release_id,
    side_effects: { provider_call: false, upload: false, draft: false, schedule: false, publish: false } })
}
