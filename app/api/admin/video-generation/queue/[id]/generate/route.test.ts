import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'path'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  createVideo: vi.fn(),
  captureBroll: vi.fn(),
  selectRoutesFromScript: vi.fn(),
  getHeyGenDefaults: vi.fn(),
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

vi.mock('@/lib/playtest-broll', () => ({
  captureBroll: mocks.captureBroll,
  selectRoutesFromScript: mocks.selectRoutesFromScript,
  DEFAULT_ROUTES: [{ path: '/demo' }],
}))

vi.mock('@/lib/heygen-config', () => ({
  getHeyGenDefaults: mocks.getHeyGenDefaults,
}))

import { POST } from './route'

const ENV_KEYS = ['HEYGEN_TEMPLATE_ID', 'HEYGEN_BRAND_VOICE_ID', 'HEYGEN_AVATAR_ID', 'HEYGEN_VOICE_ID', 'BASE_URL'] as const

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/video-generation/queue/q-1/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function queueQuery(result: { data: unknown; error: unknown }) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {}
  const chain = () => query
  for (const method of ['select', 'eq', 'insert', 'update']) {
    query[method] = vi.fn(chain)
  }
  query.single = vi.fn(() => Promise.resolve(result))
  query.then = vi.fn((onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected))
  return query
}

const params = { params: { id: 'q-1' } }

