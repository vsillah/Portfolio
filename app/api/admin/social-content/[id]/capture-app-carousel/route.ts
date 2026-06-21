import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { renderCarousel } from '@/lib/carousel'
import { captureBroll, type RouteConfig } from '@/lib/playtest-broll'
import { getProductionAssets } from '@/lib/social-production-assets'
import { supabaseAdmin } from '@/lib/supabase'
import type { CarouselSlide } from '@/lib/social-content'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

type AppCarouselRoute = {
  route: string
  label: string
}

type ScreenshotAsset = AppCarouselRoute & {
  storage_path: string
  url: string
  captured_at: string
}

const ALLOWED_ROUTE_PREFIXES = [
  '/admin/social-content',
  '/admin/agents',
]

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'route'
}

function normalizeInternalRoute(route: string): string | null {
  const trimmed = route.trim()
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return null
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return null
  }

  try {
    const parsed = new URL(trimmed, 'http://portfolio.local')
    if (parsed.origin !== 'http://portfolio.local') {
      return null
    }
    const isAllowed = ALLOWED_ROUTE_PREFIXES.some((prefix) => (
      parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`)
    ))
    if (!isAllowed) return null
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

function parseRequestedRoutes(value: unknown): AppCarouselRoute[] | null {
  if (value == null) return null
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      const record = asRecord(entry)
      const route = normalizeInternalRoute(asString(record.route))
      if (!route) return null
      const label = asString(record.label).trim() || route
      return { route, label }
    })
    .filter((entry): entry is AppCarouselRoute => Boolean(entry))
}

function defaultRoutes(contentId: string, ragContext: Record<string, unknown>): AppCarouselRoute[] {
  const goalId = asString(ragContext.goal_id)
  return [
    { route: `/admin/social-content/${contentId}`, label: 'Social Content review' },
    { route: '/admin/agents/swarm-board', label: 'Agent Swarm Board' },
    {
      route: goalId
        ? `/admin/agents/standup?goal=${encodeURIComponent(goalId)}`
        : '/admin/agents/standup',
      label: 'Standup Room goal',
    },
    { route: '/admin/agents/open-brain', label: 'Open Brain references' },
  ]
}

function toBrollRoutes(routes: AppCarouselRoute[]): RouteConfig[] {
  return routes.map((route, index) => ({
    route: route.route,
    filename: `app-screenshot-${String(index + 1).padStart(2, '0')}-${slug(route.label)}`,
    description: route.label,
    fullPage: false,
  }))
}

function buildScreenshotSlides(params: {
  postText: string
  ctaText: string
  hashtags: string[]
  assets: ScreenshotAsset[]
}): CarouselSlide[] {
  const hookLine = params.postText.split(/\n+/).find((line) => line.trim())?.trim()
  const firstAssetLabel = params.assets[0]?.label || 'Portfolio workflow'
  const ctaHeadline = params.ctaText.trim() || 'Make the workflow visible before you scale it.'

  return [
    {
      type: 'cover',
      eyebrow: 'Agent Ops Proof',
      headline: 'The operating layer behind the post',
      subhead: hookLine || 'Screenshots from the Portfolio workflow that produced and reviewed this draft.',
      byline: 'AmaduTown Advisory Solutions',
      ghost_text: 'PROOF',
    },
    {
      type: 'hook',
      headline: 'Portfolio review surfaces',
      big_stat: String(params.assets.length),
      stat_label: 'Portfolio review surfaces',
      body: 'The post is one artifact. The trust comes from the review steps, references, gates, and ownership trail around it.',
    },
    ...params.assets.map((asset): CarouselSlide => ({
      type: 'screenshot',
      eyebrow: 'Portfolio Screenshot',
      headline: asset.label,
      route_label: asset.label,
      route: asset.route,
      screenshot_url: asset.url,
      caption: asset.label === firstAssetLabel
        ? 'The approved draft stays in Social Content while visual production remains a separate manual action.'
        : 'Each supporting surface keeps the source trail visible before anything moves toward publishing.',
    })),
    {
      type: 'quote',
      headline: 'Receipts before scale',
      blockquote: 'Every answer needs receipts. Every task needs an owner. Every risky action needs a gate.',
      attribution: 'Agent Ops operating principle',
    },
    {
      type: 'cta',
      cta_label: 'Build with receipts',
      headline: ctaHeadline,
      body: 'If AI is going to run closer to the work, the review surface has to show what it understood, what it changed, and what still needs human approval.',
      hashtags: params.hashtags,
    },
  ]
}

async function uploadBuffer(params: {
  bucket: string
  fileName: string
  buffer: Buffer
  contentType: string
}): Promise<string> {
  const storage = supabaseAdmin.storage.from(params.bucket)
  const { error } = await storage.upload(params.fileName, params.buffer, {
    contentType: params.contentType,
    upsert: true,
  })
  if (error) {
    throw new Error(`Failed to upload ${params.fileName}: ${error.message || String(error)}`)
  }
  const { data } = storage.getPublicUrl(params.fileName)
  return data.publicUrl
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { id } = params
  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const bodyRecord = asRecord(body)
  const requestedRoutesInput = bodyRecord.routes
  if (requestedRoutesInput != null && !Array.isArray(requestedRoutesInput)) {
    return NextResponse.json({ error: 'Routes must be an array of whitelisted internal Portfolio admin paths.' }, { status: 400 })
  }
  const requestedRoutes = parseRequestedRoutes(requestedRoutesInput)
  if (requestedRoutesInput != null && (!requestedRoutes || requestedRoutes.length !== (Array.isArray(requestedRoutesInput) ? requestedRoutesInput.length : 0))) {
    return NextResponse.json({ error: 'Routes must be whitelisted internal Portfolio admin paths.' }, { status: 400 })
  }

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from('social_content_queue')
    .select('post_text, cta_text, hashtags, rag_context')
    .eq('id', id)
    .single()

  if (fetchErr || !row) {
    return NextResponse.json({ error: 'Content not found' }, { status: 404 })
  }

  const ragContext = asRecord(row.rag_context)
  const routes = requestedRoutes?.length ? requestedRoutes : defaultRoutes(id, ragContext)
  const outputDir = path.join(os.tmpdir(), 'portfolio-social-content-app-screenshots', id, String(Date.now()))
  const baseUrl = new URL(request.url).origin
  const capturedAt = new Date().toISOString()

  try {
    const captureResult = await captureBroll({
      routes: toBrollRoutes(routes),
      outputDir,
      baseUrl,
      noStartServer: true,
      authStateOutPath: path.join(outputDir, '.auth-state.json'),
    })

    if (captureResult.screenshots.length !== routes.length) {
      return NextResponse.json({ error: 'Screenshot capture did not complete for every requested route.' }, { status: 502 })
    }

    const assets: ScreenshotAsset[] = []
    for (let i = 0; i < routes.length; i += 1) {
      const fileBuffer = await fs.readFile(captureResult.screenshots[i])
      const fileName = `app-screenshots/${id}/${String(i + 1).padStart(2, '0')}-${slug(routes[i].label)}.png`
      const url = await uploadBuffer({
        bucket: 'social-content',
        fileName,
        buffer: fileBuffer,
        contentType: 'image/png',
      })
      assets.push({
        ...routes[i],
        storage_path: fileName,
        url,
        captured_at: capturedAt,
      })
    }

    const slides = buildScreenshotSlides({
      postText: asString(row.post_text),
      ctaText: asString(row.cta_text),
      hashtags: Array.isArray(row.hashtags) ? (row.hashtags as unknown[]).filter((tag): tag is string => typeof tag === 'string') : [],
      assets,
    })

    const { pngBuffers, pdfBuffer } = await renderCarousel(slides)
    const slideUrls: string[] = []
    const storageBase = `carousels/${id}`

    for (let i = 0; i < pngBuffers.length; i += 1) {
      const fileName = `${storageBase}/slide_${String(i + 1).padStart(2, '0')}.png`
      const url = await uploadBuffer({
        bucket: 'social-content',
        fileName,
        buffer: pngBuffers[i],
        contentType: 'image/png',
      })
      slideUrls.push(url)
    }

    const pdfUrl = await uploadBuffer({
      bucket: 'social-content',
      fileName: `${storageBase}/carousel.pdf`,
      buffer: pdfBuffer,
      contentType: 'application/pdf',
    })

    const productionAssets = getProductionAssets(ragContext)
    const nextProductionAssets = productionAssets
      ? {
          ...productionAssets,
          app_screenshot_carousel: {
            ...productionAssets.app_screenshot_carousel,
            status: 'ready',
            routes,
            existing_asset_count: assets.length,
            carousel_pdf_url: pdfUrl,
            carousel_slide_urls: slideUrls,
          },
        }
      : null

    const nextRagContext = {
      ...ragContext,
      app_screenshot_assets: assets,
      app_screenshot_carousel: {
        status: 'ready',
        route_count: routes.length,
        slide_count: slides.length,
        updated_at: capturedAt,
      },
      ...(nextProductionAssets ? { production_assets: nextProductionAssets } : {}),
    }

    const { error: updateErr } = await supabaseAdmin
      .from('social_content_queue')
      .update({
        content_format: 'carousel',
        carousel_slides: slides,
        carousel_slide_urls: slideUrls,
        carousel_pdf_url: pdfUrl,
        rag_context: nextRagContext,
      })
      .eq('id', id)

    if (updateErr) {
      throw new Error(`Failed to update social content: ${updateErr.message || String(updateErr)}`)
    }

    return NextResponse.json({
      success: true,
      content_format: 'carousel',
      carousel_slides: slides,
      carousel_slide_urls: slideUrls,
      carousel_pdf_url: pdfUrl,
      app_screenshot_assets: assets,
      rag_context: nextRagContext,
      slide_count: slides.length,
    })
  } catch (error) {
    console.error('Error in capture-app-carousel:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to build app screenshot carousel',
    }, { status: 500 })
  } finally {
    await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {})
  }
}
