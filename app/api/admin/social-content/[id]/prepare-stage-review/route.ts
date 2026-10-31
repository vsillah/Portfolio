import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { socialContentDecisionHref } from '@/lib/social-content-decision-routing'

export const dynamic = 'force-dynamic'

const PREPARABLE_GATES = new Set(['visual_review', 'asset_packet', 'privacy'])

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data: item, error } = await supabaseAdmin
    .from('social_content_queue')
    .select('id, updated_at, rag_context')
    .eq('id', params.id)
    .single()
  if (error || !item) {
    return NextResponse.json({ error: 'Content not found' }, { status: 404 })
  }

  const ragContext = item.rag_context && typeof item.rag_context === 'object'
    ? item.rag_context as Record<string, unknown>
    : {}
  const currentGate = asString(ragContext.current_gate)
  if (!PREPARABLE_GATES.has(currentGate)) {
    return NextResponse.json({
      error: 'The current internal gate does not support packet preparation.',
      current_gate: currentGate || null,
    }, { status: 409 })
  }

  const idempotencyKey = `social-stage-review:${item.id}:${currentGate}:${item.updated_at}`
  const { data: packet, error: prepareError } = await supabaseAdmin.rpc(
    'prepare_social_content_stage_review',
    {
      p_social_content_id: item.id,
      p_expected_content_updated_at: item.updated_at,
      p_current_gate: currentGate,
      p_triggered_by_user_id: auth.user.id,
      p_idempotency_key: idempotencyKey,
    },
  )
  if (prepareError || !packet) {
    const message = prepareError?.message || 'Failed to prepare the internal review packet'
    const conflict = /stale|required|current gate|unsupported|mismatch|missing|pending|malformed|duplicate|ambiguous|not approved|not bound/i.test(message)
    return NextResponse.json({ error: message }, { status: conflict ? 409 : 500 })
  }

  const workItemId = asString((packet as Record<string, unknown>).work_item_id)
  return NextResponse.json({
    ok: true,
    packet,
    canonical_href: socialContentDecisionHref({
      contentId: item.id,
      workItemId,
      gate: currentGate,
    }),
    external_execution: false,
  })
}
