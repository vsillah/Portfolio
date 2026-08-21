import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildAutoResearchBacklogReadOnlyResponse,
  type AutoResearchBacklogChannel,
} from '@/lib/cross-channel-autoresearch-backlog'
import {
  activateAutoResearchBacklogItem,
  findAutoResearchBacklogItem,
} from '@/lib/autoresearch-calendar-activation'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  return NextResponse.json(buildAutoResearchBacklogReadOnlyResponse())
}

function requestedChannels(value: unknown): AutoResearchBacklogChannel[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter((channel): channel is AutoResearchBacklogChannel => (
    typeof channel === 'string'
    && [
      'linkedin',
      'x',
      'youtube',
      'youtube_shorts',
      'instagram',
      'instagram_reels',
      'facebook',
      'tiktok',
      'thumbnail',
      'manual',
    ].includes(channel)
  ))
}

export async function POST(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const itemId = typeof body.item_id === 'string' ? body.item_id.trim() : ''
    if (!itemId) {
      return NextResponse.json({ error: 'item_id is required' }, { status: 400 })
    }

    const item = findAutoResearchBacklogItem(itemId)
    if (!item) {
      return NextResponse.json({ error: 'AutoResearch backlog item not found' }, { status: 404 })
    }

    const activation = await activateAutoResearchBacklogItem({
      admin: supabaseAdmin,
      item,
      actorUserId: authResult.user.id,
      channels: requestedChannels(body.channels),
    })

    return NextResponse.json({
      ok: true,
      activation,
      projection: buildAutoResearchBacklogReadOnlyResponse(),
    })
  } catch (error) {
    console.error('[autoresearch-backlog] activation failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to activate AutoResearch backlog item' },
      { status: 500 },
    )
  }
}
