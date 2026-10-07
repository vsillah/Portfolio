import { describe, it, expect, vi } from 'vitest'
import { archiveReference, classifyVideoUrl } from './video-media-url'
import { archiveCompletedVideo, completeGeneratedVideo, persistVideoCompletion, videoPlayback } from './video-media-archive'
import { socialVideoAssetVersion, socialVideoReviewReady } from './social-video-review'
import { prepareVideoAttachment, prepareMediaReview } from './social-campaign-review-handoff'
const bytes = Buffer.from('0000ftypisomsynthetic-mp4')
const fresh = 'https://files2.heygen.ai/video.mp4?Expires=4102444800&Signature=fixture'
const expired = 'https://files2.heygen.ai/video.mp4?Expires=1710000000&Signature=fixture'
function store() {
  const rows: Record<string, any[]> = { video_media_archives: [], videos: [], video_generation_jobs: [{ id: '11111111-1111-4111-8111-111111111111', heygen_video_id: 'provider-1', heygen_status: 'completed', deleted_at: null }] }
  const objects = new Map<string, Buffer>()
  let failReady = false
  let failUpdateTable: string | null = null
  let storageStatus: string | null = null
  const storage = { upload: vi.fn(async (path: string, data: Buffer) => { if (objects.has(path)) return { error: { statusCode: '409' } }; objects.set(path, data); return { error: null } }), download: vi.fn(async (path: string) => {
    if (storageStatus) { const code = storageStatus; storageStatus = null; return { error: { statusCode: code, message: 'https://storage.example/secret?token=leak' } } }
    return objects.has(path) ? { data: { size: objects.get(path)!.length, arrayBuffer: async () => objects.get(path)! } } : { error: { statusCode: '404' } }
  }), createSignedUrl: vi.fn(async (path: string, ttl: number) => ({ data: { signedUrl: `https://storage.example.invalid/${path}?token=fresh-${ttl}` } })) }
  const admin: any = { storage: { from: vi.fn(() => storage) }, from(table: string) {
    const filters: Array<(r: any) => boolean> = []; let patch: any, seed: any, options: any, one = false
    const q: any = { select: () => q, eq: (k: string, v: any) => { filters.push(r => r[k] === v); return q }, is: (k: string, v: any) => { filters.push(r => r[k] === v); return q }, maybeSingle: () => { one = true; return q }, single: () => { one = true; return q }, update: (p: any) => { patch = p; return q }, upsert: (p: any, o: any) => { seed = p; options = o; return q }, then(resolve: any) {
      if (seed) { const keys = options.onConflict.split(','); let row = rows[table].find(r => keys.every((k: string) => r[k] === seed[k])); if (!row) { row = { id: table === 'videos' ? 1 : 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ...seed }; rows[table].push(row) } else if (!options.ignoreDuplicates) Object.assign(row, seed) }
      const selected = rows[table].filter(r => filters.every(f => f(r)))
      if (patch && failUpdateTable === table) { failUpdateTable = null; return Promise.resolve(resolve({ error: { message: 'https://db.example/secret token' }, data: null })) }
      if (patch && patch.status === 'ready' && failReady) { failReady = false; return Promise.resolve(resolve({ error: { message: 'lost receipt' }, data: null })) }
      if (patch) selected.forEach(r => Object.assign(r, patch))
      return Promise.resolve(resolve({ data: structuredClone(one ? selected[0] || null : selected), error: null }))
    } }; return q
  } }
  return { admin, rows, objects, storage, failNextReceipt: () => { failReady = true }, failNextUpdate: (table: string) => { failUpdateTable = table }, failNextDownload: (code: string) => { storageStatus = code } }
}
const fetcher = () => vi.fn(async () => new Response(bytes, { headers: { 'content-type': 'video/mp4' } })) as unknown as typeof fetch

