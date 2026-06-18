import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getProductionAssets,
  getVideoRedactionGate,
  type RedactionReviewDecision,
  type VideoRedactionManifestItem,
} from '@/lib/social-production-assets'

export const dynamic = 'force-dynamic'

const DECISIONS = new Set<RedactionReviewDecision>([
  'approve_redaction',
  'adjust_redaction',
  'safe_exception',
  'reject_clip',
])

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function nextItemForDecision(
  item: VideoRedactionManifestItem,
  decision: RedactionReviewDecision,
  redactedAssetUrl: string | null,
): VideoRedactionManifestItem {
  const status = decision === 'adjust_redaction'
    ? 'pending'
    : decision === 'reject_clip'
      ? 'rejected'
      : 'approved'

  return {
    ...item,
    reviewer_decision: decision,
    status,
    redacted_asset: redactedAssetUrl
      ? {
          label: `${item.original_asset.label} redacted`,
          url_or_path: redactedAssetUrl,
        }
      : item.redacted_asset,
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = asRecord(await request.json().catch(() => ({})))
    const itemId = typeof body.item_id === 'string' ? body.item_id.trim() : ''
    const decision = typeof body.decision === 'string' ? body.decision.trim() as RedactionReviewDecision : null
    const redactedAssetUrl = typeof body.redacted_asset_url === 'string' && body.redacted_asset_url.trim()
      ? body.redacted_asset_url.trim()
      : null

    if (!itemId || !decision || !DECISIONS.has(decision)) {
      return NextResponse.json({
        error: 'A valid item_id and redaction decision are required.',
      }, { status: 400 })
    }

    const { id } = params
    const { data: item, error: fetchError } = await supabaseAdmin
      .from('social_content_queue')
      .select('rag_context')
      .eq('id', id)
      .single()

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    const ragContext = asRecord(item.rag_context)
    const productionAssets = getProductionAssets(ragContext)
    if (!productionAssets) {
      return NextResponse.json({ error: 'Production asset packet not found' }, { status: 404 })
    }

    let found = false
    const nextItems = productionAssets.video_redaction_manifest.items.map((redactionItem) => {
      if (redactionItem.id !== itemId) return redactionItem
      found = true
      return nextItemForDecision(redactionItem, decision, redactedAssetUrl)
    })

    if (!found) {
      return NextResponse.json({ error: 'Redaction item not found' }, { status: 404 })
    }

    const nextProductionAssets = {
      ...productionAssets,
      video_redaction_manifest: {
        ...productionAssets.video_redaction_manifest,
        items: nextItems,
      },
    }
    const gate = getVideoRedactionGate(nextProductionAssets)
    nextProductionAssets.video_redaction_manifest = {
      ...nextProductionAssets.video_redaction_manifest,
      status: gate.ready ? 'ready' : 'requires_review',
      unresolved_count: gate.unresolvedItems.length,
      publish_blocker: gate.message,
    }

    const nextRagContext = {
      ...ragContext,
      production_assets: nextProductionAssets,
    }

    const { error: updateError } = await supabaseAdmin
      .from('social_content_queue')
      .update({ rag_context: nextRagContext })
      .eq('id', id)

    if (updateError) {
      console.error('[review-video-redaction] update failed:', updateError)
      return NextResponse.json({ error: 'Failed to update redaction review' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      production_assets: nextProductionAssets,
      rag_context: nextRagContext,
      redaction_gate: gate,
    })
  } catch (error) {
    console.error('[review-video-redaction] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
