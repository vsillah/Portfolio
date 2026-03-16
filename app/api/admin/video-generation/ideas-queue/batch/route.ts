/**
 * POST /api/admin/video-generation/ideas-queue/batch
 * Generate video for the next N pending ideas from the queue (sequential).
 * Body: { limit?: number } (cap 2-5). Feature flag: VIDEO_IDEAS_QUEUE_BATCH_ENABLED.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { createVideo } from '@/lib/heygen'
import { isOverVideoGenerationLimit } from '@/lib/video-generation-rate-limit'
import { channelToAspectRatio } from '@/lib/constants/video-channel'
import type { VideoChannel, VideoAspectRatio } from '@/lib/constants/video-channel'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MIN_LIMIT = 1
const MAX_LIMIT = 5

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    if (process.env.VIDEO_IDEAS_QUEUE_BATCH_ENABLED === 'false') {
      return NextResponse.json(
        { error: 'Ideas queue batch is not available.' },
        { status: 403 }
      )
    }

    const userId = auth.user?.id
    if (userId) {
      const overLimit = await isOverVideoGenerationLimit(userId)
      if (overLimit) {
        return NextResponse.json(
          { error: 'Daily video generation limit reached. Please try again tomorrow.' },
          { status: 429 }
        )
      }
    }

    const body = await request.json().catch(() => ({}))

    // Accept either { items: [...] } (new) or { limit } (legacy)
    const itemsPayload = Array.isArray(body.items) ? body.items as Array<{ id: string; brollAssetIds?: string[] }> : null

    const templateId =
      (body.templateId as string)?.trim() || process.env.HEYGEN_TEMPLATE_ID
    const brandVoiceId =
      (body.brandVoiceId as string)?.trim() || process.env.HEYGEN_BRAND_VOICE_ID
    const avatarId =
      (body.avatarId as string)?.trim() || process.env.HEYGEN_AVATAR_ID
    const voiceId =
      (body.voiceId as string)?.trim() || process.env.HEYGEN_VOICE_ID
    if (!templateId && (!avatarId || !voiceId)) {
      return NextResponse.json(
        { error: 'HeyGen template or avatar and voice must be configured.' },
        { status: 500 }
      )
    }

    const channel: VideoChannel = (body.channel as VideoChannel) ?? 'youtube'
    const aspectRatio: VideoAspectRatio =
      (body.aspectRatio as VideoAspectRatio) ?? channelToAspectRatio(channel)

    let ideas: Array<{ id: string; title: string | null; script_text: string | null }> | null = null
    let brollMap: Record<string, string[]> = {}

    if (itemsPayload && itemsPayload.length > 0) {
      const ids = itemsPayload.slice(0, MAX_LIMIT).map(i => i.id)
      const { data, error: fetchErr } = await supabaseAdmin
        .from('video_ideas_queue')
        .select('id, title, script_text')
        .in('id', ids)
        .eq('status', 'pending')

      if (fetchErr) {
        console.error('[Ideas queue batch] Fetch error:', fetchErr)
        return NextResponse.json({ error: 'Failed to load queue' }, { status: 500 })
      }
      ideas = data

      for (const item of itemsPayload) {
        if (Array.isArray(item.brollAssetIds)) {
          brollMap[item.id] = item.brollAssetIds
        }
      }
    } else {
      const limit = Math.min(
        Math.max(Number(body.limit) || 2, MIN_LIMIT),
        MAX_LIMIT
      )
      const { data, error: fetchErr } = await supabaseAdmin
        .from('video_ideas_queue')
        .select('id, title, script_text')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(limit)

      if (fetchErr) {
        console.error('[Ideas queue batch] Fetch error:', fetchErr)
        return NextResponse.json({ error: 'Failed to load queue' }, { status: 500 })
      }
      ideas = data
    }

    if (!ideas?.length) {
      return NextResponse.json({
        started: 0,
        jobs: [],
        message: 'No pending ideas in queue.',
      })
    }

    const jobs: { ideaId: string; jobId: string; heygenVideoId: string }[] = []

    for (const idea of ideas) {
      const scriptText = (idea.script_text ?? '').trim()
      if (!scriptText) continue
      if (scriptText.length > 5000) {
        console.warn('[Ideas queue batch] Skipping idea (script too long)', idea.id)
        continue
      }

      const result = await createVideo({
        script: scriptText,
        title: idea.title ?? `Video ${new Date().toISOString().slice(0, 10)}`,
        aspectRatio,
        channel,
        templateId: templateId || undefined,
        brandVoiceId: brandVoiceId || undefined,
        avatarId: avatarId || undefined,
        voiceId: voiceId || undefined,
      })

      if (result.error || !result.videoId) {
        console.error('[Ideas queue batch] HeyGen error for idea', idea.id, result.error)
        continue
      }

      const itemBroll = brollMap[idea.id] ?? []
      const { data: job, error: insertErr } = await supabaseAdmin
        .from('video_generation_jobs')
        .insert({
          script_source: 'llm_generated',
          script_text: scriptText,
          drive_file_id: null,
          drive_file_name: idea.title,
          avatar_id: avatarId ?? '',
          voice_id: voiceId ?? '',
          aspect_ratio: aspectRatio,
          channel,
          heygen_video_id: result.videoId,
          heygen_status: 'pending',
          broll_asset_ids: itemBroll.length > 0 ? itemBroll : null,
          created_by: userId,
        })
        .select('id, heygen_video_id')
        .single()

      if (insertErr) {
        console.error('[Ideas queue batch] Insert job error', insertErr)
        continue
      }

      await supabaseAdmin
        .from('video_ideas_queue')
        .update({
          status: 'generated',
          video_generation_job_id: job.id,
        })
        .eq('id', idea.id)

      jobs.push({
        ideaId: idea.id,
        jobId: job.id,
        heygenVideoId: job.heygen_video_id ?? result.videoId,
      })
    }

    return NextResponse.json({
      started: jobs.length,
      jobs,
      message:
        jobs.length === 0
          ? 'No jobs started (check script length or HeyGen errors).'
          : `${jobs.length} video job(s) started.`,
    })
  } catch (error) {
    console.error('[Ideas queue batch] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
