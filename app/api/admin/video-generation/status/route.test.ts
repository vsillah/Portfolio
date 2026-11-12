import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  getVideoStatus: vi.fn(),
  jobSingle: vi.fn(),
  jobUpdate: vi.fn(),
  jobUpdateEq: vi.fn(),
  videoInsert: vi.fn(),
  videoInsertSingle: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/heygen', () => ({
  getVideoStatus: mocks.getVideoStatus,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

function request(query = '') {
  return new NextRequest(`http://localhost/api/admin/video-generation/status${query}`)
}

function wireSupabase() {
  mocks.jobUpdateEq.mockResolvedValue({ error: null })
  mocks.jobUpdate.mockReturnValue({ eq: mocks.jobUpdateEq })
  const videoSelect = vi.fn(() => ({ single: mocks.videoInsertSingle }))
  mocks.videoInsert.mockReturnValue({ select: videoSelect })

  mocks.from.mockImplementation((table: string) => {
    if (table === 'video_generation_jobs') {
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mocks.jobSingle })) })),
        update: mocks.jobUpdate,
      }
    }
    if (table === 'videos') return { insert: mocks.videoInsert }
    throw new Error(`Unexpected table: ${table}`)
  })
}

const pendingJob = {
  id: 'job-1',
  heygen_video_id: 'heygen-1',
  heygen_status: 'processing',
  video_url: null,
  video_share_url: 'https://share.example/v',
  video_record_id: null,
  script_text: 'A'.repeat(250),
  channel: 'linkedin',
  aspect_ratio: 'portrait',
}

describe('GET /api/admin/video-generation/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    wireSupabase()
  })

  it('requires admin auth before reading a job', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request('?jobId=job-1'))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.getVideoStatus).not.toHaveBeenCalled()
  })

  it('rejects a missing or blank jobId', async () => {
    const missing = await GET(request())
    const blank = await GET(request('?jobId=%20%20'))

    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({ error: 'jobId is required' })
    expect(blank.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the job lookup fails', async () => {
    mocks.jobSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })

    const response = await GET(request('?jobId=missing'))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Job not found' })
    expect(mocks.getVideoStatus).not.toHaveBeenCalled()
  })

  it('returns the stored job when HeyGen has not assigned a video id', async () => {
    mocks.jobSingle.mockResolvedValue({
      data: { ...pendingJob, heygen_video_id: null, heygen_status: 'queued', video_url: 'https://cdn.example/old.mp4', video_record_id: 'video-9' },
      error: null,
    })

    const response = await GET(request('?jobId=job-1'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      jobId: 'job-1',
      status: 'queued',
      videoUrl: 'https://cdn.example/old.mp4',
      videoRecordId: 'video-9',
      message: 'No HeyGen video ID yet',
    })
    expect(mocks.getVideoStatus).not.toHaveBeenCalled()
    expect(mocks.jobUpdate).not.toHaveBeenCalled()
  })

  it('does not write when HeyGen status and url are unchanged', async () => {
    mocks.jobSingle.mockResolvedValue({
      data: { ...pendingJob, video_url: 'https://cdn.example/same.mp4', video_record_id: 'video-1' },
      error: null,
    })
    mocks.getVideoStatus.mockResolvedValue({
      videoId: 'heygen-1',
      status: 'processing',
      videoUrl: 'https://cdn.example/same.mp4',
      videoShareUrl: null,
      thumbnailUrl: 'https://cdn.example/thumb.jpg',
      duration: 12,
      error: null,
    })

    const response = await GET(request('?jobId=job-1'))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      jobId: 'job-1',
      heygenVideoId: 'heygen-1',
      status: 'processing',
      videoUrl: 'https://cdn.example/same.mp4',
      videoShareUrl: 'https://share.example/v',
      videoRecordId: 'video-1',
      thumbnailUrl: 'https://cdn.example/thumb.jpg',
      duration: 12,
      error: null,
    })
    expect(mocks.jobUpdate).not.toHaveBeenCalled()
    expect(mocks.videoInsert).not.toHaveBeenCalled()
  })

  it('persists a changed status and creates an unpublished video row when HeyGen completes', async () => {
    mocks.jobSingle.mockResolvedValue({ data: pendingJob, error: null })
    mocks.getVideoStatus.mockResolvedValue({
      videoId: 'heygen-1',
      status: 'completed',
      videoUrl: 'https://cdn.example/final.mp4',
      videoShareUrl: null,
      thumbnailUrl: null,
      duration: 30,
      error: 'caption delayed',
    })
    mocks.videoInsertSingle.mockResolvedValue({ data: { id: 'video-new' }, error: null })

    const response = await GET(request('?jobId=job-1'))

    expect(response.status).toBe(200)
    expect(mocks.jobUpdate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      heygen_status: 'completed',
      video_url: 'https://cdn.example/final.mp4',
      error_message: 'caption delayed',
    }))
    expect(mocks.jobUpdateEq).toHaveBeenCalledWith('id', 'job-1')
    expect(mocks.videoInsert).toHaveBeenCalledWith({
      title: 'Generated video (linkedin)',
      description: 'A'.repeat(200),
      video_url: 'https://cdn.example/final.mp4',
      display_order: 0,
      is_published: false,
      video_generation_job_id: 'job-1',
    })
    expect(mocks.jobUpdate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      video_record_id: 'video-new',
    }))
    expect(await response.json()).toMatchObject({
      status: 'completed',
      videoUrl: 'https://cdn.example/final.mp4',
      videoRecordId: 'video-new',
      error: 'caption delayed',
    })
  })

  it('uses the youtube title fallback and skips the record link when the video insert returns no id', async () => {
    mocks.jobSingle.mockResolvedValue({
      data: { ...pendingJob, channel: null, script_text: null, heygen_status: 'completed', video_url: null },
      error: null,
    })
    mocks.getVideoStatus.mockResolvedValue({
      videoId: 'heygen-1',
      status: 'completed',
      videoUrl: 'https://cdn.example/final.mp4',
      videoShareUrl: null,
      thumbnailUrl: null,
      duration: null,
      error: null,
    })
    mocks.videoInsertSingle.mockResolvedValue({ data: null, error: null })

    const response = await GET(request('?jobId=job-1'))

    expect(mocks.videoInsert).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Generated video (youtube)',
      description: null,
    }))
    expect(mocks.jobUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.jobUpdate.mock.calls[0][0]).not.toHaveProperty('error_message')
    expect((await response.json()).videoRecordId).toBeNull()
  })

  it('returns the thrown error message when status polling fails', async () => {
    mocks.jobSingle.mockResolvedValue({ data: pendingJob, error: null })
    mocks.getVideoStatus.mockRejectedValue(new Error('HeyGen timeout'))

    const response = await GET(request('?jobId=job-1'))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'HeyGen timeout' })
  })
})
