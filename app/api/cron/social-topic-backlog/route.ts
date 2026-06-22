/**
 * GET/POST /api/cron/social-topic-backlog
 *
 * Lets Shaka maintain a review-only Social Content topic backlog from
 * sanitized internal summaries. Auth: Bearer CRON_SECRET or N8N_INGEST_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runSocialTopicBacklogDiscovery } from '@/lib/social-topic-backlog'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const allowedTokens = [process.env.CRON_SECRET, process.env.N8N_INGEST_SECRET].filter(Boolean)
  return Boolean(token && allowedTokens.includes(token))
}

async function runBacklogRefresh(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runSocialTopicBacklogDiscovery({
      actorId: null,
      triggerSource: request.method === 'GET'
        ? 'vercel_cron_social_topic_backlog'
        : 'manual_cron_social_topic_backlog',
    })

    return NextResponse.json({
      ok: true,
      candidate_count: result.packet.candidates.length,
      backlog_item_count: result.backlogItems.length,
      source_counts: result.sourceCounts,
      side_effects: {
        provider_generation: false,
        publish: false,
        schedule: false,
        external_post: false,
      },
    })
  } catch (error) {
    console.error('[social-topic-backlog-cron] failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Social topic backlog refresh failed' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  return runBacklogRefresh(request)
}

export async function POST(request: NextRequest) {
  return runBacklogRefresh(request)
}
