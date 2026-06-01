import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { refreshPublishedSocialEngagement } from '@/lib/social-engagement-refresh'
import { supabaseAdmin } from '@/lib/supabase'
import type { SocialPlatform } from '@/lib/social-content'

export const dynamic = 'force-dynamic'

const SUPPORTED_PLATFORMS = new Set<SocialPlatform>(['linkedin'])

function socialPlatform(value: unknown): SocialPlatform {
  return typeof value === 'string' && SUPPORTED_PLATFORMS.has(value as SocialPlatform)
    ? value as SocialPlatform
    : 'linkedin'
}

/**
 * POST /api/admin/social-content/engagement/refresh
 *
 * Refreshes read-only engagement metrics for published Social Content rows.
 * This route does not publish, schedule, DM, or mutate any external platform.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const platform = socialPlatform(body.platform)
    const contentId = typeof body.content_id === 'string' && body.content_id.trim() ? body.content_id.trim() : null
    const limit = Number.isFinite(Number(body.limit)) ? Number(body.limit) : 20
    const force = body.force === true

    const result = await refreshPublishedSocialEngagement({
      db: supabaseAdmin,
      platform,
      contentId,
      limit,
      force,
    })

    return NextResponse.json({
      ok: true,
      platform,
      content_id: contentId,
      ...result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Engagement refresh failed'
    const status = message.includes('APIFY_API_TOKEN') ? 503 : 500
    console.error('[social-engagement-refresh] failed:', error)
    return NextResponse.json({ error: message }, { status })
  }
}
