/**
 * POST /api/admin/video-generation/queue/[id]/generate-broll
 * Run B-roll capture only for a queue item. Does not create a HeyGen job.
 * Output: design-files/broll/{slug}/B-roll/
 */

import * as path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { captureBroll, DEFAULT_ROUTES, selectRoutesFromScript } from '@/lib/playtest-broll'
import { videoSlugFromFileName } from '@/lib/video-slug'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const queueId = params.id
    const body = await request.json().catch(() => ({}))
    const brollRoutes = (body.brollRoutes as 'all' | 'script') ?? 'all'

    const { data: queueItem, error: fetchErr } = await supabaseAdmin
      .from('drive_video_queue')
      .select('id, drive_file_name, script_text')
      .eq('id', queueId)
      .single()

    if (fetchErr || !queueItem) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 })
    }

    const driveFileName = queueItem.drive_file_name ?? `video-${queueId}`
    const scriptText = (queueItem.script_text ?? '').trim()
    const slug = videoSlugFromFileName(driveFileName)
    const brollDir = path.join(process.cwd(), 'design-files', 'broll', slug, 'B-roll')
    const routes = brollRoutes === 'script' ? selectRoutesFromScript(scriptText, DEFAULT_ROUTES) : DEFAULT_ROUTES
    const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'

    const result = await captureBroll({
      routes,
      outputDir: brollDir,
      recordVideos: true,
      baseUrl,
      noStartServer: true,
    })

    return NextResponse.json({
      ok: true,
      outputDir: result.outputDir,
      screenshots: result.screenshots.length,
      clips: result.clips.length,
    })
  } catch (error) {
    console.error('[Video generation] Generate B-roll error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
