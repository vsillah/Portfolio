import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { getVideoStatus } from '@/lib/heygen'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/video-generation/jobs/batch-refresh
 * Refresh HeyGen status for multiple jobs at once.
 * Body: { jobIds: string[] }
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const jobIds = Array.isArray(body.jobIds) ? (body.jobIds as string[]).slice(0, 50) : []
  if (jobIds.length === 0) {
    return NextResponse.json({ error: 'No job IDs provided' }, { status: 400 })
  }

  const { data: jobs, error } = await supabaseAdmin
    .from('video_generation_jobs')
    .select('id, heygen_video_id, heygen_status, video_url, video_record_id, script_text, channel')
    .in('id', jobIds)
    .is('deleted_at', null)

  if (error || !jobs) {
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
  }

  let refreshed = 0
  let updated = 0
  for (const job of jobs) {
    if (!job.heygen_video_id) continue
    try {
      const statusResult = await getVideoStatus(job.heygen_video_id)
      refreshed++
      const newStatus = statusResult.status ?? job.heygen_status
      const newVideoUrl = statusResult.videoUrl ?? job.video_url
      if (newStatus !== job.heygen_status || newVideoUrl !== job.video_url) {
        const updateData: Record<string, unknown> = {
          heygen_status: newStatus,
          updated_at: new Date().toISOString(),
        }
        if (statusResult.error) updateData.error_message = statusResult.error
        if (newVideoUrl) updateData.video_url = newVideoUrl
        await supabaseAdmin.from('video_generation_jobs').update(updateData).eq('id', job.id)
        updated++

        if (newStatus === 'completed' && newVideoUrl && !job.video_record_id) {
          const { data: videoRow } = await supabaseAdmin
            .from('videos')
            .insert({
              title: `Generated video (${job.channel ?? 'youtube'})`,
              description: job.script_text?.slice(0, 200) ?? null,
              video_url: newVideoUrl,
              display_order: 0,
              is_published: false,
              video_generation_job_id: job.id,
            })
            .select('id')
            .single()
          if (videoRow?.id) {
            await supabaseAdmin.from('video_generation_jobs')
              .update({ video_record_id: videoRow.id, updated_at: new Date().toISOString() })
              .eq('id', job.id)
          }
        }
      }
    } catch {
      // Non-fatal per job
    }
  }

  return NextResponse.json({ refreshed, updated, total: jobs.length })
}
