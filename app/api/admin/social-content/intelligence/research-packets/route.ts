import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  normalizePatternStatus,
  scoreCreatorAsset,
  socialMetricsFromUnknown,
} from '@/lib/social-content-intelligence'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const PLATFORMS = new Set([
  'youtube',
  'youtube_shorts',
  'instagram',
  'instagram_reels',
  'tiktok',
  'x',
  'linkedin',
  'other',
])

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isMissingResearchTable(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : String(error ?? '')
  return message.includes('social_content_research_packets') && (
    message.includes('does not exist')
    || message.includes('schema cache')
    || message.includes('Could not find the table')
  )
}

export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const platform = searchParams.get('platform')
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 50)

  if (platform && !PLATFORMS.has(platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
  }

  try {
    let query = supabaseAdmin
      .from('social_content_research_packets')
      .select('*')

    if (status) query = query.eq('status', status)
    if (platform) query = query.eq('platform', platform)

    const { data, error } = await query
      .order('outlier_score', { ascending: false })
      .order('retrieved_at', { ascending: false })
      .limit(limit)

    if (error) {
      if (isMissingResearchTable(error)) {
        return NextResponse.json({
          packets: [],
          unavailable: true,
          error: 'Social Content Intelligence migration has not been applied yet',
        })
      }
      throw new Error(error.message)
    }

    return NextResponse.json({ packets: data ?? [] })
  } catch (error) {
    console.error('[social-content-intelligence] list packets failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list research packets' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const body = asRecord(await request.json().catch(() => ({})))
  const sourceUrl = asString(body.source_url)
  const platform = asString(body.platform) || 'other'
  if (!sourceUrl) {
    return NextResponse.json({ error: 'source_url is required' }, { status: 400 })
  }
  if (!PLATFORMS.has(platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
  }

  const metrics = asRecord(body.metrics)
  const score = scoreCreatorAsset({
    ...socialMetricsFromUnknown(metrics),
    retrieved_at: asString(body.retrieved_at) || new Date().toISOString(),
  })

  try {
    const { data, error } = await supabaseAdmin
      .from('social_content_research_packets')
      .insert({
        source_url: sourceUrl,
        platform,
        creator_name: asString(body.creator_name) || null,
        creator_handle: asString(body.creator_handle) || null,
        title: asString(body.title) || null,
        caption: asString(body.caption) || null,
        thumbnail_url: asString(body.thumbnail_url) || null,
        hook_transcript: asString(body.hook_transcript) || null,
        metrics,
        actor_metadata: asRecord(body.actor_metadata),
        outlier_score: score.outlier_score,
        score_breakdown: score,
        pattern_packet: asRecord(body.pattern_packet),
        pattern_status: normalizePatternStatus(body.pattern_status),
        privacy_notes: asString(body.privacy_notes) || 'Public research packet. Do not copy source script, title, thumbnail, or visual identity.',
        retrieved_at: asString(body.retrieved_at) || new Date().toISOString(),
        created_by: authResult.user.id,
      })
      .select('*')
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({
      success: true,
      packet: data,
      side_effects: {
        provider_generation: false,
        upload: false,
        publish: false,
        schedule: false,
        external_post: false,
      },
    })
  } catch (error) {
    console.error('[social-content-intelligence] create packet failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create research packet' },
      { status: 500 },
    )
  }
}
