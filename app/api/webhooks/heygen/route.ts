/**
 * POST /api/webhooks/heygen
 * HeyGen webhook for avatar_video.success and avatar_video.fail.
 * Verify HMAC signature (HEYGEN_WEBHOOK_SECRET), update job idempotently, then run completion handlers.
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { runVideoCompletionHandlers } from '@/lib/video-completion-handlers'

export const dynamic = 'force-dynamic'

type HeyGenEventType = 'avatar_video.success' | 'avatar_video.fail'

interface HeyGenEventData {
  video_id?: string
  url?: string
  gif_download_url?: string
  video_share_page_url?: string
  folder_id?: string
  callback_id?: string
  thumbnail_url?: string
  error_message?: string
}

interface HeyGenWebhookPayload {
  event_type?: string
  event_data?: HeyGenEventData
}

function verifyHeyGenSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!secret || !signature) return false
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(rawBody, 'utf8')
  const computed = hmac.digest('hex')
  if (signature.length !== computed.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(computed, 'hex'))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.HEYGEN_WEBHOOK_SECRET
    if (!secret) {
      console.error('[HeyGen webhook] HEYGEN_WEBHOOK_SECRET is not set')
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const rawBody = await request.text()
    const signature = request.headers.get('signature') ?? request.headers.get('Signature') ?? null
    if (!verifyHeyGenSignature(rawBody, signature, secret)) {
      console.warn('[HeyGen webhook] Invalid or missing signature')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let payload: HeyGenWebhookPayload
    try {
      payload = JSON.parse(rawBody) as HeyGenWebhookPayload
    } catch {
      console.warn('[HeyGen webhook] Invalid JSON body')
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const eventType = payload.event_type as HeyGenEventType | undefined
    const eventData = payload.event_data

    if (
      eventType !== 'avatar_video.success' &&
      eventType !== 'avatar_video.fail'
    ) {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const videoId = eventData?.video_id?.trim()
    if (!videoId) {
      console.warn('[HeyGen webhook] Missing event_data.video_id')
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const { data: job, error: jobErr } = await supabaseAdmin
      .from('video_generation_jobs')
      .select('id, heygen_video_id, heygen_status, video_url, video_record_id, script_text, channel, aspect_ratio, thumbnail_url')
      .eq('heygen_video_id', videoId)
      .single()

    if (jobErr || !job) {
      console.warn('[HeyGen webhook] No job found for video_id:', videoId, jobErr?.message)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // Idempotency: only update if still pending or processing
    if (job.heygen_status === 'completed' || job.heygen_status === 'failed') {
      console.log('[HeyGen webhook] Job already terminal', job.id, job.heygen_status)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const isSuccess = eventType === 'avatar_video.success'
    const update: Record<string, unknown> = {
      heygen_status: isSuccess ? 'completed' : 'failed',
      updated_at: new Date().toISOString(),
    }
    if (eventData?.url) update.video_url = eventData.url
    if (eventData?.thumbnail_url) update.thumbnail_url = eventData.thumbnail_url
    if (!isSuccess && eventData?.error_message) update.error_message = eventData.error_message

    const { error: updateErr } = await supabaseAdmin
      .from('video_generation_jobs')
      .update(update)
      .eq('id', job.id)

    if (updateErr) {
      console.error('[HeyGen webhook] Failed to update job', job.id, updateErr)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    console.log('[HeyGen webhook] Job updated', job.id, 'video_id', videoId, 'status', update.heygen_status)

    let videoRecordId = job.video_record_id
    if (isSuccess && (eventData?.url ?? job.video_url) && !videoRecordId) {
      const finalVideoUrl = (eventData?.url ?? job.video_url) as string
      const thumbnailUrl = (eventData?.thumbnail_url ?? job.thumbnail_url) as string | null | undefined
      const { data: videoRow } = await supabaseAdmin
        .from('videos')
        .insert({
          title: `Generated video (${job.channel ?? 'youtube'})`,
          description: (job.script_text ?? '').slice(0, 200) || null,
          video_url: finalVideoUrl,
          thumbnail_url: thumbnailUrl ?? null,
          display_order: 0,
          is_published: false,
          video_generation_job_id: job.id,
        })
        .select('id')
        .single()

      if (videoRow?.id) {
        videoRecordId = videoRow.id
        await supabaseAdmin
          .from('video_generation_jobs')
          .update({
            video_record_id: videoRecordId,
            video_url: finalVideoUrl,
            thumbnail_url: thumbnailUrl ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)
      }
    }

    const updatedJob = {
      id: job.id,
      heygen_video_id: job.heygen_video_id,
      heygen_status: update.heygen_status as string,
      video_url: (update.video_url ?? job.video_url) as string | null,
      script_text: job.script_text,
      channel: job.channel,
      aspect_ratio: job.aspect_ratio,
    }
    try {
      await runVideoCompletionHandlers(updatedJob)
    } catch (handlerErr) {
      console.error('[HeyGen webhook] Completion handler error', job.id, handlerErr)
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('[HeyGen webhook] Error:', error)
    return NextResponse.json({ received: true }, { status: 200 })
  }
}
