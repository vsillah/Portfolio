import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  createVideo: vi.fn(),
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
  createVideo: mocks.createVideo,
}))

import { POST } from './route'

const FAILED_JOB_ID = '11111111-1111-4111-8111-111111111111'
const EXTRA_JOB_ID = '22222222-2222-4222-8222-222222222222'

function postRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/video-generation/jobs/batch-retry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function failedJob(overrides: Record<string, unknown> = {}) {
  return {
    id: FAILED_JOB_ID,
    script_source: 'manual',
    script_text: 'Hello world',
    drive_file_name: null,
    target_type: 'youtube',
    target_id: null,
    avatar_id: 'avatar-1',
    voice_id: 'voice-1',
    aspect_ratio: '16:9',
    channel: 'youtube',
    broll_asset_ids: [],
    ...overrides,
  }
}

describe('POST /api/admin/video-generation/jobs/batch-retry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication before fetching jobs', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(postRequest({ jobIds: [FAILED_JOB_ID] }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('rejects an empty or non-array jobIds payload', async () => {
    const empty = await POST(postRequest({ jobIds: [] }))
    expect(empty.status).toBe(400)
    await expect(empty.json()).resolves.toEqual({ error: 'No job IDs provided' })

    const missing = await POST(postRequest({}))
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({ error: 'No job IDs provided' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('caps retries at 20 ids and only loads failed, non-deleted jobs', async () => {
    const ids = Array.from({ length: 21 }, (_, index) => `job-${index}`)
    const inFilter = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ in: inFilter }),
    })

    const response = await POST(postRequest({ jobIds: ids }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'No failed jobs found among the provided IDs',
    })
    expect(inFilter).toHaveBeenCalledWith('id', ids.slice(0, 20))
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('soft-deletes a failed job and inserts a pending replacement after HeyGen succeeds', async () => {
    const eqStatus = vi.fn().mockReturnValue({
      is: vi.fn().mockResolvedValue({ data: [failedJob()], error: null }),
    })
    const selectIn = vi.fn().mockReturnValue({ eq: eqStatus })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const insert = vi.fn().mockResolvedValue({ error: null })

    mocks.from.mockImplementation((table: string) => {
      if (table !== 'video_generation_jobs') throw new Error(`Unexpected table: ${table}`)
      return {
        select: vi.fn().mockReturnValue({ in: selectIn }),
        update: vi.fn().mockReturnValue({ eq: updateEq }),
        insert,
      }
    })
    mocks.createVideo.mockResolvedValue({ videoId: 'heygen-new-1' })

    const response = await POST(postRequest({ jobIds: [FAILED_JOB_ID, EXTRA_JOB_ID] }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      retried: 1,
      failed: 0,
      errors: undefined,
      total: 1,
    })
    expect(eqStatus).toHaveBeenCalledWith('heygen_status', 'failed')
    expect(mocks.createVideo).toHaveBeenCalledWith({
      script: 'Hello world',
      avatarId: 'avatar-1',
      voiceId: 'voice-1',
      aspectRatio: '16:9',
    })
    expect(updateEq).toHaveBeenCalledWith('id', FAILED_JOB_ID)
    expect(insert).toHaveBeenCalledWith({
      script_source: 'manual',
      script_text: 'Hello world',
      drive_file_name: null,
      target_type: 'youtube',
      target_id: null,
      avatar_id: 'avatar-1',
      voice_id: 'voice-1',
      aspect_ratio: '16:9',
      channel: 'youtube',
      broll_asset_ids: [],
      heygen_video_id: 'heygen-new-1',
      heygen_status: 'pending',
    })
  })

  it('does not replace a job when HeyGen returns no video id', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: [failedJob()], error: null }),
          }),
        }),
      }),
      update: vi.fn(),
      insert: vi.fn(),
    })
    mocks.createVideo.mockResolvedValue({ error: 'quota exceeded' })

    const response = await POST(postRequest({ jobIds: [FAILED_JOB_ID] }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.retried).toBe(0)
    expect(body.failed).toBe(1)
    expect(body.errors[0]).toContain('quota exceeded')
    expect(mocks.from().update).not.toHaveBeenCalled()
    expect(mocks.from().insert).not.toHaveBeenCalled()
  })
})
