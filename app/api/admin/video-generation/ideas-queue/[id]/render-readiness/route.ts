/**
 * POST /api/admin/video-generation/ideas-queue/[id]/render-readiness
 * Read-only preflight for a draft render. Does not call HeyGen or mutate jobs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { channelToAspectRatio } from '@/lib/constants/video-channel'
import type { VideoChannel, VideoAspectRatio } from '@/lib/constants/video-channel'
import { buildVideoRenderReadinessReport } from '@/lib/video-render-readiness'

export const dynamic = 'force-dynamic'

interface StoryboardScene {
  brollHint?: string
}

function cleanIdArray(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

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
    const channel = (body.channel as VideoChannel) ?? 'youtube'
    const aspectRatio =
      (body.aspectRatio as VideoAspectRatio) ?? channelToAspectRatio(channel)
    const templateId =
      (body.templateId as string)?.trim() || process.env.HEYGEN_TEMPLATE_ID || null
    let avatarId =
      (body.avatarId as string)?.trim() || null
    let voiceId =
      (body.voiceId as string)?.trim() || null

    const { data: queueItem, error: fetchErr } = await supabaseAdmin
      .from('video_ideas_queue')
      .select('id, title, script_text, storyboard_json, status, video_generation_job_id, script_outline, script_scorecard, research_packet_ids')
      .eq('id', queueId)
      .single()

    if (fetchErr || !queueItem) {
      return NextResponse.json(
        { error: 'Draft queue item not found' },
        { status: 404 }
      )
    }

    if (!templateId && (!avatarId || !voiceId)) {
      const { getHeyGenDefaults } = await import('@/lib/heygen-config')
      const defaults = await getHeyGenDefaults()
      if (!avatarId && defaults.avatarId) avatarId = defaults.avatarId
      if (!voiceId && defaults.voiceId) voiceId = defaults.voiceId
    }

    let brollAssetIds = cleanIdArray(body.brollAssetIds)
    const storyboard = queueItem.storyboard_json as { scenes?: StoryboardScene[] } | null
    const scenes = Array.isArray(storyboard?.scenes) ? storyboard.scenes : []

    if (brollAssetIds.length === 0) {
      const brollHints = scenes
        .map((scene) => scene.brollHint)
        .filter((hint): hint is string => Boolean(hint?.trim()))

      if (brollHints.length > 0) {
        const { data: libraryAssets } = await supabaseAdmin
          .from('broll_library')
          .select('id, filename, route_description')

        if (libraryAssets && libraryAssets.length > 0) {
          for (const hint of brollHints) {
            const lower = hint.toLowerCase()
            const match = libraryAssets.find(
              (asset: { id: string; filename: string; route_description: string | null }) =>
                asset.filename.toLowerCase().includes(lower) ||
                (asset.route_description ?? '').toLowerCase().includes(lower)
            )
            if (match && !brollAssetIds.includes(match.id)) {
              brollAssetIds.push(match.id)
            }
          }
        }
      }
    }

    const report = buildVideoRenderReadinessReport({
      title: queueItem.title,
      status: queueItem.status,
      scriptText: queueItem.script_text,
      scriptOutline: queueItem.script_outline,
      scriptScorecard: queueItem.script_scorecard,
      researchPacketIds: Array.isArray(queueItem.research_packet_ids) ? queueItem.research_packet_ids : [],
      storyboardScenes: scenes.length,
      videoGenerationJobId: queueItem.video_generation_job_id,
      templateId,
      avatarId,
      voiceId,
      channel,
      aspectRatio,
      brollAssetIds,
    })

    return NextResponse.json({ report })
  } catch (error) {
    console.error('[Video generation] Render readiness error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
