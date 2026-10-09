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
  const requestedJobIds = Array.isArray(body.jobIds) ? body.jobIds as string[] : []
  if (requestedJobIds.length > 20) {
    return NextResponse.json({ error: 'A maximum of 20 job IDs can be retried at once' }, { status: 400 })
  }
  const jobIds = requestedJobIds
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
  const reconciliation: Array<{
    job: string
    source_job_id: string
    provider_video_id: string
    replacement_persisted: boolean
    reason: 'replacement_insert_failed' | 'source_cleanup_failed'
  }> = []

  for (const job of jobs) {
    try {
      // A retry is a new asset. Campaign renders must re-enter the linked editorial gate.
      if (job.target_type === 'campaign' || job.script_source === 'campaign') {
        errors.push(`Job ${job.id.slice(0, 8)}: reopen the linked Social Content editorial review before a campaign retry.`)
        continue
      }
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

      // Persist the provider receipt before retiring the failed source job. If
      // either write fails, the response carries enough receipt data for an
      // operator to reconcile without issuing another provider request.
      const { error: insertError } = await supabaseAdmin.from('video_generation_jobs').insert({
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
      if (insertError) {
        errors.push(`Job ${job.id.slice(0, 8)}: provider receipt requires reconciliation because the replacement job was not persisted.`)
        const receipt = {
          job: job.id.slice(0, 8),
          source_job_id: job.id,
          provider_video_id: heygenResult.videoId,
          replacement_persisted: false,
          reason: 'replacement_insert_failed' as const,
        }
        reconciliation.push(receipt)
        console.error('[video-batch-retry] reconciliation required', receipt)
        continue
      }

      const { error: cleanupError } = await supabaseAdmin.from('video_generation_jobs')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', job.id)
      if (cleanupError) {
        errors.push(`Job ${job.id.slice(0, 8)}: provider receipt was persisted, but the failed source job still requires reconciliation.`)
        const receipt = {
          job: job.id.slice(0, 8),
          source_job_id: job.id,
          provider_video_id: heygenResult.videoId,
          replacement_persisted: true,
          reason: 'source_cleanup_failed' as const,
        }
        reconciliation.push(receipt)
        console.error('[video-batch-retry] reconciliation required', receipt)
        continue
      }

      retried++
    } catch (err) {
      errors.push(`Job ${job.id.slice(0, 8)}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return NextResponse.json({
    retried,
    failed: errors.length,
    errors: errors.length > 0 ? errors : undefined,
    reconciliation: reconciliation.length > 0 ? reconciliation : undefined,
    total: jobs.length,
  })
}
