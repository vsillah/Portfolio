import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { socialContentDecisionHref } from '@/lib/social-content-decision-routing'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data: item, error } = await supabaseAdmin
    .from('social_content_queue')
    .select('id, updated_at')
    .eq('id', params.id)
    .single()
  if (error || !item) return NextResponse.json({ error: 'Social Content item not found.' }, { status: 404 })

  const { data: packet, error: prepareError } = await supabaseAdmin.rpc(
    'prepare_social_content_copy_review',
    {
      p_social_content_id: item.id,
      p_expected_content_updated_at: item.updated_at,
      p_triggered_by_user_id: auth.user.id,
    },
  )
  if (prepareError || !packet) {
    const message = prepareError?.message || 'Failed to prepare the copy-review packet.'
    const conflict = /required|missing|stale|ambiguous|mismatch|not approved|already|current gate|calendar/i.test(message)
    return NextResponse.json({ error: message }, { status: conflict ? 409 : 500 })
  }

  const workItemId = typeof packet.work_item_id === 'string' ? packet.work_item_id : ''
  if (!workItemId || packet.current_gate !== 'copy_review' || packet.external_execution !== false) {
    return NextResponse.json({ error: 'Copy-review preparation returned an incomplete packet binding.' }, { status: 500 })
  }
  return NextResponse.json({
    ok: true,
    packet,
    canonical_href: socialContentDecisionHref({ contentId: item.id, workItemId, gate: 'copy_review' }),
    external_execution: false,
  })
}
