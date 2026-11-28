import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  getVideoStatus: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/heygen', () => ({
  getVideoStatus: mocks.getVideoStatus,
}))

import { POST } from './route'

function makeRequest(body?: string) {
  return new NextRequest('http://localhost/api/admin/videos/refresh-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
}

function mockSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error })
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq }))
  return { select, eq, single }
}

function mockUpdate() {
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq }))
  return { update, eq }
}

describe('POST /api/admin/videos/refresh-url', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-28T10:00:00.000Z'))
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requires admin auth before reading the video', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(JSON.stringify({ videoId: 9 })))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.getVideoStatus).not.toHaveBeenCalled()
  })

  it('rejects a missing video id, including invalid JSON and numeric zero', async () => {
    const missing = await POST(makeRequest(JSON.stringify({})))
    const invalid = await POST(makeRequest('not-json'))
    const zero = await POST(makeRequest(JSON.stringify({ videoId: 0 })))

    expect(missing.status).toBe(400)
    expect(invalid.status).toBe(400)
    expect(zero.status).toBe(400)
    expect(await zero.json()).toEqual({ error: 'videoId is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the video row is missing', async () => {
    mocks.from.mockReturnValueOnce(mockSingle(null, { code: 'PGRST116', message: 'missing' }))

    const response = await POST(makeRequest(JSON.stringify({ videoId: 4 })))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Video not found' })
    expect(mocks.getVideoStatus).not.toHaveBeenCalled()
  })

  it('rejects a video that is not linked to a generation job', async () => {
    mocks.from.mockReturnValueOnce(mockSingle({
      id: 4,
      video_url: 'https://cdn.example/old.mp4',
      video_generation_job_id: null,
    }))

    const response = await POST(makeRequest(JSON.stringify({ videoId: 4 })))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Video is not linked to a generation job' })
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('rejects a job that has no HeyGen video id', async () => {
    mocks.from
      .mockReturnValueOnce(mockSingle({
        id: 4,
        video_url: 'https://cdn.example/old.mp4',
        video_generation_job_id: 'job-1',
      }))
      .mockReturnValueOnce(mockSingle({ heygen_video_id: null }))

    const response = await POST(makeRequest(JSON.stringify({ videoId: 4 })))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'No HeyGen video ID found for this job' })
    expect(mocks.getVideoStatus).not.toHaveBeenCalled()
  })

  it('returns the HeyGen error at 502 without writing a URL', async () => {
    mocks.from
      .mockReturnValueOnce(mockSingle({
        id: 4,
        video_url: 'https://cdn.example/old.mp4',
        video_generation_job_id: 'job-1',
      }))
      .mockReturnValueOnce(mockSingle({ heygen_video_id: 'hg-1' }))
    mocks.getVideoStatus.mockResolvedValue({ error: 'HeyGen timed out', videoUrl: null })

    const response = await POST(makeRequest(JSON.stringify({ videoId: 4 })))

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'HeyGen timed out' })
    expect(mocks.getVideoStatus).toHaveBeenCalledWith('hg-1')
    expect(mocks.from).toHaveBeenCalledTimes(2)
  })

  it('does not write when HeyGen returns the current URL', async () => {
    mocks.from
      .mockReturnValueOnce(mockSingle({
        id: 4,
        video_url: 'https://cdn.example/same.mp4',
        video_generation_job_id: 'job-1',
      }))
      .mockReturnValueOnce(mockSingle({ heygen_video_id: 'hg-1' }))
    mocks.getVideoStatus.mockResolvedValue({ videoUrl: 'https://cdn.example/same.mp4' })

    const response = await POST(makeRequest(JSON.stringify({ videoId: 4 })))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      videoId: 4,
      videoUrl: 'https://cdn.example/same.mp4',
      refreshed: false,
    })
    expect(mocks.from).toHaveBeenCalledTimes(2)
  })

  it('reports refreshed without writing when HeyGen omits a URL', async () => {
    mocks.from
      .mockReturnValueOnce(mockSingle({
        id: 4,
        video_url: 'https://cdn.example/old.mp4',
        video_generation_job_id: 'job-1',
      }))
      .mockReturnValueOnce(mockSingle({ heygen_video_id: 'hg-1' }))
    mocks.getVideoStatus.mockResolvedValue({ videoUrl: null })

    const response = await POST(makeRequest(JSON.stringify({ videoId: 4 })))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      videoId: 4,
      videoUrl: 'https://cdn.example/old.mp4',
      refreshed: true,
    })
    expect(mocks.from).toHaveBeenCalledTimes(2)
  })

  it('writes a changed URL onto the video and the generation job', async () => {
    const videoUpdate = mockUpdate()
    const jobUpdate = mockUpdate()
    mocks.from
      .mockReturnValueOnce(mockSingle({
        id: 4,
        video_url: 'https://cdn.example/old.mp4',
        video_generation_job_id: 'job-1',
      }))
      .mockReturnValueOnce(mockSingle({ heygen_video_id: 'hg-1' }))
      .mockReturnValueOnce(videoUpdate)
      .mockReturnValueOnce(jobUpdate)
    mocks.getVideoStatus.mockResolvedValue({ videoUrl: 'https://cdn.example/fresh.mp4' })

    const response = await POST(makeRequest(JSON.stringify({ videoId: '4' })))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      videoId: '4',
      videoUrl: 'https://cdn.example/fresh.mp4',
      refreshed: true,
    })
    expect(videoUpdate.update).toHaveBeenCalledWith({
      video_url: 'https://cdn.example/fresh.mp4',
      updated_at: '2026-09-28T10:00:00.000Z',
    })
    expect(videoUpdate.eq).toHaveBeenCalledWith('id', '4')
    expect(jobUpdate.update).toHaveBeenCalledWith({
      video_url: 'https://cdn.example/fresh.mp4',
      updated_at: '2026-09-28T10:00:00.000Z',
    })
    expect(jobUpdate.eq).toHaveBeenCalledWith('id', 'job-1')
  })
})
