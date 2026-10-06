import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

function hasValidSourceUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function hasPatternPacket(value: unknown) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await context.params
  const body = await request.json().catch(() => null)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    || !body || !['approved', 'rejected'].includes(body.decision)
    || typeof body.note !== 'string' || !body.note.trim() || body.note.trim().length > 2000
    || typeof body.updated_at !== 'string' || !Number.isFinite(Date.parse(body.updated_at))) {
    return NextResponse.json({ error: 'Provide a valid packet, decision, review note (1–2000 characters), and packet version.' }, { status: 400 })
  }
  const { data: packet, error } = await supabaseAdmin.from('social_content_research_packets')
    .select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: 'Unable to load research packet.' }, { status: 500 })
  if (!packet) return NextResponse.json({ error: 'Research packet not found.' }, { status: 404 })
  if (packet.status !== 'review_ready' || packet.updated_at !== body.updated_at) {
    return NextResponse.json({ error: 'Packet changed or was already reviewed. Refresh before reviewing.' }, { status: 409 })
  }
  if (body.decision === 'approved' && (
    packet.pattern_status !== 'usable_framework'
    || !hasValidSourceUrl(packet.source_url)
    || !hasPatternPacket(packet.pattern_packet)
  )) {
    return NextResponse.json({ error: 'Approval requires a usable framework, a valid public source URL, and a nonempty pattern packet.' }, { status: 422 })
  }
  const metadata = packet.actor_metadata && typeof packet.actor_metadata === 'object' && !Array.isArray(packet.actor_metadata)
    ? packet.actor_metadata : {}
  const reviewedAt = new Date().toISOString()
  const { data: updated, error: updateError } = await supabaseAdmin.from('social_content_research_packets')
    .update({ status: body.decision, actor_metadata: { ...metadata, operator_review: {
      decision: body.decision, note: body.note.trim(), reviewed_by: auth.user.id,
      reviewed_at: reviewedAt, previous_status: packet.status, packet_version: packet.updated_at,
      pattern_status: packet.pattern_status, source_url: packet.source_url,
      surface: 'content_intelligence_research',
    } } })
    .eq('id', id).eq('status', 'review_ready').eq('updated_at', packet.updated_at)
    .eq('pattern_status', packet.pattern_status).select('*').maybeSingle()
  if (updateError) return NextResponse.json({ error: 'Unable to save review. Refresh and try again.' }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'Packet changed. Refresh before reviewing.' }, { status: 409 })
  return NextResponse.json({ packet: updated })
}
