/**
 * POST /api/admin/video-generation/ideas-queue/[id]/generate
 * Create a video generation job from a drafts queue item.
 * Links matching B-roll library assets instead of capturing fresh.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { createVideo } from '@/lib/heygen'
import { channelToAspectRatio } from '@/lib/constants/video-channel'
import type { VideoChannel, VideoAspectRatio } from '@/lib/constants/video-channel'

export const dynamic = 'force-dynamic'

interface StoryboardScene {
  brollHint?: string
  sceneNumber?: number
  description?: string
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
      (body.templateId as string)?.trim() || process.env.HEYGEN_TEMPLATE_ID
    const brandVoiceId =
      (body.brandVoiceId as string)?.trim() || process.env.HEYGEN_BRAND_VOICE_ID
    let avatarId =
      (body.avatarId as string)?.trim() || process.env.HEYGEN_AVATAR_ID
    let voiceId =
      (body.voiceId as string)?.trim() || process.env.HEYGEN_VOICE_ID

    const { data: queueItem, error: fetchErr } = await supabaseAdmin
      .from('video_ideas_queue')
      .select('id, title, script_text, storyboard_json, status, source')
      .eq('id', queueId)
      .single()

    if (fetchErr || !queueItem) {
      return NextResponse.json(
        { error: 'Draft queue item not found' },
        { status: 404 }
      )
    }
    if (queueItem.status !== 'pending') {
      return NextResponse.json(
        { error: `Draft already ${queueItem.status}` },
        { status: 400 }
      )
    }

    const scriptText = (queueItem.script_text ?? '').trim()
    if (!scriptText) {
      return NextResponse.json(
        { error: 'Draft has no script text' },
        { status: 400 }
      )
    }

    if (!templateId && (!avatarId || !voiceId)) {
      const { getHeyGenDefaults } = await import('@/lib/heygen-config')
      const defaults = await getHeyGenDefaults()
      if (!avatarId && defaults.avatarId) avatarId = defaults.avatarId
      if (!voiceId && defaults.voiceId) voiceId = defaults.voiceId
    }

    if (!templateId && (!avatarId || !voiceId)) {
      return NextResponse.json(
        { error: 'Use template or provide avatarId and voiceId. Set defaults via Admin → Video Generation → Settings.' },
        { status: 400 }
      )
    }

    const HEYGEN_SCRIPT_MAX = 5000
    if (scriptText.length > HEYGEN_SCRIPT_MAX) {
      return NextResponse.json(
        {
          error: `Script exceeds HeyGen limit of ${HEYGEN_SCRIPT_MAX} characters (${scriptText.length}). Shorten or split.`,
        },
        { status: 400 }
      )
    }

    // B-roll: use client-provided IDs if present, otherwise auto-match from storyboard hints
    let brollAssetIds: string[] = []
    const clientBrollIds = Array.isArray(body.brollAssetIds) ? body.brollAssetIds as string[] : null

    if (clientBrollIds && clientBrollIds.length > 0) {
      brollAssetIds = clientBrollIds
    } else {
      const storyboard = queueItem.storyboard_json as { scenes?: StoryboardScene[] } | null
      const brollHints = storyboard?.scenes
        ?.map((s) => s.brollHint)
        .filter(Boolean) as string[] ?? []

      if (brollHints.length > 0) {
        const { data: libraryAssets } = await supabaseAdmin
          .from('broll_library')
          .select('id, filename, route_description')

        if (libraryAssets && libraryAssets.length > 0) {
          for (const hint of brollHints) {
            const lower = hint.toLowerCase()
            const match = libraryAssets.find(
              (a: { id: string; filename: string; route_description: string | null }) =>
                a.filename.toLowerCase().includes(lower) ||
                (a.route_description ?? '').toLowerCase().includes(lower)
            )
            if (match && !brollAssetIds.includes(match.id)) {
              brollAssetIds.push(match.id)
            }
          }
        }
      }
    }

    const result = await createVideo({
      script: scriptText,
      title: queueItem.title ?? `Video ${new Date().toISOString().slice(0, 10)}`,
      aspectRatio,
      channel,
      templateId: templateId || undefined,
      brandVoiceId: brandVoiceId || undefined,
      avatarId: avatarId || undefined,
      voiceId: voiceId || undefined,
    })

    if (result.error) {
      console.error('[Video generation] HeyGen error:', result.error)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    if (!result.videoId) {
      return NextResponse.json(
        { error: 'HeyGen did not return a video ID' },
        { status: 500 }
      )
    }

    const scriptSource = queueItem.source === 'drive_script' ? 'drive_script' : queueItem.source === 'manual' ? 'manual' : 'llm_generated'

    const { data: job, error: insertErr } = await supabaseAdmin
      .from('video_generation_jobs')
      .insert({
        script_source: scriptSource,
        script_text: scriptText,
        drive_file_id: null,
        drive_file_name: queueItem.title,
        avatar_id: avatarId ?? null,
        voice_id: voiceId ?? null,
        aspect_ratio: aspectRatio,
        channel,
        heygen_video_id: result.videoId,
        heygen_status: 'pending',
        broll_asset_ids: brollAssetIds.length > 0 ? brollAssetIds : null,
        created_by: auth.user?.id,
      })
      .select('id, heygen_video_id, heygen_status, created_at')
      .single()

    if (insertErr) {
      console.error('[Video generation] Insert error:', insertErr)
      return NextResponse.json(
        { error: 'Failed to create job record' },
        { status: 500 }
      )
    }

    const { error: updateErr } = await supabaseAdmin
      .from('video_ideas_queue')
      .update({
        status: 'generated',
        video_generation_job_id: job.id,
      })
      .eq('id', queueId)

    if (updateErr) {
      console.error('[Video generation] Ideas queue update error:', updateErr)
    }

    return NextResponse.json({
      jobId: job.id,
      heygenVideoId: job.heygen_video_id,
      status: job.heygen_status,
      createdAt: job.created_at,
      brollAssetIds: brollAssetIds.length > 0 ? brollAssetIds : undefined,
    })
  } catch (error) {
    console.error('[Video generation] Draft generate error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
