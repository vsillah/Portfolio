import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { persistVideoCompletion, videoPlayback } from '@/lib/video-media-archive'
import { getVideoStatus } from '@/lib/heygen'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/video-generation/status?jobId=...
 *
 * Returns job status and HeyGen status. If completed, updates job and optionally creates videos row.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')?.trim()

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    const { data: job, error: jobErr } = await supabaseAdmin
      .from('video_generation_jobs')
      .select('id, heygen_video_id, heygen_status, video_url, video_share_url, video_record_id, script_text, channel, aspect_ratio, provider_video_url, deleted_at')
      .eq('id', jobId)
      .single()

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const heygenId = job.heygen_video_id
    if (!heygenId) {
      return NextResponse.json({
        jobId: job.id,
        status: job.heygen_status,
        videoUrl: null,
        videoRecordId: job.video_record_id,
        message: 'No HeyGen video ID yet',
      })
    }

    const statusResult = await getVideoStatus(heygenId)

    const newStatus = statusResult.status ?? job.heygen_status

    let videoRecordId = job.video_record_id
    let finalReference = job.video_url
    let archiveBlocker: string | null = null
    if (newStatus === 'completed') {
      const completion = await persistVideoCompletion(supabaseAdmin, job, statusResult.videoUrl || job.provider_video_url || job.video_url)
      videoRecordId = completion.videoRecordId
      finalReference = completion.reference
      archiveBlocker = completion.media_blocker
    } else if (newStatus !== job.heygen_status) {
      await supabaseAdmin.from('video_generation_jobs').update({ heygen_status: newStatus, error_message: statusResult.error || null }).eq('id', jobId)
    }
    const playback = await videoPlayback(supabaseAdmin, finalReference)

    return NextResponse.json({
      jobId: job.id,
      heygenVideoId: heygenId,
      status: newStatus,
      videoUrl: playback.playback_url,
      videoReference: finalReference,
      media_blocker: archiveBlocker || playback.media_blocker,
      videoShareUrl: job.video_share_url,
      videoRecordId,
      thumbnailUrl: statusResult.thumbnailUrl,
      duration: statusResult.duration,
      error: statusResult.error,
    })
  } catch (error) {
    console.error('[Video generation status] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Explicit archive recovery consumes stored provider input; it never refreshes HeyGen. */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await request.json().catch(() => ({}))
  if (!['archive', 'refresh_provider'].includes(body.action) || typeof body.jobId !== 'string') return NextResponse.json({ error: 'Choose a job for archive recovery.' }, { status: 400 })
  const { data: job, error } = await supabaseAdmin.from('video_generation_jobs').select('*').eq('id', body.jobId).is('deleted_at', null).single()
  if (error || !job || job.heygen_status !== 'completed') return NextResponse.json({ error: 'Completed job unavailable.' }, { status: 409 })
  if (body.action === 'refresh_provider') {
    if (!job.heygen_video_id) return NextResponse.json({ error: 'Provider video identity is missing.' }, { status: 409 })
    const provider = await getVideoStatus(job.heygen_video_id)
    if (!provider.videoUrl) return NextResponse.json({ error: 'Provider did not return a fresh media input.' }, { status: 409 })
    const saved = await supabaseAdmin.from('video_generation_jobs').update({ provider_video_url: provider.videoUrl }).eq('id', job.id)
    if (saved.error) return NextResponse.json({ error: 'Provider input could not be saved.' }, { status: 500 })
    return NextResponse.json({ refreshed: true, archived: false, message: 'Provider input refreshed. Recover the private archive next.' })
  }
  const result = await persistVideoCompletion(supabaseAdmin, job, job.provider_video_url || job.video_url)
  return NextResponse.json({ ...result, ...await videoPlayback(supabaseAdmin, result.reference) }, { status: result.media_blocker ? 409 : 200 })
}
