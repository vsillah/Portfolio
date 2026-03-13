/**
 * POST /api/admin/video-generation/ideas-queue/[id]/generate
 * Create a video generation job from an ideas queue item.
 * Runs B-roll capture (using storyboard brollHint or script keywords) + HeyGen avatar.
 */

import * as path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { createVideo } from '@/lib/heygen'
import { channelToAspectRatio } from '@/lib/constants/video-channel'
import type { VideoChannel, VideoAspectRatio } from '@/lib/constants/video-channel'
import {
  captureBroll,
  DEFAULT_ROUTES,
  selectRoutesFromScript,
} from '@/lib/playtest-broll'
import { videoSlugFromFileName } from '@/lib/video-slug'

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
    const avatarId =
      (body.avatarId as string)?.trim() || process.env.HEYGEN_AVATAR_ID
    const voiceId =
      (body.voiceId as string)?.trim() || process.env.HEYGEN_VOICE_ID
    const includeBroll = body.includeBroll !== false
    const brollRoutes = (body.brollRoutes as 'all' | 'script') ?? 'script'

    const { data: queueItem, error: fetchErr } = await supabaseAdmin
      .from('video_ideas_queue')
      .select('id, title, script_text, storyboard_json, status')
      .eq('id', queueId)
      .single()

    if (fetchErr || !queueItem) {
      return NextResponse.json(
        { error: 'Ideas queue item not found' },
        { status: 404 }
      )
    }
    if (queueItem.status !== 'pending') {
      return NextResponse.json(
        { error: `Ideas queue item already ${queueItem.status}` },
        { status: 400 }
      )
    }

    const scriptText = (queueItem.script_text ?? '').trim()
    if (!scriptText) {
      return NextResponse.json(
        { error: 'Ideas queue item has no script text' },
        { status: 400 }
      )
    }

    if (!templateId && (!avatarId || !voiceId)) {
      return NextResponse.json(
        {
          error:
            'Use template (HEYGEN_TEMPLATE_ID or templateId) or provide avatarId and voiceId (or set HEYGEN_AVATAR_ID, HEYGEN_VOICE_ID)',
        },
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

    let brollOutputPath: string | undefined
    if (includeBroll && queueItem.title) {
      try {
        const slug = videoSlugFromFileName(queueItem.title)
        const brollDir = path.join(
          process.cwd(),
          'design-files',
          'broll',
          slug,
          'B-roll'
        )
        const storyboard = queueItem.storyboard_json as
          | { scenes?: StoryboardScene[] }
          | null
        const brollHints =
          storyboard?.scenes
            ?.map((s) => s.brollHint)
            .filter(Boolean)
            .join(' ') ?? ''
        const scriptWithHints = brollHints
          ? `${scriptText} ${brollHints}`
          : scriptText
        const routes =
          brollRoutes === 'script'
            ? selectRoutesFromScript(scriptWithHints, DEFAULT_ROUTES)
            : DEFAULT_ROUTES
        const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
        const result = await captureBroll({
          routes,
          outputDir: brollDir,
          recordVideos: true,
          baseUrl,
          noStartServer: true,
        })
        brollOutputPath = result.outputDir
      } catch (brollErr) {
        console.warn(
          '[Video generation] B-roll capture failed (continuing with HeyGen):',
          brollErr
        )
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

    const { data: job, error: insertErr } = await supabaseAdmin
      .from('video_generation_jobs')
      .insert({
        script_source: 'llm_generated',
        script_text: scriptText,
        drive_file_id: null,
        drive_file_name: queueItem.title,
        avatar_id: avatarId ?? null,
        voice_id: voiceId ?? null,
        aspect_ratio: aspectRatio,
        channel,
        heygen_video_id: result.videoId,
        heygen_status: 'pending',
        broll_output_path: brollOutputPath ?? null,
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
      brollOutputPath: brollOutputPath ?? undefined,
    })
  } catch (error) {
    console.error('[Video generation] Ideas queue generate error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
