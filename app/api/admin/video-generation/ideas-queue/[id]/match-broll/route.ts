/**
 * GET /api/admin/video-generation/ideas-queue/[id]/match-broll
 * Returns auto-matched broll_library IDs for a draft based on storyboard brollHint values.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface StoryboardScene {
  brollHint?: string
  sceneNumber?: number
  description?: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data: queueItem, error: fetchErr } = await supabaseAdmin
      .from('video_ideas_queue')
      .select('id, storyboard_json')
      .eq('id', params.id)
      .single()

    if (fetchErr || !queueItem) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    const storyboard = queueItem.storyboard_json as { scenes?: StoryboardScene[] } | null
    const hints = storyboard?.scenes
      ?.map(s => s.brollHint)
      .filter(Boolean) as string[] ?? []

    if (hints.length === 0) {
      return NextResponse.json({ matchedIds: [], hints: [] })
    }

    const { data: libraryAssets } = await supabaseAdmin
      .from('broll_library')
      .select('id, filename, route_description')

    const matchedIds: string[] = []
    if (libraryAssets && libraryAssets.length > 0) {
      for (const hint of hints) {
        const lower = hint.toLowerCase()
        const match = libraryAssets.find(
          (a: { id: string; filename: string; route_description: string | null }) =>
            a.filename.toLowerCase().includes(lower) ||
            (a.route_description ?? '').toLowerCase().includes(lower)
        )
        if (match && !matchedIds.includes(match.id)) {
          matchedIds.push(match.id)
        }
      }
    }

    return NextResponse.json({ matchedIds, hints })
  } catch (error) {
    console.error('[match-broll] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
