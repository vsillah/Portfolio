import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  generateOutreachDraftInApp: vi.fn(),
  isInAppOutreachGenerationEnabled: vi.fn(),
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

vi.mock('@/lib/outreach-queue-generator', () => ({
  generateOutreachDraftInApp: mocks.generateOutreachDraftInApp,
  isInAppOutreachGenerationEnabled: mocks.isInAppOutreachGenerationEnabled,
  MEETING_SUMMARY_MAX_CHARS: 8000,
}))

import { POST } from './route'

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/outreach/leads/42/generate-in-app', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function params(id: string) {
  return { params: { id } }
}

describe('POST /api/admin/outreach/leads/[id]/generate-in-app', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.isInAppOutreachGenerationEnabled.mockReturnValue(true)
    mocks.generateOutreachDraftInApp.mockResolvedValue({
      outcome: 'created',
      id: 'queue-1',
      subject: 'Draft subject',
    })
    const eq = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({
      update: vi.fn().mockReturnValue({ eq }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    })
  })

  it('returns auth error when admin verification fails', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({}), params('42'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.generateOutreachDraftInApp).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid lead id', async () => {
    const response = await POST(makeRequest({}), params('0'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid lead ID' })
    expect(mocks.generateOutreachDraftInApp).not.toHaveBeenCalled()
  })

  it('returns 503 when in-app generation is disabled', async () => {
    mocks.isInAppOutreachGenerationEnabled.mockReturnValue(false)

    const response = await POST(makeRequest({}), params('42'))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'This action is temporarily unavailable. Please try again later.',
    })
    expect(mocks.generateOutreachDraftInApp).not.toHaveBeenCalled()
  })

  it('rejects meeting summaries over the character cap', async () => {
    const response = await POST(
      makeRequest({ meeting_summary: 'x'.repeat(8001) }),
      params('42'),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Meeting summary must be at most 8000 characters.',
    })
    expect(mocks.generateOutreachDraftInApp).not.toHaveBeenCalled()
  })

  it('clamps sequence_step to 1-6 and treats missing JSON as empty body', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/admin/outreach/leads/42/generate-in-app', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      }),
      params('42'),
    )

    expect(response.status).toBe(200)
    expect(mocks.generateOutreachDraftInApp).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 42,
        sequenceStep: 1,
        force: false,
        meetingSummary: null,
        meetingRecordId: null,
        includeLatestMeeting: true,
      }),
    )
    await expect(response.json()).resolves.toEqual({
      outcome: 'created',
      id: 'queue-1',
      subject: 'Draft subject',
    })
  })

  it('passes force, skip_meeting_context, and meeting_record_id through', async () => {
    await POST(
      makeRequest({
        sequence_step: 4,
        force: true,
        skip_meeting_context: true,
        meeting_record_id: '  rec-9  ',
        meeting_summary: 'notes',
      }),
      params('42'),
    )

    expect(mocks.generateOutreachDraftInApp).toHaveBeenCalledWith({
      contactId: 42,
      sequenceStep: 4,
      force: true,
      meetingSummary: 'notes',
      meetingRecordId: 'rec-9',
      includeLatestMeeting: false,
    })
  })

  it('returns existing draft metadata when a queue row already exists', async () => {
    mocks.generateOutreachDraftInApp.mockResolvedValue({
      outcome: 'existing',
      queueId: 'queue-existing',
      templateKey: 'email_cold_outreach',
    })
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'em-1' }, error: null })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      }),
    })

    const response = await POST(makeRequest({}), params('42'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      outcome: 'existing',
      queueId: 'queue-existing',
      templateKey: 'email_cold_outreach',
      emailMessageId: 'em-1',
      openDraftUrl: '/admin/email-messages/em-1',
    })
  })

  it('returns 409 when generation is skipped because a draft already exists', async () => {
    mocks.generateOutreachDraftInApp.mockResolvedValue({
      outcome: 'skipped',
      reason: 'draft_exists',
    })

    const response = await POST(makeRequest({}), params('42'))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'A draft is already linked to this source. Open Email center or use force to add another copy.',
      outcome: 'skipped',
      reason: 'draft_exists',
    })
  })

  it.each([
    ['Lead not found', 404, 'Lead not found'],
    ['Lead is marked as do-not-contact', 400, 'Lead is marked as do-not-contact'],
    ['Lead has been removed', 400, 'Lead has been removed'],
    ['Meeting not found for this lead', 400, 'The selected meeting was not found for this lead.'],
    ['OPENAI_API_KEY not configured', 503, 'Something went wrong. Please try again later.'],
    ['boom', 500, 'Something went wrong. Please try again.'],
  ])('maps generator error %s to HTTP %s', async (message, status, error) => {
    mocks.generateOutreachDraftInApp.mockRejectedValue(new Error(message))

    const response = await POST(makeRequest({}), params('42'))

    expect(response.status).toBe(status)
    await expect(response.json()).resolves.toEqual({ error })
  })
})
