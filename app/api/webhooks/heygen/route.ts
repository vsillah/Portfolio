/**
 * POST /api/webhooks/heygen
 * HeyGen webhook for avatar_video.success and avatar_video.fail.
 * Verify HMAC signature (HEYGEN_WEBHOOK_SECRET), update job idempotently, then run completion handlers.
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { persistVideoCompletion } from '@/lib/video-media-archive'

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
      .select('id, heygen_video_id, heygen_status, video_url, video_record_id, script_text, channel, aspect_ratio, thumbnail_url, provider_video_url, deleted_at')
      .eq('heygen_video_id', videoId)
      .single()

    if (jobErr || !job) {
      console.warn('[HeyGen webhook] No job found for video_id:', videoId, jobErr?.message)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    if (job.deleted_at) return NextResponse.json({ received: true })
    if (eventType === 'avatar_video.success') {
      // Repeated success receipts may repair an incomplete archive; the helper owns idempotency.
      const result = await persistVideoCompletion(supabaseAdmin, job, eventData?.url || job.provider_video_url || job.video_url)
      return NextResponse.json({ received: true, archive_ready: !result.media_blocker })
    }
    if (job.heygen_status !== 'completed') {
      await supabaseAdmin.from('video_generation_jobs').update({ heygen_status: 'failed', error_message: eventData?.error_message || 'Provider render failed' }).eq('id', job.id)
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('[HeyGen webhook] Error:', error)
    return NextResponse.json({ received: true }, { status: 200 })
  }
}
