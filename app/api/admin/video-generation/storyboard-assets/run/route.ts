/**
 * POST /api/admin/video-generation/storyboard-assets/run
 * Run the storyboard B-roll pipeline: schematics + capture to design-files/about-page-video/.
 * Requires dev server at BASE_URL; uses ADMIN_E2E_* or STORYBOARD_AUTH_STATE for admin routes.
 */

import * as path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { captureBroll, DEFAULT_ROUTES } from '@/lib/playtest-broll'
import { generateStoryboardSchematics } from '@/scripts/generate-storyboard-schematics'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const OUTPUT_DIR = path.join(process.cwd(), 'design-files', 'about-page-video')

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({}))
    const recordVideos = body.recordVideos !== false

    const schematicPaths = generateStoryboardSchematics(OUTPUT_DIR)
    const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'

    const result = await captureBroll({
      routes: DEFAULT_ROUTES,
      outputDir: OUTPUT_DIR,
      recordVideos,
      baseUrl,
      noStartServer: true,
    })

    return NextResponse.json({
      outputDir: result.outputDir,
      schematicsCount: schematicPaths.length,
      screenshotsCount: result.screenshots.length,
      clipsCount: result.clips.length,
    })
  } catch (error) {
    console.error('[Video generation] Storyboard assets run error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
