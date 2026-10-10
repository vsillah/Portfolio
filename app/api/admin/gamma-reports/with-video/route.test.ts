import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  fetchReportAndVideoContext: vi.fn(),
  generateGamma: vi.fn(),
  buildVideoScriptFromVideoContext: vi.fn(),
  createVideo: vi.fn(),
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

vi.mock('@/lib/gamma-report-builder', () => ({
  fetchReportAndVideoContext: mocks.fetchReportAndVideoContext,
}))

vi.mock('@/lib/gamma-client', () => ({
  generateGamma: mocks.generateGamma,
}))

vi.mock('@/lib/video-script-from-context', () => ({
  buildVideoScriptFromVideoContext: mocks.buildVideoScriptFromVideoContext,
}))

vi.mock('@/lib/heygen', () => ({
  createVideo: mocks.createVideo,
}))

vi.mock('@/lib/video-generation-rate-limit', () => ({
  isOverVideoGenerationLimit: mocks.isOverVideoGenerationLimit,
}))

vi.mock('@/lib/heygen-config', () => ({
  getHeyGenDefaults: mocks.getHeyGenDefaults,
}))

import { POST } from './route'

function makeRequest(body?: unknown, raw?: string) {
  return new NextRequest('http://localhost/api/admin/gamma-reports/with-video', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw ?? JSON.stringify(body ?? { reportType: 'audit_summary' }),
  })
}

function mockInsertReport(result: { data: { id: string } | null; error: unknown }) {
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq: updateEq })
  const insert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue(result),
    }),
  })
  mocks.from.mockReturnValue({ insert, update })
  return { insert, update }
}

describe('POST /api/admin/gamma-reports/with-video', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env = { ...originalEnv }
    delete process.env.VIDEO_REPORT_PLUS_VIDEO_ENABLED
    delete process.env.HEYGEN_TEMPLATE_ID
    delete process.env.HEYGEN_AVATAR_ID
    delete process.env.HEYGEN_VOICE_ID
    delete process.env.HEYGEN_BRAND_VOICE_ID
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.isOverVideoGenerationLimit.mockResolvedValue(false)
    mocks.fetchReportAndVideoContext.mockResolvedValue({
      gammaInput: {
        title: 'Audit summary',
        inputText: 'Deck input',
        options: { format: 'presentation' },
        citationsMeta: [],
        feasibilityAssessment: null,
      },
      videoScriptContext: { beats: [] },
    })
    mocks.buildVideoScriptFromVideoContext.mockReturnValue('Short companion script.')
    mocks.getHeyGenDefaults.mockResolvedValue({ avatarId: null, voiceId: null })
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns the auth error when the caller is not an admin', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.fetchReportAndVideoContext).not.toHaveBeenCalled()
  })

  it('returns 403 when report + video is explicitly disabled', async () => {
    process.env.VIDEO_REPORT_PLUS_VIDEO_ENABLED = 'false'

    const response = await POST(makeRequest())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Report + video is not available.',
    })
    expect(mocks.isOverVideoGenerationLimit).not.toHaveBeenCalled()
  })

  it('returns 429 when the admin is over the daily video limit', async () => {
    mocks.isOverVideoGenerationLimit.mockResolvedValue(true)

    const response = await POST(makeRequest())

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({
      error: 'Daily video generation limit reached. Please try again tomorrow.',
    })
    expect(mocks.fetchReportAndVideoContext).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON before touching Gamma', async () => {
    const response = await POST(makeRequest(undefined, '{'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' })
    expect(mocks.fetchReportAndVideoContext).not.toHaveBeenCalled()
  })

  it('requires a reportType', async () => {
    const response = await POST(makeRequest({}))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'reportType is required' })
    expect(mocks.fetchReportAndVideoContext).not.toHaveBeenCalled()
  })

  it('rejects an unknown reportType', async () => {
    const response = await POST(makeRequest({ reportType: 'offer_presentation' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error:
        'Invalid reportType. Must be one of: value_quantification, implementation_strategy, audit_summary, prospect_overview',
    })
  })

  it('rejects an unknown calendlyEventKey', async () => {
    const response = await POST(
      makeRequest({ reportType: 'audit_summary', calendlyEventKey: 'not-a-real-event' })
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Invalid calendlyEventKey')
    expect(mocks.fetchReportAndVideoContext).not.toHaveBeenCalled()
  })

  it('returns 502 and does not start video when Gamma fails after insert', async () => {
    const { update } = mockInsertReport({ data: { id: 'report-1' }, error: null })
    mocks.generateGamma.mockRejectedValue(new Error('Gamma start failed'))

    const response = await POST(makeRequest({ reportType: 'audit_summary' }))

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to start Gamma report. Video was not started.',
    })
    expect(update).toHaveBeenCalledWith({
      status: 'failed',
      error_message: 'Gamma start failed',
    })
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('starts the report and skips video when HeyGen is not configured', async () => {
    mockInsertReport({ data: { id: 'report-1' }, error: null })
    mocks.generateGamma.mockResolvedValue({ generationId: 'gamma-1' })

    const response = await POST(makeRequest({ reportType: 'audit_summary' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      reportId: 'report-1',
      gammaGenerationId: 'gamma-1',
      message: 'Report started. Video skipped (HeyGen not configured).',
    })
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })
})
