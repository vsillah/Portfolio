import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  normalizePractitionerEvidence,
  practitionerEvidenceValidation,
} from '@/lib/research-practitioner-evidence'

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

function validPacketRequest(id: string, updatedAt: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    && typeof updatedAt === 'string'
    && Number.isFinite(Date.parse(updatedAt))
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await context.params
  const body = await request.json().catch(() => null)
  if (!body || !validPacketRequest(id, body.updated_at) || typeof body.evidence !== 'object') {
    return NextResponse.json({ error: 'Provide a valid packet, evidence record, and packet version.' }, { status: 400 })
  }
  const evidence = normalizePractitionerEvidence(body.evidence)
  const authoringValidation = practitionerEvidenceValidation(evidence, {})
  if (!evidence.revision_note || evidence.revision_note.length > 500) {
    return NextResponse.json({ error: 'Add a revision note (1–500 characters) before saving.' }, { status: 400 })
  }
  const oversizedIssue = authoringValidation.issues.find(issue => issue.includes('within'))
  if (oversizedIssue) return NextResponse.json({ error: oversizedIssue }, { status: 400 })
  const { data: packet, error } = await supabaseAdmin.from('social_content_research_packets')
    .select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: 'Unable to load research packet.' }, { status: 500 })
  if (!packet) return NextResponse.json({ error: 'Research packet not found.' }, { status: 404 })
  if (!['review_ready', 'rejected'].includes(packet.status) || packet.updated_at !== body.updated_at) {
    return NextResponse.json({ error: 'Packet changed or cannot be revised. Refresh before saving.' }, { status: 409 })
  }
  const metadata = packet.actor_metadata && typeof packet.actor_metadata === 'object' && !Array.isArray(packet.actor_metadata)
    ? packet.actor_metadata : {}
  const recordedAt = new Date().toISOString()
  const selectedKey = evidence.framework_receipt.selected_framework_key
  const patterns = packet.pattern_packet && typeof packet.pattern_packet === 'object' && !Array.isArray(packet.pattern_packet)
    ? packet.pattern_packet as Record<string, unknown> : {}
  const storedEvidence = {
    ...evidence,
    redaction_receipt: {
      ...evidence.redaction_receipt,
      reviewed_at: recordedAt,
      reviewed_by: auth.user.id,
    },
    framework_receipt: {
      ...evidence.framework_receipt,
      selected_framework_value: Object.prototype.hasOwnProperty.call(patterns, selectedKey) ? patterns[selectedKey] : undefined,
      recorded_at: recordedAt,
      recorded_by: auth.user.id,
    },
    saved_at: recordedAt,
    saved_by: auth.user.id,
  }
  const nextMetadata = {
    ...metadata,
    practitioner_evidence: storedEvidence,
    practitioner_evidence_history: [
      ...(Array.isArray((metadata as Record<string, unknown>).practitioner_evidence_history)
        ? (metadata as Record<string, unknown>).practitioner_evidence_history as unknown[] : []),
      {
        saved_at: recordedAt,
        saved_by: auth.user.id,
        previous_packet_version: packet.updated_at,
        revision_note: evidence.revision_note,
        public_use_boundary: evidence.public_use_boundary,
        framework_key: selectedKey || null,
      },
    ].slice(-20),
  }
  const { data: updated, error: updateError } = await supabaseAdmin.from('social_content_research_packets')
    .update({ status: 'review_ready', actor_metadata: nextMetadata })
    .eq('id', id).eq('updated_at', packet.updated_at).eq('status', packet.status)
    .select('*').maybeSingle()
  if (updateError) return NextResponse.json({ error: 'Unable to save practitioner evidence. Refresh and try again.' }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'Packet changed. Refresh before saving.' }, { status: 409 })
  const validation = practitionerEvidenceValidation(storedEvidence, packet.pattern_packet)
  return NextResponse.json({ packet: updated, validation })
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await context.params
  const body = await request.json().catch(() => null)
  if (!validPacketRequest(id, body?.updated_at)
    || !body || !['approved', 'rejected'].includes(body.decision)
    || typeof body.note !== 'string' || !body.note.trim() || body.note.trim().length > 2000
  ) {
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
  if (body.decision === 'approved') {
    const validation = practitionerEvidenceValidation((metadata as Record<string, unknown>).practitioner_evidence, packet.pattern_packet)
    if (!validation.valid) {
      return NextResponse.json({
        error: 'Complete practitioner evidence and privacy review before approval.',
        issues: validation.issues,
      }, { status: 422 })
    }
  }
  const reviewedAt = new Date().toISOString()
  const { data: updated, error: updateError } = await supabaseAdmin.from('social_content_research_packets')
    .update({ status: body.decision, actor_metadata: { ...metadata, operator_review: {
      decision: body.decision, note: body.note.trim(), reviewed_by: auth.user.id,
      reviewed_at: reviewedAt, previous_status: packet.status, packet_version: packet.updated_at,
      pattern_status: packet.pattern_status, source_url: packet.source_url,
      surface: 'content_intelligence_research',
      practitioner_evidence_version: ((metadata as Record<string, unknown>).practitioner_evidence as { saved_at?: unknown } | undefined)?.saved_at ?? null,
    } } })
    .eq('id', id).eq('status', 'review_ready').eq('updated_at', packet.updated_at)
    .eq('pattern_status', packet.pattern_status).select('*').maybeSingle()
  if (updateError) return NextResponse.json({ error: 'Unable to save review. Refresh and try again.' }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'Packet changed. Refresh before reviewing.' }, { status: 409 })
  return NextResponse.json({ packet: updated })
}
