import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

const FROZEN_NOW = '2026-10-08T10:00:00.000Z'

type Job = {
  id: string
  script_source: string
  script_text: string
  drive_file_name: string | null
  target_type: string
  target_id: string | null
  avatar_id: string | null
  voice_id: string | null
  aspect_ratio: string | null
  channel: string
  broll_asset_ids: string[] | null
}

const calls = {
  tables: [] as string[],
  inIds: [] as string[],
  filters: [] as unknown[],
  updates: [] as Array<{ payload: unknown; eq: unknown[] }>,
  inserts: [] as unknown[],
}

function ordinaryJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'abcd1234-ordinary-job',
    script_source: 'llm_generated',
    script_text: 'The problem is a slow handoff. I built the workflow so the team can act. Join the workshop.',
    drive_file_name: 'Evergreen',
    target_type: 'evergreen',
    target_id: 'target-1',
    avatar_id: 'avatar-1',
    voice_id: 'voice-1',
    aspect_ratio: '9:16',
    channel: 'youtube',
    broll_asset_ids: ['b1'],
    ...overrides,
  }
}

function jobsClient(result: { data: Job[] | null; error: { message: string } | null }) {
  return {
    select: () => ({
      in: (_column: string, ids: string[]) => {
        calls.inIds = ids
        return {
          eq: (column: string, value: unknown) => {
            calls.filters.push([column, value])
            return {
              is: (deletedColumn: string, deletedValue: unknown) => {
                calls.filters.push([deletedColumn, deletedValue])
                return Promise.resolve(result)
              },
            }
          },
        }
      },
    }),
    update: (payload: unknown) => ({
      eq: (column: string, value: unknown) => {
        calls.updates.push({ payload, eq: [column, value] })
        return Promise.resolve({ error: null })
      },
    }),
    insert: (payload: unknown) => {
      calls.inserts.push(payload)
      return Promise.resolve({ error: null })
    },
  }
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/video-generation/jobs/batch-retry', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/admin/video-generation/jobs/batch-retry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    calls.tables = []
    calls.inIds = []
    calls.filters = []
    calls.updates = []
    calls.inserts = []
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.createVideo.mockResolvedValue({ videoId: 'vid-new' })
    mocks.from.mockImplementation((table: string) => {
      calls.tables.push(table)
      return jobsClient({ data: [], error: null })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects an unauthenticated retry before reading jobs or calling HeyGen', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({ jobIds: ['abcd1234-ordinary-job'] }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('rejects an empty or non-array job list before querying', async () => {
    for (const body of [{ jobIds: [] }, { jobIds: 'abcd1234' }, 'not-json']) {
      calls.tables = []
      const response = await POST(makeRequest(body))
      expect(response.status).toBe(400)
      expect((await response.json()).error).toBe('No job IDs provided')
    }
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('queries only failed, undeleted jobs and caps the batch at 20 ids', async () => {
    const ids = Array.from({ length: 25 }, (_, index) => `job-${String(index).padStart(2, '0')}-extra`)
    mocks.from.mockImplementation((table: string) => {
      calls.tables.push(table)
      return jobsClient({ data: [], error: null })
    })

    const response = await POST(makeRequest({ jobIds: ids }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('No failed jobs found among the provided IDs')
    expect(calls.tables).toEqual(['video_generation_jobs'])
    expect(calls.inIds).toEqual(ids.slice(0, 20))
    expect(calls.filters).toEqual([['heygen_status', 'failed'], ['deleted_at', null]])
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('hides the database message when failed jobs cannot be loaded', async () => {
    mocks.from.mockImplementation((table: string) => {
      calls.tables.push(table)
      return jobsClient({ data: null, error: { message: 'relation video_generation_jobs is missing' } })
    })

    const response = await POST(makeRequest({ jobIds: ['abcd1234-ordinary-job'] }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'Failed to fetch failed jobs' })
    expect(JSON.stringify(body)).not.toContain('relation')
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('does not resubmit campaign jobs and still retries an ordinary failed job', async () => {
    const ordinary = ordinaryJob()
    const campaignTarget = ordinaryJob({
      id: 'campaaaa-target-lineage',
      script_source: 'manual',
      target_type: 'campaign',
      target_id: 'campaign-secret',
      script_text: 'Campaign target script that must not reach the provider.',
    })
    const campaignSource = ordinaryJob({
      id: 'srcbbbbb-source-lineage',
      script_source: 'campaign',
      target_type: 'newsletter',
      script_text: 'Campaign source script that must not reach the provider.',
    })
    mocks.from.mockImplementation((table: string) => {
      calls.tables.push(table)
      return jobsClient({ data: [campaignTarget, ordinary, campaignSource], error: null })
    })

    const response = await POST(makeRequest({
      jobIds: [campaignTarget.id, ordinary.id, campaignSource.id],
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      retried: 1,
      failed: 2,
      errors: [
        'Job campaaaa: reopen the linked Social Content editorial review before a campaign retry.',
        'Job srcbbbbb: reopen the linked Social Content editorial review before a campaign retry.',
      ],
      total: 3,
    })
    expect(JSON.stringify(body)).not.toContain('campaaaa-target-lineage')
    expect(JSON.stringify(body)).not.toContain('campaign-secret')
    expect(mocks.createVideo).toHaveBeenCalledTimes(1)
    expect(mocks.createVideo).toHaveBeenCalledWith({
      script: ordinary.script_text,
      avatarId: 'avatar-1',
      voiceId: 'voice-1',
      aspectRatio: '9:16',
    })
    expect(calls.updates).toEqual([{ payload: { deleted_at: FROZEN_NOW }, eq: ['id', ordinary.id] }])
    expect(calls.inserts).toEqual([{
      script_source: ordinary.script_source,
      script_text: ordinary.script_text,
      drive_file_name: ordinary.drive_file_name,
      target_type: ordinary.target_type,
      target_id: ordinary.target_id,
      avatar_id: ordinary.avatar_id,
      voice_id: ordinary.voice_id,
      aspect_ratio: ordinary.aspect_ratio,
      channel: ordinary.channel,
      broll_asset_ids: ordinary.broll_asset_ids,
      heygen_video_id: 'vid-new',
      heygen_status: 'pending',
    }])
  })

  it('keeps the failed job when HeyGen returns no video id', async () => {
    const ordinary = ordinaryJob({ avatar_id: null, voice_id: null, aspect_ratio: null })
    mocks.createVideo.mockResolvedValue({ error: 'No video ID returned', videoId: null })
    mocks.from.mockImplementation((table: string) => {
      calls.tables.push(table)
      return jobsClient({ data: [ordinary], error: null })
    })

    const response = await POST(makeRequest({ jobIds: [ordinary.id] }))
    const body = await response.json()

    expect(body).toEqual({
      retried: 0,
      failed: 1,
      errors: ['Job abcd1234: No video ID returned'],
      total: 1,
    })
    expect(mocks.createVideo).toHaveBeenCalledWith({
      script: ordinary.script_text,
      avatarId: undefined,
      voiceId: undefined,
      aspectRatio: '16:9',
    })
    expect(calls.updates).toEqual([])
    expect(calls.inserts).toEqual([])
  })

  it('continues the batch when one provider call throws', async () => {
    const first = ordinaryJob({ id: 'throw123-first-job' })
    const second = ordinaryJob({ id: 'retry234-second-job', script_text: 'Second spoken script. The problem stays visible. Join the workshop.' })
    mocks.createVideo
      .mockRejectedValueOnce(new Error('provider timeout'))
      .mockResolvedValueOnce({ videoId: 'vid-second' })
    mocks.from.mockImplementation((table: string) => {
      calls.tables.push(table)
      return jobsClient({ data: [first, second], error: null })
    })

    const response = await POST(makeRequest({ jobIds: [first.id, second.id] }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.retried).toBe(1)
    expect(body.failed).toBe(1)
    expect(body.errors).toEqual(['Job throw123: provider timeout'])
    expect(body.total).toBe(2)
    expect(calls.updates).toEqual([{ payload: { deleted_at: FROZEN_NOW }, eq: ['id', second.id] }])
    expect(calls.inserts).toHaveLength(1)
    expect(calls.inserts[0]).toMatchObject({ heygen_video_id: 'vid-second', script_text: second.script_text })
  })
})
