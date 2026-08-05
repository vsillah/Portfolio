/**
 * GET/POST /api/cron/social-content-scheduled-publish
 *
 * Publishes due Social Content rows only after final platform-submission approval.
 * Auth: Bearer CRON_SECRET or N8N_INGEST_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { publishSocialContentItem } from '@/lib/social-content-publisher'
import type { SocialPlatform } from '@/lib/social-content'
import { isPlatformSubmissionGateApproved } from '@/lib/social-platform-orchestration'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

type PublishRow = {
  platform: SocialPlatform
  status: string
  platform_post_url?: string | null
}

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const allowedTokens = [process.env.CRON_SECRET, process.env.N8N_INGEST_SECRET].filter(Boolean)
  return Boolean(token && allowedTokens.includes(token))
}

async function bodyOrEmpty(request: NextRequest) {
  if (request.method === 'GET') return {}
  return request.json().catch(() => ({})) as Promise<Record<string, unknown>>
}

function isDryRun(request: NextRequest, body: Record<string, unknown>) {
  const { searchParams } = new URL(request.url)
  return searchParams.get('dry_run') === '1'
    || searchParams.get('dry_run') === 'true'
    || body.dry_run === true
}

function limitFrom(request: NextRequest, body: Record<string, unknown>) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('limit') ?? body.limit
  const parsed = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : 10
  if (!Number.isFinite(parsed)) return 10
  return Math.min(Math.max(Math.floor(parsed), 1), 20)
}

function asPlatform(value: unknown): SocialPlatform | null {
  return typeof value === 'string' && ['linkedin', 'youtube', 'instagram', 'facebook', 'tiktok', 'x'].includes(value)
    ? value as SocialPlatform
    : null
}

async function runScheduledPublishSweep(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = supabaseAdmin
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const body = await bodyOrEmpty(request)
    const dryRun = isDryRun(request, body)
    const limit = limitFrom(request, body)
    const now = new Date().toISOString()

    const { data, error } = await admin
      .from('social_content_queue')
      .select('id, platform, target_platforms, status, scheduled_for, rag_context')
      .eq('status', 'scheduled')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(limit)

    if (error) throw error

    const items = data ?? []
    const evaluated: Array<Record<string, unknown>> = []
    let publishedCount = 0
    let blockedCount = 0

    for (const item of items) {
      const { data: publishRows, error: publishError } = await admin
        .from('social_content_publishes')
        .select('platform, status, platform_post_url')
        .eq('content_id', item.id)

      if (publishError) {
        blockedCount += 1
        evaluated.push({
          id: item.id,
          status: 'blocked',
          reason: publishError.message || 'Failed to load publish rows',
        })
        continue
      }

      const pendingPlatforms = ((publishRows ?? []) as PublishRow[])
        .filter((publish) => publish.status === 'pending' || publish.status === 'failed')
        .map((publish) => asPlatform(publish.platform))
        .filter((platform): platform is SocialPlatform => Boolean(platform))

      if (!pendingPlatforms.length) {
        evaluated.push({
          id: item.id,
          status: 'skipped',
          reason: 'No pending or failed publish rows remain.',
        })
        continue
      }

      if (!isPlatformSubmissionGateApproved(item.rag_context, pendingPlatforms)) {
        blockedCount += 1
        evaluated.push({
          id: item.id,
          status: 'blocked',
          reason: 'Final platform submission gate is not approved for the pending platforms.',
          platforms: pendingPlatforms,
        })
        continue
      }

      if (dryRun) {
        evaluated.push({
          id: item.id,
          status: 'eligible',
          platforms: pendingPlatforms,
          scheduled_for: item.scheduled_for,
        })
        continue
      }

      const result = await publishSocialContentItem({
        admin,
        id: item.id,
        targetPlatforms: pendingPlatforms,
      })
      const published = result.status === 200 && result.body.published === true
      if (published) publishedCount += 1
      else blockedCount += 1
      evaluated.push({
        id: item.id,
        status: published ? 'published' : 'blocked',
        response_status: result.status,
        platforms: pendingPlatforms,
        result: result.body,
      })
    }

    return NextResponse.json({
      ok: true,
      dry_run: dryRun,
      checked_count: items.length,
      published_count: publishedCount,
      blocked_count: blockedCount,
      evaluated,
      side_effects: {
        provider_generation: false,
        upload: false,
        external_schedule: false,
        publish: !dryRun && publishedCount > 0,
        external_post: !dryRun && publishedCount > 0,
      },
    })
  } catch (error) {
    console.error('[social-content-scheduled-publish] failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scheduled publish sweep failed' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  return runScheduledPublishSweep(request)
}

export async function POST(request: NextRequest) {
  return runScheduledPublishSweep(request)
}
