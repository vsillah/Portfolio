import { describe, it, expect, vi } from 'vitest'
import { archiveReference, classifyVideoUrl } from './video-media-url'
import { archiveCompletedVideo, completeGeneratedVideo, videoPlayback } from './video-media-archive'
import { socialVideoAssetVersion, socialVideoReviewReady } from './social-video-review'
import { prepareVideoAttachment, prepareMediaReview } from './social-campaign-review-handoff'
const bytes = Buffer.from('0000ftypisomsynthetic-mp4')
const fresh = 'https://files2.heygen.ai/video.mp4?Expires=4102444800&Signature=fixture'
const expired = 'https://files2.heygen.ai/video.mp4?Expires=1710000000&Signature=fixture'
function store() {
  const rows: Record<string, any[]> = { video_media_archives: [], videos: [], video_generation_jobs: [{ id: '11111111-1111-4111-8111-111111111111', heygen_video_id: 'provider-1', heygen_status: 'completed', deleted_at: null }] }
  const objects = new Map<string, Buffer>()
  let failReady = false
  const storage = { upload: vi.fn(async (path: string, data: Buffer) => { if (objects.has(path)) return { error: { statusCode: '409' } }; objects.set(path, data); return { error: null } }), download: vi.fn(async (path: string) => objects.has(path) ? { data: { size: objects.get(path)!.length, arrayBuffer: async () => objects.get(path)! } } : { error: { statusCode: '404' } }), createSignedUrl: vi.fn(async (path: string, ttl: number) => ({ data: { signedUrl: `https://storage.example.invalid/${path}?token=fresh-${ttl}` } })) }
  const admin: any = { storage: { from: vi.fn(() => storage) }, from(table: string) {
    const filters: Array<(r: any) => boolean> = []; let patch: any, seed: any, options: any, one = false
    const q: any = { select: () => q, eq: (k: string, v: any) => { filters.push(r => r[k] === v); return q }, is: (k: string, v: any) => { filters.push(r => r[k] === v); return q }, maybeSingle: () => { one = true; return q }, single: () => { one = true; return q }, update: (p: any) => { patch = p; return q }, upsert: (p: any, o: any) => { seed = p; options = o; return q }, then(resolve: any) {
      if (seed) { const keys = options.onConflict.split(','); let row = rows[table].find(r => keys.every((k: string) => r[k] === seed[k])); if (!row) { row = { id: table === 'videos' ? 1 : 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ...seed }; rows[table].push(row) } else if (!options.ignoreDuplicates) Object.assign(row, seed) }
      const selected = rows[table].filter(r => filters.every(f => f(r)))
      if (patch && patch.status === 'ready' && failReady) { failReady = false; return Promise.resolve(resolve({ error: { message: 'lost receipt' }, data: null })) }
      if (patch) selected.forEach(r => Object.assign(r, patch))
      return Promise.resolve(resolve({ data: structuredClone(one ? selected[0] || null : selected), error: null }))
    } }; return q
  } }
  return { admin, rows, objects, storage, failNextReceipt: () => { failReady = true } }
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
})
