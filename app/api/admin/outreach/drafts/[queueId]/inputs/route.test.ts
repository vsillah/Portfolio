/**
 * GET /api/admin/outreach/drafts/[queueId]/inputs — Phase 2
 *
 * Behavior pinned: admin auth required, queueId must be a UUID, response
 * normalises to camelCase, missing trace surfaces as `generationInputs: null`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  maybeSingle: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => mocks.maybeSingle(),
        }),
      }),
    }),
  },
}))

import { GET } from './route'

const VALID_UUID = '123e4567-e89b-42d3-a456-426614174000'

function req(queueId: string) {
  return new NextRequest(
    `http://localhost/api/admin/outreach/drafts/${queueId}/inputs`,
    { method: 'GET' },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.verifyAdmin.mockResolvedValue({ id: 'admin-1' })
  mocks.isAuthError.mockReturnValue(false)
})

describe('GET /api/admin/outreach/drafts/[queueId]/inputs', () => {
  it('returns the draft trace with camelCase keys when found', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: VALID_UUID,
        contact_submission_id: 99,
        channel: 'email',
        status: 'draft',
        sequence_step: 1,
        subject: 'Hello',
        created_at: '2026-04-27T10:00:00Z',
        generation_model: 'gpt-4o-mini',
        generation_prompt_summary: 'in_app:email_cold_outreach',
        generation_inputs: { template_key: 'email_cold_outreach', model: 'gpt-4o-mini' },
      },
      error: null,
    })
    const res = await GET(req(VALID_UUID), { params: { queueId: VALID_UUID } })
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.id).toBe(VALID_UUID)
    expect(body.contactSubmissionId).toBe(99)
    expect(body.channel).toBe('email')
    expect(body.generationModel).toBe('gpt-4o-mini')
    expect(body.generationPromptSummary).toBe('in_app:email_cold_outreach')
    expect(body.generationInputs).toEqual({
      template_key: 'email_cold_outreach',
      model: 'gpt-4o-mini',
    })
  })

  it('returns generationInputs: null for pre-Phase-2 / n8n drafts', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: VALID_UUID,
        contact_submission_id: 99,
        channel: 'email',
        status: 'draft',
        sequence_step: 1,
        subject: null,
        created_at: '2026-04-27T10:00:00Z',
        generation_model: null,
        generation_prompt_summary: null,
        generation_inputs: null,
      },
      error: null,
    })
    const res = await GET(req(VALID_UUID), { params: { queueId: VALID_UUID } })
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.generationInputs).toBeNull()
  })

  it('rejects non-UUID queue ids with 400', async () => {
    const res = await GET(req('not-a-uuid'), { params: { queueId: 'not-a-uuid' } })
    expect(res.status).toBe(400)
  })

  it('returns 404 when no row matches', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    const res = await GET(req(VALID_UUID), { params: { queueId: VALID_UUID } })
    expect(res.status).toBe(404)
  })

  it('returns 401 when not authorized', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)
    const res = await GET(req(VALID_UUID), { params: { queueId: VALID_UUID } })
    expect(res.status).toBe(401)
  })
})
