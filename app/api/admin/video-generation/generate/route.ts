import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { createVideo } from '@/lib/heygen'
import { fetchVideoContextByEmail, fetchVideoContext } from '@/lib/video-context'
import { isOverVideoGenerationLimit } from '@/lib/video-generation-rate-limit'
import { channelToAspectRatio } from '@/lib/constants/video-channel'
import type { VideoChannel, VideoAspectRatio } from '@/lib/constants/video-channel'

export const dynamic = 'force-dynamic'

const SCRIPT_SOURCES = ['manual', 'drive_script', 'drive_broll', 'campaign'] as const
const TARGET_TYPES = ['client_project', 'lead', 'campaign'] as const

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
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

    const body = await request.json()

    const scriptSource = (body.scriptSource as string) || 'manual'
    if (!SCRIPT_SOURCES.includes(scriptSource as (typeof SCRIPT_SOURCES)[number])) {
      return NextResponse.json({ error: 'Invalid scriptSource' }, { status: 400 })
    }

    let scriptText = (body.scriptText as string)?.trim()
    const targetType = body.targetType as string | null
    const targetId = body.targetId as string | null
    const email = (body.email as string)?.trim().toLowerCase()
    const driveFileId = body.driveFileId as string | null
    const driveFileName = body.driveFileName as string | null

    const templateId = (body.templateId as string)?.trim() || process.env.HEYGEN_TEMPLATE_ID
    const brandVoiceId = (body.brandVoiceId as string)?.trim() || process.env.HEYGEN_BRAND_VOICE_ID
    const avatarId = (body.avatarId as string)?.trim() || process.env.HEYGEN_AVATAR_ID
    const voiceId = (body.voiceId as string)?.trim() || process.env.HEYGEN_VOICE_ID

    if (!templateId && (!avatarId || !voiceId)) {
      return NextResponse.json(
        {
          error:
            'Use template (HEYGEN_TEMPLATE_ID or templateId) or provide avatarId and voiceId (or set HEYGEN_AVATAR_ID, HEYGEN_VOICE_ID)',
        },
        { status: 400 }
      )
    }

    if (!scriptText) {
      if (email) {
        const ctx = await fetchVideoContextByEmail(email)
        if (ctx.found && ctx.project) {
          scriptText = buildScriptFromContext(ctx)
        }
      }
      if (targetType && targetId) {
        const ctx = await fetchVideoContext(targetType as 'client_project' | 'lead' | 'campaign', targetId)
        if (ctx.found) {
          scriptText = scriptText || buildScriptFromContext(ctx)
        }
      }
    }

    if (!scriptText) {
      return NextResponse.json({ error: 'scriptText is required or provide email/target for context' }, { status: 400 })
    }

    const HEYGEN_SCRIPT_MAX = 5000
    if (scriptText.length > HEYGEN_SCRIPT_MAX) {
      return NextResponse.json(
        {
          error: `Script exceeds HeyGen limit of ${HEYGEN_SCRIPT_MAX} characters (${scriptText.length}). Shorten or split into multiple videos.`,
        },
        { status: 400 }
      )
    }

    const channel = (body.channel as VideoChannel) || 'youtube'
    const aspectRatio = (body.aspectRatio as VideoAspectRatio) || channelToAspectRatio(channel)

    const result = await createVideo({
      script: scriptText,
      title: body.title ?? `Video ${new Date().toISOString().slice(0, 10)}`,
      aspectRatio,
      channel,
      templateId: templateId || undefined,
      brandVoiceId: brandVoiceId || undefined,
      avatarId: avatarId || undefined,
      voiceId: voiceId || undefined,
      caption: body.caption === true ? true : undefined,
      includeGif: body.includeGif === true ? true : undefined,
      folderId: typeof body.folderId === 'string' && body.folderId.trim() ? body.folderId.trim() : undefined,
      callbackUrl: typeof body.callbackUrl === 'string' && body.callbackUrl.trim() ? body.callbackUrl.trim() : undefined,
      enableSharing: body.enableSharing === true ? true : undefined,
    })

    if (result.error) {
      console.error('[Video generation] HeyGen error:', result.error)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    if (!result.videoId) {
      const msg = 'HeyGen did not return a video ID'
      console.error('[Video generation]', msg)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const { data: job, error: insertErr } = await supabaseAdmin
      .from('video_generation_jobs')
      .insert({
        script_source: scriptSource,
        script_text: scriptText,
        drive_file_id: driveFileId,
        drive_file_name: driveFileName,
        target_type: targetType,
        target_id: targetId,
        avatar_id: avatarId ?? null,
        voice_id: voiceId ?? null,
        aspect_ratio: aspectRatio,
        channel,
        heygen_video_id: result.videoId,
        heygen_status: 'pending',
        created_by: userId,
      })
      .select('id, heygen_video_id, heygen_status, created_at')
      .single()

    if (insertErr) {
      console.error('[Video generation] Insert error:', insertErr)
      return NextResponse.json({ error: 'Failed to create job record' }, { status: 500 })
    }

    return NextResponse.json({
      jobId: job.id,
      heygenVideoId: job.heygen_video_id,
      status: job.heygen_status,
      createdAt: job.created_at,
    })
  } catch (error) {
    console.error('[Video generation] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function buildScriptFromContext(ctx: { project?: { client_name?: string | null; client_company?: string | null } | null; diagnostic_audits?: Array<{ diagnostic_summary?: string | null }> }): string {
  const parts: string[] = []
  if (ctx.project?.client_name) {
    parts.push(`Hi ${ctx.project.client_name},`)
  }
  if (ctx.project?.client_company) {
    parts.push(`Thanks for your interest in working with ${ctx.project.client_company}.`)
  }
  const summary = ctx.diagnostic_audits?.[0]?.diagnostic_summary
  if (summary) {
    parts.push(`Based on our conversation: ${summary}`)
  }
  if (parts.length === 0) {
    parts.push('Thanks for reaching out. We look forward to connecting with you.')
  }
  return parts.join(' ')
}
