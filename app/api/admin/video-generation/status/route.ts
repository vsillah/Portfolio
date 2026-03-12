import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
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
      .select('id, heygen_video_id, heygen_status, video_url, video_record_id, script_text, channel, aspect_ratio')
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
        videoUrl: job.video_url,
        videoRecordId: job.video_record_id,
        message: 'No HeyGen video ID yet',
      })
    }

    const statusResult = await getVideoStatus(heygenId)

    const newStatus = statusResult.status ?? job.heygen_status
    const newVideoUrl = statusResult.videoUrl ?? job.video_url

    if (newStatus !== job.heygen_status || newVideoUrl !== job.video_url) {
      const update: Record<string, unknown> = {
        heygen_status: newStatus,
        updated_at: new Date().toISOString(),
      }
      if (statusResult.error) {
        update.error_message = statusResult.error
      }
      if (newVideoUrl) {
        update.video_url = newVideoUrl
      }
      await supabaseAdmin.from('video_generation_jobs').update(update).eq('id', jobId)
    }

    let videoRecordId = job.video_record_id
    if (newStatus === 'completed' && newVideoUrl && !videoRecordId) {
      const { data: videoRow } = await supabaseAdmin
        .from('videos')
        .insert({
          title: `Generated video (${job.channel ?? 'youtube'})`,
          description: job.script_text?.slice(0, 200) ?? null,
          video_url: newVideoUrl,
          display_order: 0,
          is_published: false,
          video_generation_job_id: jobId,
        })
        .select('id')
        .single()

      if (videoRow?.id) {
        videoRecordId = videoRow.id
        await supabaseAdmin
          .from('video_generation_jobs')
          .update({ video_record_id: videoRecordId, updated_at: new Date().toISOString() })
          .eq('id', jobId)
      }
    }

    return NextResponse.json({
      jobId: job.id,
      heygenVideoId: heygenId,
      status: newStatus,
      videoUrl: newVideoUrl,
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
