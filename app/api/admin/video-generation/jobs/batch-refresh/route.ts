import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { persistVideoCompletion } from '@/lib/video-media-archive'
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
    .select('id, heygen_video_id, heygen_status, video_url, video_record_id, script_text, channel, provider_video_url, deleted_at, thumbnail_url, video_share_url')
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
      if (newStatus === 'completed') {
        const result = await persistVideoCompletion(supabaseAdmin, { ...job, thumbnail_url: statusResult.thumbnailUrl || job.thumbnail_url, video_share_url: statusResult.videoShareUrl || job.video_share_url }, statusResult.videoUrl || job.provider_video_url || job.video_url)
        if (!result.media_blocker) updated++
      } else if (newStatus !== job.heygen_status) {
        await supabaseAdmin.from('video_generation_jobs').update({ heygen_status: newStatus, error_message: statusResult.error || null }).eq('id', job.id)
        updated++
      }
    } catch {
      // Non-fatal per job
    }
  }

  return NextResponse.json({ refreshed, updated, total: jobs.length })
}