describe('private video archive', () => {
  it('classifies CloudFront and AWS expirations and rejects missing or unsafe URLs', () => {
    expect(classifyVideoUrl(expired)).toMatchObject({ expired: true, kind: 'provider_temporary' })
    expect(classifyVideoUrl(fresh)).toMatchObject({ expired: false, kind: 'provider_temporary' })
    expect(classifyVideoUrl('https://files2.heygen.ai/a?X-Amz-Date=20260301T000000Z&X-Amz-Expires=3600')).toMatchObject({ expired: true })
    expect(classifyVideoUrl('javascript:alert(1)').kind).toBe('invalid')
    expect(classifyVideoUrl(archiveReference('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).kind).toBe('archive')
  })
  it('archives once with immutable hash provenance and creates one video record across retries', async () => {
    const s = store(), download = fetcher(), job = { ...s.rows.video_generation_jobs[0] }
    const first = await completeGeneratedVideo(s.admin, job, fresh, download)
    const second = await completeGeneratedVideo(s.admin, job, expired, download)
    expect(first).toEqual(second); expect(download).toHaveBeenCalledTimes(1)
    expect(s.objects.size).toBe(1); expect(s.rows.videos).toHaveLength(1)
    expect(s.rows.video_media_archives[0]).toMatchObject({ status: 'ready', source_host: 'files2.heygen.ai', byte_length: bytes.length })
    expect(s.rows.videos[0].video_url).toMatch(/^portfolio-video:/)
    expect(s.storage.upload).toHaveBeenCalledWith(expect.any(String), expect.any(Buffer), { contentType: 'video/mp4', upsert: false })
  })
  it('persists thumbnail/share metadata on jobs and new or adopted videos', async () => {
    const s = store(), job = { ...s.rows.video_generation_jobs[0], thumbnail_url: 'thumb-1', video_share_url: 'share-1' }
    await completeGeneratedVideo(s.admin, job, fresh, fetcher())
    expect(s.rows.video_generation_jobs[0]).toMatchObject({ thumbnail_url: 'thumb-1', video_share_url: 'share-1' })
    expect(s.rows.videos[0].thumbnail_url).toBe('thumb-1')
    await completeGeneratedVideo(s.admin, { ...job, video_record_id: 1, thumbnail_url: 'thumb-2' }, expired, fetcher())
    expect(s.rows.videos[0].thumbnail_url).toBe('thumb-2')
    await completeGeneratedVideo(s.admin, { ...job, video_record_id: 1, thumbnail_url: null, video_share_url: null }, expired, fetcher())
    expect(s.rows.videos[0].thumbnail_url).toBe('thumb-2')
    expect(s.rows.video_generation_jobs[0].video_share_url).toBe('share-1')
  })
  it('converges concurrent completion callbacks without replacing human metadata', async () => {
    const s = store(), job = { ...s.rows.video_generation_jobs[0] }
    await Promise.all([completeGeneratedVideo(s.admin, job, fresh, fetcher()), completeGeneratedVideo(s.admin, job, fresh, fetcher())])
    expect(s.rows.videos).toHaveLength(1); expect(s.objects.size).toBe(1)
    s.rows.videos[0].title = 'Human title'
    await completeGeneratedVideo(s.admin, job, expired, fetcher())
    expect(s.rows.videos[0].title).toBe('Human title')
  })
  it('recovers an uploaded object after receipt failure even when provider input has expired', async () => {
    const s = store(), download = fetcher(), job = s.rows.video_generation_jobs[0]
    s.failNextReceipt()
    await expect(archiveCompletedVideo(s.admin, job, fresh, download)).rejects.toThrow('completion receipt')
    expect(s.objects.size).toBe(1)
    await archiveCompletedVideo(s.admin, job, expired, download)
    expect(download).toHaveBeenCalledTimes(1); expect(s.rows.video_media_archives).toHaveLength(1)
  })
  it('blocks expired inputs, redirects, unsupported hosts, and non-MP4 bodies before upload', async () => {
    const s = store(), download = fetcher(), job = s.rows.video_generation_jobs[0]
    await expect(archiveCompletedVideo(s.admin, job, expired, download)).rejects.toThrow('fresh HeyGen')
    await expect(archiveCompletedVideo(s.admin, job, 'https://127.0.0.1/private', download)).rejects.toThrow()
    expect(download).not.toHaveBeenCalled()
    const html = vi.fn(async () => new Response('not video', { headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch
    await expect(archiveCompletedVideo(s.admin, job, fresh, html)).rejects.toThrow('unavailable')
    expect(html).toHaveBeenCalledWith(fresh, expect.objectContaining({ redirect: 'error' }))
    expect(s.storage.upload).not.toHaveBeenCalled()
  })
  it('only signs verified private archives and binds playback to stable content, not signing time', async () => {
    const s = store(), job = s.rows.video_generation_jobs[0]
    const done = await completeGeneratedVideo(s.admin, job, fresh, fetcher())
    const one = await videoPlayback(s.admin, done.reference)
    expect(one).toMatchObject({ media_version: done.sha256, media_blocker: null, playback_url: expect.stringContaining('token=fresh-300') })
    expect(s.storage.createSignedUrl).toHaveBeenCalledWith(s.rows.video_media_archives[0].object_path, 300)
    expect(await videoPlayback(s.admin, expired)).toMatchObject({ playback_url: null, media_blocker: expect.stringContaining('expired') })
    s.rows.video_media_archives[0].object_path = '../other-private-data'
    expect((await videoPlayback(s.admin, done.reference)).playback_url).toBeNull()
  })
  it('blocks attach and approve for expired or unarchived jobs, and preserves approval across fresh playback links', async () => {
    const current: any = { id: 'social', status: 'approved', updated_at: 'v1', rag_context: {} }
    const job: any = { id: 'job', heygen_status: 'completed', updated_at: 'v1', video_url: expired }
    expect(() => prepareVideoAttachment(current, job, 'admin', new Date().toISOString())).toThrow('private archive')
    expect(() => prepareMediaReview(current, job, 'old', true, 'admin', new Date().toISOString())).toThrow()
    job.video_url = archiveReference('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'); job.media_version = 'a'.repeat(64)
    const attached = { ...current, ...prepareVideoAttachment(current, job, 'admin', new Date().toISOString()) }
    const approved = { ...attached, ...prepareMediaReview(attached, job, socialVideoAssetVersion(attached), true, 'admin', new Date().toISOString()) }
    job.updated_at = 'later'; job.playback_url = 'https://storage.example.invalid/fresh-token'
    expect(prepareVideoAttachment(approved, job, 'admin', new Date().toISOString())).toBeNull()
    expect(socialVideoReviewReady(approved)).toBe(true)
    job.media_version = 'b'.repeat(64)
    expect(() => prepareMediaReview(approved, job, socialVideoAssetVersion(approved), true, 'admin', new Date().toISOString())).toThrow()
  })

  it('treats credentialed, ported, near-expiry, and non-archive links as unusable', () => {
    const now = 1_700_000_000_000
    const withinWindow = `https://files2.heygen.ai/video.mp4?Expires=${Math.floor((now + 60_000) / 1000)}&Signature=fixture`
    const justOutside = `https://files.heygen.com/video.mp4?Expires=${Math.floor((now + 61_000) / 1000)}&Signature=fixture`
    expect(classifyVideoUrl(withinWindow, now)).toMatchObject({ kind: 'provider_temporary', expired: true })
    expect(classifyVideoUrl(justOutside, now)).toMatchObject({ kind: 'provider_temporary', expired: false })
    expect(classifyVideoUrl('https://cdn.example.com/a.mp4?signature=abc')).toMatchObject({ kind: 'provider_temporary', expired: false, reason: expect.stringContaining('Temporary provider') })
    expect(classifyVideoUrl('https://cdn.example.com/a.mp4')).toMatchObject({ kind: 'remote', reason: 'Video has no verified private archive.' })
    expect(classifyVideoUrl('https://files2.heygen.ai/a?X-Amz-Date=not-a-date&X-Amz-Expires=3600').expired).toBe(true)
    expect(classifyVideoUrl(archiveReference('AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA')).kind).toBe('archive')
    for (const unsafe of ['https://user:pass@files2.heygen.ai/video.mp4', 'https://files2.heygen.ai:8443/video.mp4', 'http://files2.heygen.ai/video.mp4', 'portfolio-video:not-a-uuid', null, 42]) {
      expect(classifyVideoUrl(unsafe)).toMatchObject({ kind: 'invalid', expired: true, reason: 'Video URL is missing or unusable.' })
    }
  })

  it('refuses unsafe or non-MP4 provider bytes before upload', async () => {
    const s = store(), job = s.rows.video_generation_jobs[0], download = fetcher()
    await expect(archiveCompletedVideo(s.admin, job, 'https://user:pass@files2.heygen.ai/video.mp4?Expires=4102444800&Signature=fixture', download)).rejects.toThrow('fresh HeyGen')
    await expect(archiveCompletedVideo(s.admin, job, 'https://heygen.ai.evil.com/video.mp4?Expires=4102444800&Signature=fixture', download)).rejects.toThrow('fresh HeyGen')
    expect(download).not.toHaveBeenCalled()
    const oversize = vi.fn(async () => ({ ok: true, headers: { get: (name: string) => name === 'content-type' ? 'video/mp4' : name === 'content-length' ? String(100 * 1024 * 1024 + 1) : null }, body: { getReader() { throw new Error('body was read') } } })) as unknown as typeof fetch
    await expect(archiveCompletedVideo(s.admin, job, fresh, oversize)).rejects.toThrow('100 MiB')
    const empty = vi.fn(async () => ({ ok: true, headers: { get: (name: string) => name === 'content-type' ? 'video/mp4' : null }, body: null })) as unknown as typeof fetch
    await expect(archiveCompletedVideo(s.admin, job, fresh, empty)).rejects.toThrow('no body')
    const notMp4 = vi.fn(async () => new Response(Buffer.from('0000not-an-mp4-body'), { headers: { 'content-type': 'video/mp4' } })) as unknown as typeof fetch
    await expect(archiveCompletedVideo(s.admin, job, fresh, notMp4)).rejects.toThrow('not an MP4')
    const denied = vi.fn(async () => new Response(bytes, { status: 403, headers: { 'content-type': 'video/mp4' } })) as unknown as typeof fetch
    await expect(archiveCompletedVideo(s.admin, job, fresh, denied)).rejects.toThrow('unavailable')
    expect(s.storage.upload).not.toHaveBeenCalled()
    const typed = vi.fn(async () => new Response(bytes, { headers: { 'content-type': 'video/mp4; charset=binary' } })) as unknown as typeof fetch
    await archiveCompletedVideo(s.admin, job, 'https://files.heygen.com/video.mp4?Expires=4102444800&Signature=fixture', typed)
    expect(s.rows.video_media_archives[0].source_host).toBe('files.heygen.com')
  })

  it('keeps provider URLs and transport secrets out of completion failure state', async () => {
    const redacted = 'Private archive failed. Refresh the provider input or retry archive recovery.'
    const leak = 'download failed https://files2.heygen.ai/video.mp4?Signature=secret&token=abc'
    const s = store(), job = { ...s.rows.video_generation_jobs[0], video_url: archiveReference('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') }
    const download = vi.fn(async () => { throw new Error(leak) }) as unknown as typeof fetch
    const leaked = await persistVideoCompletion(s.admin, job, fresh, download)
    expect(leaked).toMatchObject({ reference: job.video_url, sha256: null, media_blocker: redacted, videoRecordId: undefined })
    expect(s.rows.video_generation_jobs[0]).toMatchObject({ heygen_status: 'completed', provider_video_url: fresh, error_message: redacted })
    expect(s.rows.video_generation_jobs[0].video_url).toBeUndefined()
    expect(JSON.stringify(s.rows.video_generation_jobs[0].error_message)).not.toMatch(/https?:|signature|token|secret/i)
    expect(s.storage.upload).not.toHaveBeenCalled()

    const thrown = store()
    const stringThrow = vi.fn(async () => { throw 'https://files2.heygen.ai/token' }) as unknown as typeof fetch
    expect((await persistVideoCompletion(thrown.admin, thrown.rows.video_generation_jobs[0], fresh, stringThrow)).media_blocker).toBe(redacted)

    const safe = store()
    const blocked = await persistVideoCompletion(safe.admin, safe.rows.video_generation_jobs[0], expired, fetcher())
    expect(blocked.media_blocker).toBe('A fresh HeyGen media URL is required. Refresh the provider link first.')
    expect(blocked.reference).toBeNull()
    expect(safe.rows.video_generation_jobs[0].video_url).toBeUndefined()

    const hidden = store()
    hidden.failNextUpdate('video_generation_jobs')
    await expect(persistVideoCompletion(hidden.admin, hidden.rows.video_generation_jobs[0], expired, fetcher())).rejects.toThrow('Archive failure state could not be saved.')
    expect(JSON.stringify(hidden.rows.video_generation_jobs[0])).not.toMatch(/db\.example|secret/)
  })

  it('preserves the existing archive when provider bytes or storage no longer match', async () => {
    const s = store(), job = s.rows.video_generation_jobs[0]
    const done = await completeGeneratedVideo(s.admin, job, fresh, fetcher())
    const archived = s.rows.video_media_archives[0]
    archived.status = 'pending'
    s.objects.delete(archived.object_path)
    const changed = Buffer.from('0000ftypisomsynthetic-CHANGED')
    const replacement = vi.fn(async () => new Response(changed, { headers: { 'content-type': 'video/mp4' } })) as unknown as typeof fetch
    const drift = await persistVideoCompletion(s.admin, { ...job, video_url: done.reference, video_record_id: done.videoRecordId }, fresh, replacement)
    expect(drift.media_blocker).toBe('Provider media changed for this job. Preserve the existing archive and reconcile the version.')
    expect(drift.reference).toBe(done.reference)
    expect(s.rows.video_generation_jobs[0].video_url).toBe(done.reference)
    expect(s.rows.video_media_archives).toHaveLength(1)
    expect(s.rows.video_media_archives[0].sha256).toBe(done.sha256)
    expect(s.storage.upload).toHaveBeenCalledTimes(1)

    s.rows.video_generation_jobs[0].error_message = null
    s.failNextDownload('500')
    const unverified = await persistVideoCompletion(s.admin, { ...job, video_url: done.reference, video_record_id: done.videoRecordId }, fresh, fetcher())
    expect(unverified.media_blocker).toBe('Private archive storage could not be verified.')
    expect(unverified.media_blocker).not.toMatch(/https?:|token/)
    expect(s.rows.video_generation_jobs[0].video_url).toBe(done.reference)
  })

  it('blocks completion when the job, video row, or thumbnail write cannot be confirmed', async () => {
    const s = store(), job = { ...s.rows.video_generation_jobs[0] }, download = fetcher()
    await expect(completeGeneratedVideo(s.admin, { ...job, deleted_at: '2026-10-01T00:00:00.000Z' }, fresh, download)).rejects.toThrow('available provider job')
    await expect(completeGeneratedVideo(s.admin, { ...job, heygen_video_id: null }, fresh, download)).rejects.toThrow('available provider job')
    expect(download).not.toHaveBeenCalled()
    await expect(completeGeneratedVideo(s.admin, { ...job, video_record_id: 99 }, fresh, fetcher())).rejects.toThrow('Existing video record requires archive reconciliation.')
    const raced = store()
    const mutate = vi.fn(async () => { raced.rows.video_generation_jobs[0].heygen_video_id = 'changed'; return new Response(bytes, { headers: { 'content-type': 'video/mp4' } }) }) as unknown as typeof fetch
    await expect(completeGeneratedVideo(raced.admin, { ...raced.rows.video_generation_jobs[0] }, fresh, mutate)).rejects.toThrow('Job changed before archive linkage. Reload before recovery.')
    const thumb = store()
    thumb.failNextUpdate('videos')
    await expect(completeGeneratedVideo(thumb.admin, { ...thumb.rows.video_generation_jobs[0], thumbnail_url: 'thumb' }, fresh, fetcher())).rejects.toThrow('Video thumbnail could not be saved.')
    expect(JSON.stringify(thumb.rows)).not.toMatch(/db\.example|secret/)
  })

  it('withholds playback when the archived job is gone, mismatched, or unsigned', async () => {
    const s = store(), job = s.rows.video_generation_jobs[0]
    const done = await completeGeneratedVideo(s.admin, job, fresh, fetcher())
    s.rows.video_generation_jobs[0].deleted_at = '2026-10-01T00:00:00.000Z'
    expect(await videoPlayback(s.admin, done.reference)).toMatchObject({ playback_url: null, media_blocker: 'Archived job is no longer available.' })
    s.rows.video_generation_jobs[0].deleted_at = null
    s.rows.video_generation_jobs[0].heygen_video_id = 'other-provider'
    expect(await videoPlayback(s.admin, done.reference)).toMatchObject({ playback_url: null, media_blocker: 'Archived job is no longer available.' })
    s.rows.video_generation_jobs[0].heygen_video_id = 'provider-1'
    s.storage.createSignedUrl.mockResolvedValueOnce({ error: { message: 'https://storage.example/secret?token=leak' }, data: null })
    const unsigned = await videoPlayback(s.admin, done.reference)
    expect(unsigned).toMatchObject({ playback_url: null, media_blocker: 'Private playback link could not be issued. Reload to retry.' })
    expect(unsigned.media_blocker).not.toMatch(/https?:|token/)
    const success = await persistVideoCompletion(s.admin, { ...job, video_record_id: done.videoRecordId }, expired, fetcher())
    expect(success).toMatchObject({ reference: done.reference, sha256: done.sha256, media_blocker: null })
  })
})
