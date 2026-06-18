import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildSocialProductionAssetsPacket,
  type BrollLibraryAsset,
  type ChronicleIngestionScope,
} from '@/lib/social-production-assets'
import type { FrameworkVisualType } from '@/lib/social-content'

export const dynamic = 'force-dynamic'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function parseChronicleScope(value: unknown): ChronicleIngestionScope | null {
  const record = asRecord(value)
  if (record.approved !== true) return null

  const source = asString(record.source) || 'social_content_detail'
  const windowLabel = asString(record.window_label) || asString(record.scope_label)
  if (!windowLabel) return null

  return {
    approved: true,
    source,
    window_label: windowLabel,
    notes: asStringArray(record.notes),
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

    const body = await request.json().catch(() => ({}))
    const chronicleScope = parseChronicleScope(asRecord(body).chronicle_scope)
    if (!chronicleScope) {
      return NextResponse.json({
        error: 'Explicit Chronicle ingestion scope is required before preparing production assets.',
      }, { status: 400 })
    }

    const { id } = params
    const { data: item, error: fetchError } = await supabaseAdmin
      .from('social_content_queue')
      .select('id, status, post_text, cta_text, hashtags, image_prompt, framework_visual_type, rag_context')
      .eq('id', id)
      .single()

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    if (item.status !== 'approved') {
      return NextResponse.json({
        error: 'Copy must be approved before preparing the production asset packet.',
      }, { status: 409 })
    }

    const ragContext = asRecord(item.rag_context)

    const { data: brollRows, error: brollError } = await supabaseAdmin
      .from('broll_library')
      .select('id, route, route_description, filename, screenshot_path, clip_path, captured_at')

    if (brollError) {
      console.warn('[prepare-asset-packet] B-roll lookup failed:', brollError)
    }

    const productionAssets = buildSocialProductionAssetsPacket({
      contentId: id,
      postText: asString(item.post_text),
      ctaText: asString(item.cta_text) || null,
      hashtags: asStringArray(item.hashtags),
      imagePrompt: asString(item.image_prompt) || null,
      frameworkVisualType: (asString(item.framework_visual_type) || null) as FrameworkVisualType | null,
      ragContext,
      brollAssets: (brollRows ?? []) as BrollLibraryAsset[],
      chronicleScope,
    })

    const nextRagContext = {
      ...ragContext,
      production_assets: productionAssets,
    }

    const { error: updateError } = await supabaseAdmin
      .from('social_content_queue')
      .update({ rag_context: nextRagContext })
      .eq('id', id)

    if (updateError) {
      console.error('[prepare-asset-packet] update failed:', updateError)
      return NextResponse.json({ error: 'Failed to update production asset packet' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      production_assets: productionAssets,
      rag_context: nextRagContext,
    })
  } catch (error) {
    console.error('[prepare-asset-packet] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
