/**
 * Video completion handlers — extension point for when a HeyGen video job completes.
 * Called from the HeyGen webhook after idempotent job update.
 * Drive upload and n8n notify behind env flags; fire-and-forget, do not throw.
 */

export interface VideoCompletionJob {
  id: string
  heygen_video_id: string | null
  heygen_status: string | null
  video_url: string | null
  script_text?: string | null
  channel?: string | null
  aspect_ratio?: string | null
}

/**
 * Run optional post-completion handlers (Drive upload, n8n notify).
 * Fire-and-forget; do not throw. Failures are logged only.
 */
export async function runVideoCompletionHandlers(job: VideoCompletionJob): Promise<void> {
  if (job.heygen_status !== 'completed' || !job.video_url) {
    return
  }

  const n8nUrl = process.env.HEYGEN_VIDEO_N8N_WEBHOOK_URL
  if (n8nUrl?.trim()) {
    runN8nNotify(job, n8nUrl.trim()).catch((err) =>
      console.error('[Video completion] n8n notify error', job.id, err)
    )
  }

  const driveEnabled = process.env.HEYGEN_VIDEO_UPLOAD_TO_DRIVE_ENABLED === 'true'
  const folderId = process.env.GOOGLE_DRIVE_VIDEOS_FOLDER_ID?.trim()
  if (driveEnabled && folderId) {
    runDriveUpload(job, folderId).catch((err) =>
      console.error('[Video completion] Drive upload error', job.id, err)
    )
  }
}

async function runN8nNotify(job: VideoCompletionJob, webhookUrl: string): Promise<void> {
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId: job.id,
      videoUrl: job.video_url,
      videoId: job.heygen_video_id,
    }),
  })
}

async function runDriveUpload(job: VideoCompletionJob, folderId: string): Promise<void> {
  try {
    const { uploadVideoUrlToFolder } = await import('@/lib/google-drive')
    const fileName = `heygen-${job.heygen_video_id ?? job.id}.mp4`
    await uploadVideoUrlToFolder(job.video_url!, folderId, fileName)
  } catch (err) {
    console.error('[Video completion] Drive upload failed', job.id, err)
    throw err
  }
}
