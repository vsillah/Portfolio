import crypto from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  runVideoCompletionHandlers: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/video-completion-handlers', () => ({
  runVideoCompletionHandlers: mocks.runVideoCompletionHandlers,
}))

import { POST } from './route'

const SECRET = 'heygen-test-secret'
const BASE_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function sign(body: string, secret = SECRET) {
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex')
}

function makeRequest(body: string, signature?: string | null) {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (signature !== null) {
    headers.set('signature', signature ?? sign(body))
  }
  return new NextRequest('http://localhost/api/webhooks/heygen', {
    method: 'POST',
    headers,
    body,
  })
}

function successBody(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    event_type: 'avatar_video.success',
    event_data: {
      video_id: 'hg-video-1',
      url: 'https://cdn.example.com/video.mp4',
      thumbnail_url: 'https://cdn.example.com/thumb.jpg',
      video_share_page_url: 'https://heygen.example.com/share/1',
      ...overrides,
    },
  })
}

function jobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    heygen_video_id: 'hg-video-1',
    heygen_status: 'processing',
    video_url: null,
    video_record_id: null,
    script_text: 'Hello from the script',
    channel: 'youtube',
    aspect_ratio: '16:9',
    thumbnail_url: null,
    ...overrides,
  }
}

describe('POST /api/webhooks/heygen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    process.env.HEYGEN_WEBHOOK_SECRET = SECRET
    mocks.runVideoCompletionHandlers.mockResolvedValue(undefined)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    restoreEnv()
    vi.restoreAllMocks()
  })

  it('soft-acks when HEYGEN_WEBHOOK_SECRET is missing', async () => {
    delete process.env.HEYGEN_WEBHOOK_SECRET

    const response = await POST(makeRequest(successBody(), 'whatever'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ received: true })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects missing or invalid signatures', async () => {
    const body = successBody()

    const missing = await POST(makeRequest(body, null))
    expect(missing.status).toBe(401)
    await expect(missing.json()).resolves.toEqual({ error: 'Unauthorized' })

    const bad = await POST(makeRequest(body, '0'.repeat(64)))
    expect(bad.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('acks unknown event types and missing video ids without DB writes', async () => {
    const unknown = await POST(
      makeRequest(
        JSON.stringify({ event_type: 'avatar_video.progress', event_data: { video_id: 'x' } }),
      ),
    )
    expect(unknown.status).toBe(200)
    expect(mocks.from).not.toHaveBeenCalled()

    const missingId = await POST(
      makeRequest(JSON.stringify({ event_type: 'avatar_video.success', event_data: {} })),
    )
    expect(missingId.status).toBe(200)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('acks when no matching job exists', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) }),
    })

    const response = await POST(makeRequest(successBody()))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ received: true })
    expect(mocks.runVideoCompletionHandlers).not.toHaveBeenCalled()
  })

  it('skips terminal jobs without re-updating', async () => {
    const single = vi.fn().mockResolvedValue({
      data: jobRow({ heygen_status: 'completed' }),
      error: null,
    })
    const update = vi.fn()
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) }),
      update,
    })

    const response = await POST(makeRequest(successBody()))

    expect(response.status).toBe(200)
    expect(update).not.toHaveBeenCalled()
    expect(mocks.runVideoCompletionHandlers).not.toHaveBeenCalled()
  })

  it('marks success, inserts a video row when missing, and runs completion handlers', async () => {
    const job = jobRow()
    const selectSingle = vi.fn().mockResolvedValue({ data: job, error: null })
    const jobUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const jobUpdate = vi.fn().mockReturnValue({ eq: jobUpdateEq })
    const videoInsertSelectSingle = vi.fn().mockResolvedValue({ data: { id: 'video-1' }, error: null })
    const videoInsertSelect = vi.fn().mockReturnValue({ single: videoInsertSelectSingle })
    const videoInsert = vi.fn().mockReturnValue({ select: videoInsertSelect })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'video_generation_jobs') {
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: selectSingle }) }),
          update: jobUpdate,
        }
      }
      if (table === 'videos') {
        return { insert: videoInsert }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest(successBody()))

    expect(response.status).toBe(200)
    expect(jobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        heygen_status: 'completed',
        video_url: 'https://cdn.example.com/video.mp4',
        thumbnail_url: 'https://cdn.example.com/thumb.jpg',
        video_share_url: 'https://heygen.example.com/share/1',
      }),
    )
    expect(videoInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        video_url: 'https://cdn.example.com/video.mp4',
        video_generation_job_id: 'job-1',
        is_published: false,
      }),
    )
    expect(jobUpdateEq).toHaveBeenCalled()
    expect(mocks.runVideoCompletionHandlers).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'job-1',
        heygen_status: 'completed',
        video_url: 'https://cdn.example.com/video.mp4',
      }),
    )
  })

  it('persists failure error_message and still returns 200 if handlers throw', async () => {
    const job = jobRow()
    const selectSingle = vi.fn().mockResolvedValue({ data: job, error: null })
    const jobUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const jobUpdate = vi.fn().mockReturnValue({ eq: jobUpdateEq })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: selectSingle }) }),
      update: jobUpdate,
    })
    mocks.runVideoCompletionHandlers.mockRejectedValueOnce(new Error('handler boom'))

    const body = JSON.stringify({
      event_type: 'avatar_video.fail',
      event_data: {
        video_id: 'hg-video-1',
        error_message: 'render failed',
      },
    })

    const response = await POST(makeRequest(body))

    expect(response.status).toBe(200)
    expect(jobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        heygen_status: 'failed',
        error_message: 'render failed',
      }),
    )
    expect(mocks.runVideoCompletionHandlers).toHaveBeenCalled()
  })
})
