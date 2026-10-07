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
  if (!freshUrl) return NextResponse.json({ error: 'Provider did not return a fresh media URL.' }, { status: 409 })
  const saved = await supabaseAdmin.from('video_generation_jobs').update({ provider_video_url: freshUrl }).eq('id', video.video_generation_job_id)
  if (saved.error) return NextResponse.json({ error: 'Fresh provider input could not be saved.' }, { status: 500 })
  return NextResponse.json({ videoId, refreshed: true, archived: false, videoUrl: null, message: 'Provider input refreshed. Recover the private archive in Video Generation before review.' })
}
