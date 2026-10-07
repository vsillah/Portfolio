import { beforeEach, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
const m = vi.hoisted(() => ({ from: vi.fn(), complete: vi.fn(), status: vi.fn(), playback: vi.fn(), update: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: m.from } }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: async () => ({ user: { id: 'admin' } }), isAuthError: () => false }))
vi.mock('@/lib/heygen', () => ({ getVideoStatus: m.status }))
vi.mock('@/lib/video-media-archive', () => ({ persistVideoCompletion: m.complete, videoPlayback: m.playback }))
import { GET as status, POST as recovery } from '@/app/api/admin/video-generation/status/route'
import { POST as batch } from '@/app/api/admin/video-generation/jobs/batch-refresh/route'
import { POST as refresh } from '@/app/api/admin/videos/refresh-url/route'
import { GET as jobs } from '@/app/api/admin/video-generation/jobs/route'
const job = { id: 'job', heygen_video_id: 'provider', heygen_status: 'completed', video_url: 'expired-url', provider_video_url: 'fresh-stored-input', video_generation_job_id: 'job' }
beforeEach(() => {
  vi.clearAllMocks()
  m.status.mockResolvedValue({ status: 'completed', videoUrl: 'fresh-provider-input', thumbnailUrl: 'provider-thumb', videoShareUrl: 'provider-share' })
  m.complete.mockResolvedValue({ reference: 'private-reference', videoRecordId: 1, media_blocker: null })
  m.playback.mockResolvedValue({ playback_url: 'fresh-signed-playback', media_blocker: null })
  m.from.mockImplementation(() => { let one = false; const q: any = { select: () => q, eq: () => q, in: () => q, is: () => q, order: () => q, range: () => q, update: (p: unknown) => { m.update(p); return q }, single: () => { one = true; return q }, then: (resolve: any) => resolve({ data: one ? job : [job], error: null, count: 1 }) }; return q })
})
it('single status and batch paths converge on the same archive completion helper', async () => {
  expect((await status(new NextRequest('http://localhost/status?jobId=job'))).status).toBe(200)
  expect((await batch(new NextRequest('http://localhost/batch', { method: 'POST', body: JSON.stringify({ jobIds: ['job'] }) }))).status).toBe(200)
  expect(m.complete).toHaveBeenCalledTimes(2)
  expect(m.complete).toHaveBeenCalledWith(expect.any(Object), { ...job, thumbnail_url: 'provider-thumb', video_share_url: 'provider-share' }, 'fresh-provider-input')
})
it('archive recovery does not refresh HeyGen; provider refresh does not archive or update final video URLs', async () => {
  const response = await recovery(new NextRequest('http://localhost/status', { method: 'POST', body: JSON.stringify({ jobId: 'job', action: 'archive' }) }))
  expect(response.status).toBe(200); expect(m.status).not.toHaveBeenCalled()
  expect(m.complete).toHaveBeenCalledWith(expect.any(Object), job, 'fresh-stored-input')
  m.complete.mockClear()
  await refresh(new NextRequest('http://localhost/refresh', { method: 'POST', body: JSON.stringify({ videoId: 1 }) }))
  expect(m.complete).not.toHaveBeenCalled(); expect(m.update).toHaveBeenCalledWith({ provider_video_url: 'fresh-provider-input' })
})
it('the completed-jobs list strips unusable media and returns its recovery reason', async () => {
  m.playback.mockResolvedValue({ playback_url: null, media_blocker: 'Provider video link expired.' })
  const response = await jobs(new NextRequest('http://localhost/jobs?status=completed'))
  expect((await response.json()).jobs[0]).toMatchObject({ video_url: null, video_reference: 'expired-url', media_blocker: 'Provider video link expired.' })
  expect(m.status).not.toHaveBeenCalled(); expect(m.complete).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled()
})
