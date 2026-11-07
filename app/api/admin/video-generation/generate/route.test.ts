import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  createVideo: vi.fn(),
  fetchVideoContextByEmail: vi.fn(),
  fetchVideoContext: vi.fn(),
  isOverVideoGenerationLimit: vi.fn(),
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

vi.mock('@/lib/video-context', () => ({
  fetchVideoContextByEmail: mocks.fetchVideoContextByEmail,
  fetchVideoContext: mocks.fetchVideoContext,
}))

vi.mock('@/lib/video-generation-rate-limit', () => ({
  isOverVideoGenerationLimit: mocks.isOverVideoGenerationLimit,
}))

vi.mock('@/lib/heygen-config', () => ({
  getHeyGenDefaults: mocks.getHeyGenDefaults,
}))

import { POST } from './route'

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/video-generation/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function jobInsert(result: { data?: unknown; error?: unknown }) {
  const single = vi.fn().mockResolvedValue(result)
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  mocks.from.mockReturnValue({ insert })
  return { insert, select, single }
}

describe('POST /api/admin/video-generation/generate', () => {
  const originalHeygen = {
    HEYGEN_TEMPLATE_ID: process.env.HEYGEN_TEMPLATE_ID,
    HEYGEN_AVATAR_ID: process.env.HEYGEN_AVATAR_ID,
    HEYGEN_VOICE_ID: process.env.HEYGEN_VOICE_ID,
    HEYGEN_BRAND_VOICE_ID: process.env.HEYGEN_BRAND_VOICE_ID,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    delete process.env.HEYGEN_TEMPLATE_ID
    delete process.env.HEYGEN_AVATAR_ID
    delete process.env.HEYGEN_VOICE_ID
    delete process.env.HEYGEN_BRAND_VOICE_ID
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.isOverVideoGenerationLimit.mockResolvedValue(false)
    mocks.getHeyGenDefaults.mockResolvedValue({ avatarId: null, voiceId: null })
    mocks.createVideo.mockResolvedValue({ videoId: 'heygen-1' })
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(originalHeygen)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('rejects unauthenticated requests before rate-limiting or calling HeyGen', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ scriptText: 'Hello' }))

    expect(response.status).toBe(401)
    expect(mocks.isOverVideoGenerationLimit).not.toHaveBeenCalled()
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('returns 429 when the daily generation limit is reached', async () => {
    mocks.isOverVideoGenerationLimit.mockResolvedValue(true)

    const response = await POST(request({ scriptText: 'Hello' }))

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({
      error: 'Daily video generation limit reached. Please try again tomorrow.',
    })
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('rejects invalid scriptSource values', async () => {
    const response = await POST(
      request({ scriptSource: 'youtube', scriptText: 'Hello', avatarId: 'a', voiceId: 'v' }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid scriptSource' })
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('requires a template or avatar+voice when no defaults exist', async () => {
    const response = await POST(request({ scriptText: 'Hello there' }))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Use template or provide avatarId and voiceId')
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('requires scriptText when email/target context is missing', async () => {
    const response = await POST(request({ avatarId: 'avatar-1', voiceId: 'voice-1' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'scriptText is required or provide email/target for context',
    })
  })

  it('rejects scripts over the HeyGen character limit', async () => {
    const response = await POST(
      request({
        avatarId: 'avatar-1',
        voiceId: 'voice-1',
        scriptText: 'x'.repeat(5001),
      }),
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Script exceeds HeyGen limit of 5000 characters (5001)')
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('builds a script from email context when scriptText is omitted', async () => {
    mocks.fetchVideoContextByEmail.mockResolvedValue({
      found: true,
      project: { client_name: 'Ada', client_company: 'Acme' },
      diagnostic_audits: [{ diagnostic_summary: 'Ops is manual.' }],
    })
    jobInsert({
      data: {
        id: 'job-1',
        heygen_video_id: 'heygen-1',
        heygen_status: 'pending',
        created_at: '2026-09-20T00:00:00Z',
      },
      error: null,
    })

    const response = await POST(
      request({
        avatarId: 'avatar-1',
        voiceId: 'voice-1',
        email: 'ADA@Acme.COM',
      }),
    )

    expect(response.status).toBe(200)
    expect(mocks.fetchVideoContextByEmail).toHaveBeenCalledWith('ada@acme.com')
    expect(mocks.createVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        script: 'Hi Ada, Thanks for your interest in working with Acme. Based on our conversation: Ops is manual.',
        avatarId: 'avatar-1',
        voiceId: 'voice-1',
        channel: 'youtube',
      }),
    )
  })

  it('only forwards caption/includeGif/enableSharing when they are boolean true', async () => {
    jobInsert({
      data: {
        id: 'job-1',
        heygen_video_id: 'heygen-1',
        heygen_status: 'pending',
        created_at: '2026-09-20T00:00:00Z',
      },
      error: null,
    })

    await POST(
      request({
        avatarId: 'avatar-1',
        voiceId: 'voice-1',
        scriptText: 'Hello',
        caption: 'true',
        includeGif: false,
        enableSharing: true,
      }),
    )

    expect(mocks.createVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        caption: undefined,
        includeGif: undefined,
        enableSharing: true,
      }),
    )
  })

  it('inserts a pending job after HeyGen returns a video id', async () => {
    const { insert } = jobInsert({
      data: {
        id: 'job-1',
        heygen_video_id: 'heygen-1',
        heygen_status: 'pending',
        created_at: '2026-09-20T00:00:00Z',
      },
      error: null,
    })

    const response = await POST(
      request({
        avatarId: 'avatar-1',
        voiceId: 'voice-1',
        scriptText: 'Hello',
        title: 'Launch clip',
        channel: 'linkedin',
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      jobId: 'job-1',
      heygenVideoId: 'heygen-1',
      status: 'pending',
      createdAt: '2026-09-20T00:00:00Z',
    })
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        script_source: 'manual',
        script_text: 'Hello',
        avatar_id: 'avatar-1',
        voice_id: 'voice-1',
        channel: 'linkedin',
        heygen_video_id: 'heygen-1',
        heygen_status: 'pending',
        created_by: 'admin-user-1',
      }),
    )
  })

  it('returns HeyGen errors as 500 without inserting a job', async () => {
    mocks.createVideo.mockResolvedValue({ error: 'quota exceeded' })

    const response = await POST(
      request({ avatarId: 'avatar-1', voiceId: 'voice-1', scriptText: 'Hello' }),
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'quota exceeded' })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
