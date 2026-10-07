import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { archiveId, archiveReference, classifyVideoUrl, VIDEO_ARCHIVE_BUCKET, VIDEO_MEDIA_RECOVERY } from './video-media-url'
const MAX_BYTES = 100 * 1024 * 1024
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
type Job = { id: string; heygen_video_id?: string | null; video_url?: string | null; provider_video_url?: string | null; video_record_id?: number | null; script_text?: string | null; channel?: string | null; deleted_at?: string | null }
type Archive = { id: string; job_id: string; provider_video_id: string; bucket: string; object_path: string; sha256: string; byte_length: number; source_host: string; status: string }
function expectedPath(row: Pick<Archive, 'job_id' | 'provider_video_id' | 'sha256'>) { return `${row.job_id}/${createHash('sha256').update(row.provider_video_id).digest('hex')}/${row.sha256}.mp4` }
function validateArchive(row: Archive) {
  if (row.bucket !== VIDEO_ARCHIVE_BUCKET || !/^[a-f0-9]{64}$/.test(row.sha256) || row.object_path !== expectedPath(row)) throw new Error('Archive identity is invalid.')
}
async function providerBytes(url: string, fetcher: typeof fetch): Promise<Buffer> {
  const classification = classifyVideoUrl(url)
  const parsed = new URL(url)
  if (classification.expired || !/(^|\.)heygen\.(ai|com)$/.test(parsed.hostname) || classification.kind !== 'provider_temporary') throw new Error('A fresh HeyGen media URL is required. Refresh the provider link first.')
  const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(60_000) })
  if (!response.ok || !/^video\/mp4(?:;|$)/i.test(response.headers.get('content-type') || '') || Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Provider MP4 is unavailable or exceeds the 100 MiB archive limit.')
  if (!response.body) throw new Error('Provider MP4 has no body.')
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > MAX_BYTES) throw new Error('Provider MP4 exceeds the 100 MiB archive limit.'); chunks.push(value) }
  } catch (error) { await reader.cancel(); throw error }
  const bytes = Buffer.concat(chunks)
  if (bytes.length < 12 || bytes.toString('ascii', 4, 8) !== 'ftyp') throw new Error('Provider response is not an MP4.')
  return bytes
}
async function existingBytes(admin: SupabaseClient, row: Archive): Promise<Buffer | null> {
  validateArchive(row)
  const result = await admin.storage.from(VIDEO_ARCHIVE_BUCKET).download(row.object_path)
  if (result.error) {
    const code = (result.error as { statusCode?: string; status?: number }).statusCode || (result.error as { status?: number }).status
    if (String(code) === '404' || String(code) === '400' && /not found/i.test(result.error.message)) return null
    throw new Error('Private archive storage could not be verified.')
  }
  if (!result.data || result.data.size !== Number(row.byte_length) || result.data.size > MAX_BYTES) throw new Error('Private archive size differs from its receipt.')
  const bytes = Buffer.from(await result.data.arrayBuffer())
  if (digest(bytes) !== row.sha256) throw new Error('Private archive checksum differs from its receipt.')
  return bytes
}
/** All completion entry points converge here. Content-addressed objects + unique archive/video keys make retries idempotent. */
export async function archiveCompletedVideo(admin: SupabaseClient, job: Job, sourceUrl: string, fetcher: typeof fetch = fetch): Promise<Archive> {
  if (!job.heygen_video_id || job.deleted_at) throw new Error('An available provider job is required.')
  const read = () => admin.from('video_media_archives').select('*').eq('job_id', job.id).eq('provider_video_id', job.heygen_video_id!).maybeSingle()
  const first = await read(); if (first.error) throw new Error('Private archive schema is unavailable. Captain migration verification is required.')
  let row = first.data as Archive | null
  if (row?.status === 'ready') { validateArchive(row); return row }
  let bytes: Buffer | null = row ? await existingBytes(admin, row) : null
  if (!bytes) bytes = await providerBytes(sourceUrl, fetcher)
  const sha256 = digest(bytes)
  if (!row) {
    const seed = { job_id: job.id, provider_video_id: job.heygen_video_id, sha256, byte_length: bytes.length, bucket: VIDEO_ARCHIVE_BUCKET, source_host: new URL(sourceUrl).hostname, status: 'pending', object_path: expectedPath({ job_id: job.id, provider_video_id: job.heygen_video_id, sha256 }) }
    const inserted = await admin.from('video_media_archives').upsert(seed, { onConflict: 'job_id,provider_video_id', ignoreDuplicates: true })
    if (inserted.error) throw new Error('Archive receipt could not be persisted.')
    const reread = await read(); if (reread.error || !reread.data) throw new Error('Archive receipt could not be confirmed.')
    row = reread.data as Archive
  }
  validateArchive(row)
  if (row.sha256 !== sha256 || Number(row.byte_length) !== bytes.length) throw new Error('Provider media changed for this job. Preserve the existing archive and reconcile the version.')
  if (row.status !== 'ready') {
    const upload = await admin.storage.from(VIDEO_ARCHIVE_BUCKET).upload(row.object_path, bytes, { contentType: 'video/mp4', upsert: false })
    if (upload.error && !await existingBytes(admin, row)) throw new Error('Private MP4 upload was not confirmed. Retry archive recovery.')
    const saved = await admin.from('video_media_archives').update({ status: 'ready', archived_at: new Date().toISOString() }).eq('id', row.id).eq('sha256', sha256).select('*').single()
    if (saved.error || !saved.data) throw new Error('Private archive completion receipt was not confirmed.')
    row = saved.data as Archive
  }
  return row
}
export async function completeGeneratedVideo(admin: SupabaseClient, job: Job, sourceUrl: string, fetcher: typeof fetch = fetch) {
  const archive = await archiveCompletedVideo(admin, job, sourceUrl, fetcher)
  const ref = archiveReference(archive.id)
  // Existing legacy record is adopted; a new record is unique by archive ID on all retries.
  let videoId = job.video_record_id
  if (videoId) {
    const saved = await admin.from('videos').update({ video_url: ref, media_archive_id: archive.id }).eq('id', videoId).eq('video_generation_job_id', job.id).select('id').maybeSingle()
    if (saved.error || !saved.data) throw new Error('Existing video record requires archive reconciliation.')
  } else {
    const saved = await admin.from('videos').upsert({ title: `Generated video (${job.channel ?? 'youtube'})`, description: job.script_text?.slice(0, 200) || null, video_url: ref, display_order: 0, is_published: false, video_generation_job_id: job.id, media_archive_id: archive.id }, { onConflict: 'media_archive_id', ignoreDuplicates: true })
    if (saved.error) throw new Error('Archived video record could not be saved.')
    const readback = await admin.from('videos').select('id').eq('media_archive_id', archive.id).single()
    if (readback.error || !readback.data) throw new Error('Archived video record could not be confirmed.')
    videoId = readback.data.id
  }
  const saved = await admin.from('video_generation_jobs').update({ heygen_status: 'completed', video_url: ref, provider_video_url: sourceUrl.startsWith('https://') ? sourceUrl : job.provider_video_url || null, video_record_id: videoId, error_message: null }).eq('id', job.id).eq('heygen_video_id', job.heygen_video_id).is('deleted_at', null).select('id').maybeSingle()
  if (saved.error || !saved.data) throw new Error('Job changed before archive linkage. Reload before recovery.')
  return { reference: ref, videoRecordId: videoId, sha256: archive.sha256 }
}
export async function videoPlayback(admin: SupabaseClient, value: unknown) {
  const id = archiveId(value)
  const blocked = (reason: string) => ({ playback_url: null, media_version: null, media_blocker: reason, media_recovery: VIDEO_MEDIA_RECOVERY })
  if (!id) return blocked(classifyVideoUrl(value).reason || 'Private archive is required.')
  const result = await admin.from('video_media_archives').select('*').eq('id', id).eq('status', 'ready').maybeSingle()
  if (result.error || !result.data) return blocked('Private archive is unavailable. Captain storage verification or archive recovery is required.')
  try {
    const row = result.data as Archive; validateArchive(row)
    const job = await admin.from('video_generation_jobs').select('id,heygen_video_id,deleted_at').eq('id', row.job_id).single()
    if (job.error || !job.data || job.data.deleted_at || job.data.heygen_video_id !== row.provider_video_id) return blocked('Archived job is no longer available.')
    const signed = await admin.storage.from(VIDEO_ARCHIVE_BUCKET).createSignedUrl(row.object_path, 300)
    if (signed.error || !signed.data?.signedUrl) return blocked('Private playback link could not be issued. Reload to retry.')
    return { playback_url: signed.data.signedUrl, media_version: row.sha256, media_blocker: null, media_recovery: null }
  } catch { return blocked('Archive identity could not be verified.') }
}
/** Provider completion may succeed while archival is blocked. Never save the temporary URL as final media. */
export async function persistVideoCompletion(admin: SupabaseClient, job: Job, sourceUrl: string | null, fetcher: typeof fetch = fetch) {
  try { return { ...await completeGeneratedVideo(admin, job, sourceUrl || '', fetcher), media_blocker: null } }
  catch (error) {
    // Do not expose signed provider URLs or transport errors in UI/logs.
    const reason = error instanceof Error && !/https?:|token|signature/i.test(error.message) ? error.message : 'Private archive failed. Refresh the provider input or retry archive recovery.'
    const saved = await admin.from('video_generation_jobs').update({ heygen_status: 'completed', provider_video_url: sourceUrl, error_message: reason }).eq('id', job.id).eq('heygen_video_id', job.heygen_video_id)
    if (saved.error) throw new Error('Archive failure state could not be saved.')
    return { reference: archiveId(job.video_url) ? job.video_url : null, videoRecordId: job.video_record_id, sha256: null, media_blocker: reason }
  }
}
