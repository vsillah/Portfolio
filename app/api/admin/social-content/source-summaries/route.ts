import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildApprovedSourceProjection,
  persistApprovedSourceProjections,
  type SocialTopicLifecycleStage,
  type SocialTopicReceiptPrivacy,
} from '@/lib/social-topic-source-receipts'
import { collectLiveSocialTopicCoverage } from '@/lib/social-topic-source-coverage'

const SOURCE_TYPES = new Set([
  'meeting_summary',
  'owned_media_summary',
  'open_brain_approved_projection',
  'convex_approved_product_record',
  'supabase_approved_product_record',
])

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = asRecord(await request.json().catch(() => null))
  const sourceKind = text(body.source_kind)
  const sourceId = text(body.source_id)
  const summary = text(body.approved_summary)
  const title = text(body.title)
  const provenance = text(body.provenance)
  const productIdentity = text(body.product_identity)
  const privacy = text(body.privacy_classification) as SocialTopicReceiptPrivacy
  const lifecycle = text(body.lifecycle_stage) as SocialTopicLifecycleStage

  if (
    !SOURCE_TYPES.has(sourceKind)
    || !sourceId
    || !summary
    || !title
    || !provenance
    || !productIdentity
    || body.approval_status !== 'approved'
    || !['public_safe', 'client_safe_summary'].includes(privacy)
    || !['insight', 'preview_deployed', 'production_deployed'].includes(lifecycle)
  ) {
    return NextResponse.json({
      error: 'An approved privacy-safe summary, provenance, product identity, lifecycle stage, title, and source are required.',
    }, { status: 400 })
  }

  if ((sourceKind === 'meeting_summary' || sourceKind === 'owned_media_summary') && !validUuid(sourceId)) {
    return NextResponse.json({ error: 'Meeting and owned-media source ids must be UUIDs.' }, { status: 400 })
  }

  const approvedAt = new Date().toISOString()
  const sourceGroup = sourceKind === 'meeting_summary'
    ? 'meeting_summaries'
    : sourceKind === 'owned_media_summary'
      ? 'owned_media_summaries'
      : sourceKind === 'open_brain_approved_projection'
        ? 'codex_insights'
        : 'operational_records'

  try {
    if (sourceKind === 'meeting_summary') {
      const { data: meeting, error } = await supabaseAdmin.from('meeting_records')
        .select('id, structured_notes').eq('id', sourceId).maybeSingle()
      if (error) throw new Error('meeting_summary_source_read_failed')
      if (!meeting) return NextResponse.json({ error: 'Meeting source not found.' }, { status: 404 })
      const structuredNotes = asRecord(meeting.structured_notes)
      const { error: updateError } = await supabaseAdmin.from('meeting_records').update({
        structured_notes: {
          ...structuredNotes,
          social_topic_summary: {
            status: 'approved',
            title,
            summary,
            privacy_classification: privacy,
            provenance,
            product_ids: [productIdentity],
            approved_at: approvedAt,
            approved_by: auth.user.id,
            raw_content_included: false,
          },
        },
      }).eq('id', sourceId)
      if (updateError) throw new Error('meeting_summary_projection_failed')
    }

    if (sourceKind === 'owned_media_summary') {
      const { data: packet, error } = await supabaseAdmin.from('social_content_research_packets')
        .select('id, pattern_packet, status').eq('id', sourceId).maybeSingle()
      if (error) throw new Error('owned_media_source_read_failed')
      if (!packet) return NextResponse.json({ error: 'Owned-media source not found.' }, { status: 404 })
      if (packet.status !== 'approved') {
        return NextResponse.json({ error: 'Approve the research packet before its summary can become a source receipt.' }, { status: 409 })
      }
      const patternPacket = asRecord(packet.pattern_packet)
      const { error: updateError } = await supabaseAdmin.from('social_content_research_packets').update({
        pattern_packet: {
          ...patternPacket,
          topic_source_receipt: {
            status: 'approved',
            source_kind: 'owned_media_summary',
            approved_summary: summary,
            privacy_classification: privacy,
            provenance,
            product_ids: [productIdentity],
            approved_at: approvedAt,
            approved_by: auth.user.id,
            raw_content_included: false,
          },
        },
      }).eq('id', sourceId).eq('status', 'approved')
      if (updateError) throw new Error('owned_media_summary_projection_failed')
    }

    const projection = buildApprovedSourceProjection({
      sourceGroup,
      sourceKind,
      sourceId,
      productIdentity,
      lifecycleStage: lifecycle,
      label: title,
      approvedSummary: summary,
      privacyClassification: privacy,
      provenance,
      approvedAt,
      approvedBy: auth.user.id,
      evidenceUrl: text(body.evidence_url) || null,
      metadata: {
        approval_reference: text(body.approval_reference) || null,
        producer: 'social_content_approved_summary',
      },
    })
    await persistApprovedSourceProjections([projection])

    let reconciliation: { status: string; generated_at: string } | null = null
    try {
      const coverage = await collectLiveSocialTopicCoverage({ persist: true })
      reconciliation = { status: coverage.status, generated_at: coverage.generated_at }
    } catch (error) {
      console.warn('[social-topic-source-summary] event refresh deferred:', error)
    }

    return NextResponse.json({
      success: true,
      receipt: projection,
      reconciliation,
      candidate_creation: 'review_only',
      raw_content_included: false,
      side_effects: { publish: false, schedule: false, provider_call: false, external_send: false },
    })
  } catch (error) {
    console.error('[social-topic-source-summary] projection failed:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Approved summary projection failed',
    }, { status: 500 })
  }
}
