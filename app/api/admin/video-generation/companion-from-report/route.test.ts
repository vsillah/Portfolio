import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  createVideo: vi.fn(),
  buildVideoScriptFromContext: vi.fn(),
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

vi.mock('@/lib/video-script-from-context', () => ({
  buildVideoScriptFromContext: mocks.buildVideoScriptFromContext,
}))

vi.mock('@/lib/video-generation-rate-limit', () => ({
  isOverVideoGenerationLimit: mocks.isOverVideoGenerationLimit,
}))

vi.mock('@/lib/heygen-config', () => ({
  getHeyGenDefaults: mocks.getHeyGenDefaults,
}))

import { POST } from './route'

const SCRIPT = 'A short companion script.'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/video-generation/companion-from-report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function reportFetch(row: Record<string, unknown> | null, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data: row, error })
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ single })),
    })),
  }
}

function jobInsert() {
  const single = vi.fn().mockResolvedValue({
    data: {
      id: 'job-1',
      heygen_video_id: 'heygen-1',
      heygen_status: 'pending',
      created_at: '2026-09-27T10:00:00.000Z',
    },
    error: null,
  })
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  return { insert, select, single }
}

describe('POST /api/admin/video-generation/companion-from-report', () => {
  const envKeys = [
    'VIDEO_COMPANION_FROM_REPORT_ENABLED',
    'HEYGEN_TEMPLATE_ID',
    'HEYGEN_BRAND_VOICE_ID',
    'HEYGEN_AVATAR_ID',
    'HEYGEN_VOICE_ID',
  ] as const
  const originalEnv = new Map<string, string | undefined>()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    for (const key of envKeys) {
      originalEnv.set(key, process.env[key])
      delete process.env[key]
    }
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.isOverVideoGenerationLimit.mockResolvedValue(false)
    mocks.buildVideoScriptFromContext.mockResolvedValue(SCRIPT)
    mocks.getHeyGenDefaults.mockResolvedValue({ avatarId: 'default-avatar', voiceId: 'default-voice' })
    mocks.createVideo.mockResolvedValue({ videoId: 'heygen-1' })
  })

  afterEach(() => {
    for (const key of envKeys) {
      const value = originalEnv.get(key)
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('requires admin auth before the feature flag or rate limit', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)
    process.env.VIDEO_COMPANION_FROM_REPORT_ENABLED = 'false'

    const response = await POST(makeRequest({ reportType: 'audit_summary' }))

    expect(response.status).toBe(401)
    expect(mocks.isOverVideoGenerationLimit).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('blocks the feature flag before checking the user or the daily limit', async () => {
    process.env.VIDEO_COMPANION_FROM_REPORT_ENABLED = 'false'
    mocks.verifyAdmin.mockResolvedValue({ isAdmin: true })

    const response = await POST(makeRequest({ reportType: 'audit_summary' }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Companion video from report is not available.',
    })
    expect(mocks.isOverVideoGenerationLimit).not.toHaveBeenCalled()
  })

  it('rejects an admin session with no user id', async () => {
    mocks.verifyAdmin.mockResolvedValue({ user: {}, isAdmin: true })

    const response = await POST(makeRequest({ reportType: 'audit_summary' }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.isOverVideoGenerationLimit).not.toHaveBeenCalled()
  })

  it('stops at the daily limit before reading a report', async () => {
    mocks.isOverVideoGenerationLimit.mockResolvedValue(true)

    const response = await POST(makeRequest({ gammaReportId: 'report-1' }))

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({
      error: 'Daily video generation limit reached. Please try again tomorrow.',
    })
    expect(mocks.isOverVideoGenerationLimit).toHaveBeenCalledWith('admin-1')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a report id or report type, and treats a blank id as missing', async () => {
    const missing = await POST(makeRequest({}))
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({ error: 'gammaReportId or reportType is required' })

    const blankId = await POST(makeRequest({ gammaReportId: '   ' }))
    expect(blankId.status).toBe(400)
    await expect(blankId.json()).resolves.toEqual({ error: 'gammaReportId or reportType is required' })

    const invalid = await POST(makeRequest('not-json'))
    expect(invalid.status).toBe(400)

    const badType = await POST(makeRequest({ reportType: 'invoice' }))
    expect(badType.status).toBe(400)
    await expect(badType.json()).resolves.toEqual({ error: 'Invalid reportType' })
    expect(mocks.buildVideoScriptFromContext).not.toHaveBeenCalled()
  })

  it('returns 404 when the gamma report cannot be loaded', async () => {
    mocks.from.mockReturnValueOnce(reportFetch(null, { code: 'PGRST116' }))

    const response = await POST(makeRequest({ gammaReportId: ' report-1 ' }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Report not found' })
    expect(mocks.buildVideoScriptFromContext).not.toHaveBeenCalled()
  })

  it('rejects a generated script over 5,000 characters before calling HeyGen', async () => {
    mocks.buildVideoScriptFromContext.mockResolvedValue('x'.repeat(5001))

    const response = await POST(makeRequest({ reportType: 'audit_summary' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Generated script is too long. Try a different report or shorten context.',
    })
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('requires a template or both avatar and voice after defaults', async () => {
    mocks.getHeyGenDefaults.mockResolvedValue({ avatarId: '', voiceId: null })

    const response = await POST(makeRequest({
      reportType: 'value_quantification',
      avatarId: ' ',
      voiceId: '',
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'HeyGen template or avatar and voice must be configured. Set defaults via Admin → Video Generation → Settings.',
    })
    expect(mocks.getHeyGenDefaults).toHaveBeenCalled()
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('fills missing avatar and voice from defaults and creates a youtube job', async () => {
    const inserted = jobInsert()
    mocks.from.mockReturnValueOnce(inserted)

    const response = await POST(makeRequest({
      reportType: 'prospect_overview',
      contactSubmissionId: 12,
      templateId: ' ',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      jobId: 'job-1',
      heygenVideoId: 'heygen-1',
      status: 'pending',
      createdAt: '2026-09-27T10:00:00.000Z',
      gammaReportId: null,
    })
    expect(mocks.getHeyGenDefaults).toHaveBeenCalled()
    expect(mocks.createVideo).toHaveBeenCalledWith({
      script: SCRIPT,
      title: 'Companion video (prospect_overview)',
      aspectRatio: '16:9',
      channel: 'youtube',
      templateId: undefined,
      brandVoiceId: undefined,
      avatarId: 'default-avatar',
      voiceId: 'default-voice',
    })
    expect(inserted.insert).toHaveBeenCalledWith(expect.objectContaining({
      script_text: SCRIPT,
      avatar_id: 'default-avatar',
      voice_id: 'default-voice',
      aspect_ratio: '16:9',
      channel: 'youtube',
      heygen_video_id: 'heygen-1',
      heygen_status: 'pending',
      created_by: 'admin-1',
    }))
    expect(inserted.insert.mock.calls[0][0]).not.toHaveProperty('gamma_report_id')
  })

  it('loads report params, skips defaults when a template is set, and stamps the report id', async () => {
    const inserted = jobInsert()
    mocks.from
      .mockReturnValueOnce(reportFetch({
        report_type: 'implementation_strategy',
        contact_submission_id: 4,
        diagnostic_audit_id: null,
        value_report_id: 'value-1',
        proposal_id: null,
      }))
      .mockReturnValueOnce(inserted)
    process.env.HEYGEN_TEMPLATE_ID = 'env-template'

    const response = await POST(makeRequest({ gammaReportId: ' report-9 ' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ gammaReportId: 'report-9' })
    expect(mocks.buildVideoScriptFromContext).toHaveBeenCalledWith({
      reportType: 'implementation_strategy',
      contactSubmissionId: 4,
      diagnosticAuditId: undefined,
      valueReportId: 'value-1',
      proposalId: undefined,
    })
    expect(mocks.getHeyGenDefaults).not.toHaveBeenCalled()
    expect(mocks.createVideo).toHaveBeenCalledWith(expect.objectContaining({
      templateId: 'env-template',
      title: 'Companion video (implementation_strategy)',
    }))
    expect(inserted.insert).toHaveBeenCalledWith(expect.objectContaining({
      gamma_report_id: 'report-9',
      avatar_id: '',
      voice_id: '',
    }))
  })

  it('returns the HeyGen error and does not insert a job', async () => {
    mocks.createVideo.mockResolvedValue({ error: 'avatar unavailable' })
    process.env.HEYGEN_AVATAR_ID = 'avatar-1'
    process.env.HEYGEN_VOICE_ID = 'voice-1'

    const response = await POST(makeRequest({ reportType: 'audit_summary' }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'avatar unavailable' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns a generic error when HeyGen omits a video id or the job insert fails', async () => {
    mocks.createVideo.mockResolvedValue({})
    process.env.HEYGEN_AVATAR_ID = 'avatar-1'
    process.env.HEYGEN_VOICE_ID = 'voice-1'

    const missingId = await POST(makeRequest({ reportType: 'audit_summary' }))
    expect(missingId.status).toBe(500)
    await expect(missingId.json()).resolves.toEqual({
      error: 'Video generation did not return an ID. Please try again.',
    })

    mocks.createVideo.mockResolvedValue({ videoId: 'heygen-1' })
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } })
    mocks.from.mockReturnValue({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({ single })),
      })),
    })

    const insertFailed = await POST(makeRequest({ reportType: 'audit_summary' }))
    expect(insertFailed.status).toBe(500)
    await expect(insertFailed.json()).resolves.toEqual({
      error: 'Failed to create job record. Please try again.',
    })
  })

  it('returns a thrown string as the error body', async () => {
    mocks.isOverVideoGenerationLimit.mockRejectedValue('limit check down')

    const response = await POST(makeRequest({ reportType: 'audit_summary' }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'limit check down' })
  })
})
