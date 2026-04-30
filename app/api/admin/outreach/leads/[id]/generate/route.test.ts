import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  generateOutreachDraftInApp: vi.fn(),
  generateLinkedInDraftInApp: vi.fn(),
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
  generateLinkedInDraftInApp: mocks.generateLinkedInDraftInApp,
  isInAppOutreachGenerationEnabled: mocks.isInAppOutreachGenerationEnabled,
}))

vi.mock('@/lib/slack-outreach-notification', () => ({
  notifyOutreachDraftReady: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from './route'

type LeadRow = {
  id: number
  name: string
  email: string
  company: string | null
  rep_pain_points: string | null
  quick_wins: string | null
  do_not_contact: boolean
  removed_at: string | null
  lead_source: string
  last_n8n_outreach_status?: string | null
  last_n8n_outreach_triggered_at?: string | null
  last_n8n_outreach_template_key?: string | null
}

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/outreach/leads/42/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })
}

function mockContactSubmissions(lead: LeadRow | null) {
  mocks.from.mockImplementation((table: string) => {
    if (table === 'contact_submissions') {
      const updateEq = vi.fn().mockResolvedValue({ error: null })
      const update = vi.fn().mockReturnValue({ eq: updateEq })
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: lead,
                error: lead ? null : { message: 'not found' },
              })
            ),
          })),
        })),
        update,
      }
    }

    throw new Error(`Unexpected table: ${table}`)
  })
}

describe('POST /api/admin/outreach/leads/[id]/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ id: 'admin-user' })
    mocks.isAuthError.mockReturnValue(false)
    mocks.isInAppOutreachGenerationEnabled.mockReturnValue(true)
    mocks.generateOutreachDraftInApp.mockResolvedValue({
      outcome: 'created',
      id: 'queue-row-1',
      subject: 'Hello there',
      body: 'Draft body',
    })
  })

  it('returns auth error response when admin verification fails', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(), { params: { id: '42' } })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.generateOutreachDraftInApp).not.toHaveBeenCalled()
  })

  it('returns 400 when lead ID is invalid', async () => {
    const response = await POST(makeRequest(), { params: { id: 'not-a-number' } })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid lead ID' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('blocks outreach generation for do-not-contact leads', async () => {
    mockContactSubmissions({
      id: 42,
      name: 'Alice',
      email: 'alice@example.com',
      company: 'Acme',
      rep_pain_points: 'manual pain',
      quick_wins: 'quick win',
      do_not_contact: true,
      removed_at: null,
      lead_source: 'warm_referral',
    })

    const response = await POST(makeRequest(), { params: { id: '42' } })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Lead is marked as do-not-contact',
    })
    expect(mocks.generateOutreachDraftInApp).not.toHaveBeenCalled()
  })

  it('blocks outreach generation for removed leads', async () => {
    mockContactSubmissions({
      id: 42,
      name: 'Alice',
      email: 'alice@example.com',
      company: 'Acme',
      rep_pain_points: 'manual pain',
      quick_wins: 'quick win',
      do_not_contact: false,
      removed_at: '2026-04-15T00:00:00Z',
      lead_source: 'warm_referral',
    })

    const response = await POST(makeRequest(), { params: { id: '42' } })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Lead has been removed',
    })
    expect(mocks.generateOutreachDraftInApp).not.toHaveBeenCalled()
  })

  it('delegates to in-app generator and returns created payload', async () => {
    mockContactSubmissions({
      id: 42,
      name: 'Alice',
      email: 'alice@example.com',
      company: 'Acme',
      rep_pain_points: null,
      quick_wins: 'Automate weekly reporting',
      do_not_contact: false,
      removed_at: null,
      lead_source: 'warm_referral',
      last_n8n_outreach_status: null,
      last_n8n_outreach_triggered_at: null,
      last_n8n_outreach_template_key: null,
    })

    const response = await POST(makeRequest(), { params: { id: '42' } })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toMatchObject({
      triggered: true,
      queueCountImmediate: 1,
      outcome: 'created',
      id: 'queue-row-1',
      subject: 'Hello there',
    })
    expect(mocks.generateOutreachDraftInApp).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 42,
        sequenceStep: 1,
        force: false,
        meetingRecordId: null,
      })
    )
  })

  it('returns in-app fallback when generator reports LLM unavailable', async () => {
    mockContactSubmissions({
      id: 42,
      name: 'Alice',
      email: 'alice@example.com',
      company: 'Acme',
      rep_pain_points: 'manual pain',
      quick_wins: null,
      do_not_contact: false,
      removed_at: null,
      lead_source: 'warm_referral',
      last_n8n_outreach_status: null,
      last_n8n_outreach_triggered_at: null,
      last_n8n_outreach_template_key: null,
    })
    mocks.generateOutreachDraftInApp.mockRejectedValue(new Error('OPENAI_API_KEY not configured'))

    const response = await POST(makeRequest(), { params: { id: '42' } })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      triggered: false,
      fallback: 'in-app',
      error: 'Outreach generation is temporarily unavailable.',
    })
  })

  it('returns in-app fallback when generator throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockContactSubmissions({
      id: 42,
      name: 'Alice',
      email: 'alice@example.com',
      company: 'Acme',
      rep_pain_points: 'manual pain',
      quick_wins: null,
      do_not_contact: false,
      removed_at: null,
      lead_source: 'warm_referral',
      last_n8n_outreach_status: null,
      last_n8n_outreach_triggered_at: null,
      last_n8n_outreach_template_key: null,
    })
    mocks.generateOutreachDraftInApp.mockRejectedValue(new Error('boom'))

    const response = await POST(makeRequest(), { params: { id: '42' } })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      triggered: false,
      fallback: 'in-app',
      error: 'Could not generate the draft. Please try again.',
    })
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
