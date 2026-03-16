/**
 * POST /api/admin/video-generation/broll-library/capture
 * Captures B-roll for specified routes (or all default routes) and upserts into broll_library.
 * Accepts { routes?: string[], recordVideos?: boolean, onlyMissing?: boolean, staleThresholdDays?: number }
 *
 * When Accept: text/event-stream, streams per-route progress via SSE.
 * Otherwise returns a single JSON response (backward compat).
 */

import * as path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { captureBroll, DEFAULT_ROUTES, type RouteConfig } from '@/lib/playtest-broll'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const BROLL_OUTPUT_DIR = path.join(process.cwd(), 'design-files', 'broll', 'library')

async function resolveRoutes(body: Record<string, unknown>): Promise<{ routes: RouteConfig[] | null; error?: string; freshMessage?: string }> {
  const onlyMissing = body.onlyMissing === true
  const staleThresholdDays = typeof body.staleThresholdDays === 'number' ? body.staleThresholdDays : 7

  let routesToCapture: RouteConfig[] = DEFAULT_ROUTES

  if (Array.isArray(body.routes) && body.routes.length > 0) {
    routesToCapture = DEFAULT_ROUTES.filter((r) => (body.routes as string[]).includes(r.route))
    if (routesToCapture.length === 0) {
      return { routes: null, error: 'No matching routes found' }
    }
  }

  if (onlyMissing) {
    const { data: existing } = await supabaseAdmin
      .from('broll_library')
      .select('route, captured_at')

    if (existing && existing.length > 0) {
      const staleThreshold = new Date(Date.now() - staleThresholdDays * 86400000)
      const freshRoutes = new Set(
        existing
          .filter((e: { route: string; captured_at: string }) => new Date(e.captured_at) > staleThreshold)
          .map((e: { route: string }) => e.route)
      )
      routesToCapture = routesToCapture.filter((r) => !freshRoutes.has(r.route))
    }

    if (routesToCapture.length === 0) {
      return { routes: null, freshMessage: 'All routes are fresh' }
    }
  }

  return { routes: routesToCapture }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({}))
    const recordVideos = body.recordVideos !== false
    const wantsSSE = request.headers.get('accept')?.includes('text/event-stream')

    const resolved = await resolveRoutes(body)
    if (resolved.error) {
      return NextResponse.json({ error: resolved.error }, { status: 400 })
    }
    if (resolved.freshMessage) {
      if (wantsSSE) {
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: 'done', captured: 0, message: resolved.freshMessage })}\n\n`))
            controller.close()
          },
        })
        return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } })
      }
      return NextResponse.json({ captured: 0, message: resolved.freshMessage })
    }

    const routesToCapture = resolved.routes!
    const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'

    if (!wantsSSE) {
      const result = await captureBroll({
        routes: routesToCapture,
        outputDir: BROLL_OUTPUT_DIR,
        recordVideos,
        baseUrl,
        noStartServer: true,
      })

      const upserted = await upsertResults(routesToCapture, result)
      return NextResponse.json({
        captured: upserted.length,
        routes: upserted,
        screenshots: result.screenshots.length,
        clips: result.clips.length,
      })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch { /* closed */ }
        }

        try {
          send({ step: 'starting', total: routesToCapture.length })

          const result = await captureBroll({
            routes: routesToCapture,
            outputDir: BROLL_OUTPUT_DIR,
            recordVideos,
            baseUrl,
            noStartServer: true,
            onProgress: (evt) => {
              send({
                step: 'capturing',
                route: evt.route,
                filename: evt.filename,
                substep: evt.step,
                index: evt.index,
                total: evt.total,
                detail: evt.step === 'navigating' ? `Loading ${evt.route}` : evt.step === 'screenshot' ? 'Taking screenshot' : evt.step === 'recording' ? 'Recording clip' : 'Done',
              })
            },
          })

          send({ step: 'upserting', detail: 'Saving to library...' })
          const upserted = await upsertResults(routesToCapture, result)

          send({
            step: 'done',
            captured: upserted.length,
            routes: upserted,
            screenshots: result.screenshots.length,
            clips: result.clips.length,
          })
        } catch (err) {
          send({ step: 'error', error: err instanceof Error ? err.message : String(err) })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[broll-library] Capture error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

async function upsertResults(
  routesToCapture: RouteConfig[],
  result: { screenshots: string[]; clips: string[] }
): Promise<string[]> {
  const upserted: string[] = []
  for (const routeConfig of routesToCapture) {
    const screenshotFile = result.screenshots.find((s) => s.includes(routeConfig.filename))
    const clipFile = result.clips.find((c) => c.includes(routeConfig.filename))

    const { error: upsertErr } = await supabaseAdmin
      .from('broll_library')
      .upsert(
        {
          route: routeConfig.route,
          route_description: routeConfig.description ?? null,
          filename: routeConfig.filename,
          screenshot_path: screenshotFile ?? null,
          clip_path: clipFile ?? null,
          captured_at: new Date().toISOString(),
        },
        { onConflict: 'route,filename' }
      )

    if (upsertErr) {
      console.error(`[broll-library] Upsert error for ${routeConfig.route}:`, upsertErr)
    } else {
      upserted.push(routeConfig.route)
    }
  }
  return upserted
}
