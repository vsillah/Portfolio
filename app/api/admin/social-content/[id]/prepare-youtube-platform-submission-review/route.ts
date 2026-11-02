import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { socialContentDecisionHref } from '@/lib/social-content-decision-routing'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SHA = /^[0-9a-f]{64}$/

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const version = body.expected_content_updated_at
  const privacy = body.privacy_decision_receipt_id
  const contentVersion = body.content_version
  const master = body.master_sha256
  const thumbnail = body.thumbnail_sha256
  const direction = body.thumbnail_direction
  if (!UUID.test(params.id) || typeof privacy !== 'string' || !UUID.test(privacy)
    || typeof version !== 'string' || !Number.isFinite(Date.parse(version))
    || typeof contentVersion !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(contentVersion)
    || typeof master !== 'string' || !SHA.test(master)
    || typeof thumbnail !== 'string' || !SHA.test(thumbnail)
    || typeof direction !== 'string' || !/^[A-Z]$/.test(direction)) {
    return NextResponse.json({ error: 'Exact YouTube version, privacy receipt, master, and thumbnail identities are required.' }, { status: 400 })
  }

  const key = `youtube-platform-submission-review:${params.id}:${privacy}:${contentVersion}:${version}`
  const { data, error } = await supabaseAdmin.rpc('prepare_youtube_platform_submission_review', {
    p_social_content_id: params.id,
    p_expected_content_updated_at: version,
    p_privacy_decision_receipt_id: privacy,
    p_content_version: contentVersion,
    p_master_sha256: master,
    p_thumbnail_sha256: thumbnail,
    p_thumbnail_direction: direction,
    p_triggered_by_user_id: auth.user.id,
    p_idempotency_key: key,
  })
  if (error || !data) {
    const message = error?.message || 'Failed to prepare YouTube internal review packet.'
    return NextResponse.json({ error: message }, { status: /required|missing|mismatch|stale|duplicate|blocks|identity|drift|existing/i.test(message) ? 409 : 500 })
  }
  const packet = data as Record<string, unknown>
  const workItemId = typeof packet.work_item_id === 'string' ? packet.work_item_id : ''
  return NextResponse.json({ ok: true, packet,
    canonical_href: socialContentDecisionHref({ contentId: params.id, workItemId, gate: 'platform_submission' }),
    external_execution: false })
}
