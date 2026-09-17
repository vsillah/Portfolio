import { beforeEach, describe, expect, it, vi } from 'vitest'
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

type QueryResult = { data: unknown; error: unknown }

function thenableQuery(result: QueryResult) {
  const query = {
    select: vi.fn(),
    in: vi.fn(),
    is: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.in.mockReturnValue(query)
  query.is.mockReturnValue(query)
  query.update.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.insert.mockReturnValue(query)
  return query
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/video-generation/jobs/batch-refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/video-generation/jobs/batch-refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication before calling HeyGen', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({ jobIds: ['job-1'] }))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.getVideoStatus).not.toHaveBeenCalled()
  })

  it('rejects an empty jobIds list without fetching', async () => {
    const response = await POST(makeRequest({ jobIds: [] }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'No job IDs provided' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('skips jobs without a HeyGen video id and swallows per-job status failures', async () => {
    const listQuery = thenableQuery({
      data: [
        { id: 'job-missing', heygen_video_id: null, heygen_status: 'pending', video_url: null, video_record_id: null },
        { id: 'job-fail', heygen_video_id: 'vid-fail', heygen_status: 'pending', video_url: null, video_record_id: null },
      ],
      error: null,
    })
    mocks.from.mockReturnValue(listQuery)
    mocks.getVideoStatus.mockRejectedValue(new Error('heygen down'))

    const response = await POST(makeRequest({ jobIds: ['job-missing', 'job-fail'] }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ refreshed: 0, updated: 0, total: 2 })
    expect(mocks.getVideoStatus).toHaveBeenCalledTimes(1)
    expect(mocks.getVideoStatus).toHaveBeenCalledWith('vid-fail')
    expect(listQuery.update).not.toHaveBeenCalled()
  })

  it('updates status and inserts an unpublished video row when a job newly completes', async () => {
    const listQuery = thenableQuery({
      data: [
        {
          id: 'job-1',
          heygen_video_id: 'vid-1',
          heygen_status: 'processing',
          video_url: null,
          video_record_id: null,
          script_text: 'Hello world script',
          channel: 'youtube',
        },
      ],
      error: null,
    })
    const jobUpdate = thenableQuery({ data: null, error: null })
    const videoInsert = thenableQuery({ data: { id: 'video-1' }, error: null })
    const bindUpdate = thenableQuery({ data: null, error: null })
    const tables: string[] = []
    mocks.from.mockImplementation((table: string) => {
      tables.push(table)
      if (table === 'video_generation_jobs' && tables.filter((t) => t === 'video_generation_jobs').length === 1) {
        return listQuery
      }
      if (table === 'video_generation_jobs' && tables.filter((t) => t === 'video_generation_jobs').length === 2) {
        return jobUpdate
      }
      if (table === 'videos') return videoInsert
      if (table === 'video_generation_jobs') return bindUpdate
      throw new Error(`Unexpected table: ${table}`)
    })
    mocks.getVideoStatus.mockResolvedValue({
      status: 'completed',
      videoUrl: 'https://cdn.example/video.mp4',
      error: null,
    })

    const response = await POST(makeRequest({ jobIds: ['job-1'] }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ refreshed: 1, updated: 1, total: 1 })
    expect(jobUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        heygen_status: 'completed',
        video_url: 'https://cdn.example/video.mp4',
      }),
    )
    expect(videoInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        video_url: 'https://cdn.example/video.mp4',
        is_published: false,
        video_generation_job_id: 'job-1',
        display_order: 0,
      }),
    )
    expect(bindUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({ video_record_id: 'video-1' }),
    )
  })
})
