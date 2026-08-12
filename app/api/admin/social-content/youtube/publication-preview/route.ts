import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { previewYouTubePublicationReconciliation } from '@/lib/youtube-publication-reconciliation-preview'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/social-content/youtube/publication-preview
 *
 * Builds a read-only reconciliation proposal for an explicitly selected Social
 * Content row and exact YouTube video ID/URL. This route never writes publish
 * rows, queue rows, calendars, ingestion runs, Slack state, or provider data.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const result = await previewYouTubePublicationReconciliation({
      db: supabaseAdmin,
      contentId: typeof body.content_id === 'string' ? body.content_id : null,
      videoId: typeof body.youtube_video_id === 'string' ? body.youtube_video_id : null,
      videoUrl: typeof body.youtube_video_url === 'string' ? body.youtube_video_url : null,
    })

    return NextResponse.json(result)
  } catch {
    console.error('[youtube-publication-preview] failed')
    return NextResponse.json({ error: 'YouTube publication preview failed' }, { status: 500 })
  }
}
