import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { getVideoStatus } from '@/lib/heygen'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/videos/refresh-url
 * Re-fetch a fresh video URL from HeyGen for a video record linked to a generation job.
 * Body: { videoId: number }
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const videoId = body.videoId
  if (!videoId) {
    return NextResponse.json({ error: 'videoId is required' }, { status: 400 })
  }

  const { data: video, error: videoErr } = await supabaseAdmin
    .from('videos')
    .select('id, video_url, video_generation_job_id')
    .eq('id', videoId)
    .single()

  if (videoErr || !video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  if (!video.video_generation_job_id) {
    return NextResponse.json({ error: 'Video is not linked to a generation job' }, { status: 400 })
  }

  const { data: job, error: jobErr } = await supabaseAdmin
    .from('video_generation_jobs')
    .select('heygen_video_id')
    .eq('id', video.video_generation_job_id)
    .single()

  if (jobErr || !job?.heygen_video_id) {
    return NextResponse.json({ error: 'No HeyGen video ID found for this job' }, { status: 400 })
  }

  const statusResult = await getVideoStatus(job.heygen_video_id)
  if (statusResult.error) {
    return NextResponse.json({ error: statusResult.error }, { status: 502 })
  }

  const freshUrl = statusResult.videoUrl
  if (freshUrl && freshUrl !== video.video_url) {
    await supabaseAdmin
      .from('videos')
      .update({ video_url: freshUrl, updated_at: new Date().toISOString() })
      .eq('id', videoId)

    await supabaseAdmin
      .from('video_generation_jobs')
      .update({ video_url: freshUrl, updated_at: new Date().toISOString() })
      .eq('id', video.video_generation_job_id)
  }

  return NextResponse.json({
    videoId,
    videoUrl: freshUrl ?? video.video_url,
    refreshed: freshUrl !== video.video_url,
  })
}
