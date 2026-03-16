import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { createVideo } from '@/lib/heygen'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/video-generation/jobs/batch-retry
 * Re-submit failed jobs to HeyGen. Creates new job records with the same settings.
 * Body: { jobIds: string[] }
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const jobIds = Array.isArray(body.jobIds) ? (body.jobIds as string[]).slice(0, 20) : []
  if (jobIds.length === 0) {
    return NextResponse.json({ error: 'No job IDs provided' }, { status: 400 })
  }

  const { data: jobs, error } = await supabaseAdmin
    .from('video_generation_jobs')
    .select('id, script_source, script_text, drive_file_name, target_type, target_id, avatar_id, voice_id, aspect_ratio, channel, broll_asset_ids')
    .in('id', jobIds)
    .eq('heygen_status', 'failed')
    .is('deleted_at', null)

  if (error || !jobs) {
    return NextResponse.json({ error: 'Failed to fetch failed jobs' }, { status: 500 })
  }

  if (jobs.length === 0) {
    return NextResponse.json({ error: 'No failed jobs found among the provided IDs' }, { status: 400 })
  }

  let retried = 0
  const errors: string[] = []

  for (const job of jobs) {
    try {
      const heygenResult = await createVideo({
        script: job.script_text,
        avatarId: job.avatar_id ?? undefined,
        voiceId: job.voice_id ?? undefined,
        aspectRatio: (job.aspect_ratio as '16:9' | '9:16') ?? '16:9',
      })

      if (heygenResult.error || !heygenResult.videoId) {
        errors.push(`Job ${job.id.slice(0, 8)}: ${heygenResult.error ?? 'No video ID returned'}`)
        continue
      }

      // Soft-delete the old failed job
      await supabaseAdmin.from('video_generation_jobs')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', job.id)

      // Create new job record
      await supabaseAdmin.from('video_generation_jobs').insert({
        script_source: job.script_source,
        script_text: job.script_text,
        drive_file_name: job.drive_file_name,
        target_type: job.target_type,
        target_id: job.target_id,
        avatar_id: job.avatar_id,
        voice_id: job.voice_id,
        aspect_ratio: job.aspect_ratio,
        channel: job.channel,
        broll_asset_ids: job.broll_asset_ids,
        heygen_video_id: heygenResult.videoId,
        heygen_status: 'pending',
      })

      retried++
    } catch (err) {
      errors.push(`Job ${job.id.slice(0, 8)}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return NextResponse.json({
    retried,
    failed: errors.length,
    errors: errors.length > 0 ? errors : undefined,
    total: jobs.length,
  })
}