describe('POST /api/admin/video-generation/queue/[id]/generate', () => {
  const previousEnv = new Map<string, string | undefined>()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const key of ENV_KEYS) {
      previousEnv.set(key, process.env[key])
      delete process.env[key]
    }
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getHeyGenDefaults.mockResolvedValue({ avatarId: '', voiceId: '' })
    mocks.captureBroll.mockResolvedValue({ outputDir: '/tmp/broll' })
    mocks.selectRoutesFromScript.mockReturnValue([{ path: '/scripted' }])
    mocks.createVideo.mockResolvedValue({ videoId: 'hey-1' })
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = previousEnv.get(key)
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('requires admin authentication before loading the queue item', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request('{'), params)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('rejects a missing, non-pending, or blank-script queue item', async () => {
    mocks.from.mockReturnValueOnce(queueQuery({ data: null, error: { message: '0 rows' } }))
    const missing = await POST(request('{'), params)
    expect(missing.status).toBe(404)
    await expect(missing.json()).resolves.toEqual({ error: 'Queue item not found' })

    mocks.from.mockReturnValueOnce(queueQuery({
      data: { id: 'q-1', status: 'generated', script_text: 'Ready', drive_file_name: 'Episode.txt' },
      error: null,
    }))
    const generated = await POST(request({}), params)
    expect(generated.status).toBe(400)
    await expect(generated.json()).resolves.toEqual({ error: 'Queue item already generated' })

    mocks.from.mockReturnValueOnce(queueQuery({
      data: { id: 'q-1', status: 'pending', script_text: '   ', drive_file_name: 'Episode.txt' },
      error: null,
    }))
    const blank = await POST(request({}), params)
    expect(blank.status).toBe(400)
    await expect(blank.json()).resolves.toEqual({ error: 'Queue item has no script text' })
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('requires a template or avatar and voice, and blocks scripts over 5,000 characters', async () => {
    mocks.from.mockReturnValue(queueQuery({
      data: { id: 'q-1', status: 'pending', script_text: 'Hello there', drive_file_name: 'Episode.txt' },
      error: null,
    }))

    const missingDefaults = await POST(request({ includeBroll: false }), params)
    expect(missingDefaults.status).toBe(400)
    await expect(missingDefaults.json()).resolves.toEqual({
      error: 'Use template or provide avatarId and voiceId. Set defaults via Admin → Video Generation → Settings.',
    })
    expect(mocks.getHeyGenDefaults).toHaveBeenCalledOnce()

    mocks.from.mockReturnValue(queueQuery({
      data: {
        id: 'q-1',
        status: 'pending',
        script_text: 'x'.repeat(5001),
        drive_file_name: 'Episode.txt',
      },
      error: null,
    }))
    const overLimit = await POST(request({ templateId: 'tpl-1', includeBroll: false }), params)
    expect(overLimit.status).toBe(400)
    await expect(overLimit.json()).resolves.toEqual({
      error: 'Script exceeds HeyGen limit of 5000 characters (5001). Shorten or split.',
    })
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('fills saved defaults, skips b-roll when disabled, and still succeeds if the queue update fails', async () => {
    const jobInsert = queueQuery({
      data: {
        id: 'job-1',
        heygen_video_id: 'hey-1',
        heygen_status: 'pending',
        created_at: '2026-09-25T10:00:00.000Z',
      },
      error: null,
    })
    const queueUpdate = queueQuery({ data: null, error: { message: 'queue locked' } })
    const queueRead = queueQuery({
      data: {
        id: 'q-1',
        drive_file_id: 'drive-1',
        drive_file_name: 'Episode 1 script.txt',
        script_text: '  Say hello.  ',
        status: 'pending',
      },
      error: null,
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'drive_video_queue') {
        return queueRead.select.mock.calls.length === 0 ? queueRead : queueUpdate
      }
      if (table === 'video_generation_jobs') return jobInsert
      throw new Error(table)
    })
    mocks.getHeyGenDefaults.mockResolvedValue({ avatarId: 'avatar-default', voiceId: 'voice-default' })

    const response = await POST(request({ includeBroll: false }), params)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      jobId: 'job-1',
      heygenVideoId: 'hey-1',
      status: 'pending',
      createdAt: '2026-09-25T10:00:00.000Z',
    })
    expect(mocks.captureBroll).not.toHaveBeenCalled()
    expect(mocks.createVideo).toHaveBeenCalledWith(expect.objectContaining({
      script: 'Say hello.',
      title: 'Episode 1 script.txt',
      aspectRatio: '16:9',
      channel: 'youtube',
      avatarId: 'avatar-default',
      voiceId: 'voice-default',
    }))
    expect(jobInsert.insert).toHaveBeenCalledWith(expect.objectContaining({
      script_text: 'Say hello.',
      heygen_video_id: 'hey-1',
      created_by: 'admin-1',
      broll_output_path: null,
    }))
    expect(queueUpdate.update).toHaveBeenCalledWith({
      status: 'generated',
      video_generation_job_id: 'job-1',
    })
  })

  it('uses the channel aspect ratio and continues after b-roll failure without inserting a job', async () => {
    const tables: string[] = []
    const queueRead = queueQuery({
      data: {
        id: 'q-1',
        drive_file_id: 'drive-1',
        drive_file_name: 'Episode 1 script.txt',
        script_text: 'Short script',
        status: 'pending',
      },
      error: null,
    })
    mocks.from.mockImplementation((table: string) => {
      tables.push(table)
      return queueRead
    })
    mocks.captureBroll.mockRejectedValue(new Error('browser missing'))
    mocks.createVideo.mockResolvedValueOnce({ error: 'HeyGen quota exceeded' })

    const heygenError = await POST(request({
      channel: 'youtube_shorts',
      templateId: 'tpl-1',
      brollRoutes: 'script',
    }), params)

    expect(heygenError.status).toBe(500)
    await expect(heygenError.json()).resolves.toEqual({ error: 'HeyGen quota exceeded' })
    expect(tables).toEqual(['drive_video_queue'])
    expect(mocks.captureBroll).toHaveBeenCalledWith(expect.objectContaining({
      routes: [{ path: '/scripted' }],
      outputDir: path.join(process.cwd(), 'design-files', 'broll', 'episode-1-script', 'B-roll'),
      baseUrl: 'http://localhost:3000',
      noStartServer: true,
    }))
    expect(mocks.createVideo).toHaveBeenCalledWith(expect.objectContaining({
      aspectRatio: '9:16',
      channel: 'youtube_shorts',
      templateId: 'tpl-1',
    }))
  })

  it('rejects a HeyGen response without a video id and hides job insert failures', async () => {
    const queueRead = queueQuery({
      data: {
        id: 'q-1',
        drive_file_id: 'drive-1',
        drive_file_name: null,
        script_text: 'Short script',
        status: 'pending',
      },
      error: null,
    })
    mocks.from.mockReturnValue(queueRead)
    mocks.createVideo.mockResolvedValueOnce({})

    const noId = await POST(request({ templateId: 'tpl-1' }), params)
    expect(noId.status).toBe(500)
    await expect(noId.json()).resolves.toEqual({ error: 'HeyGen did not return a video ID' })
    expect(mocks.captureBroll).not.toHaveBeenCalled()

    mocks.createVideo.mockResolvedValueOnce({ videoId: 'hey-2' })
    const jobInsert = queueQuery({ data: null, error: { message: 'insert failed' } })
    mocks.from.mockImplementation((table: string) => (table === 'video_generation_jobs' ? jobInsert : queueRead))
    const insertFailed = await POST(request({ templateId: 'tpl-1', includeBroll: false }), params)
    expect(insertFailed.status).toBe(500)
    await expect(insertFailed.json()).resolves.toEqual({ error: 'Failed to create job record' })
  })
})
