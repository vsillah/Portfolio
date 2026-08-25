import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  generateOutreachDraftInApp: vi.fn(),
  generateLinkedInDraftInApp: vi.fn(),
  isInAppOutreachGenerationEnabled: vi.fn(),
  startAgentRun: vi.fn(),
  recordAgentStep: vi.fn(),
  recordAgentEvent: vi.fn(),
  endAgentRun: vi.fn(),
  markAgentRunFailed: vi.fn(),
  notifyOutreachDraftReady: vi.fn(),
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
  notifyOutreachDraftReady: mocks.notifyOutreachDraftReady,
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  recordAgentStep: mocks.recordAgentStep,
  recordAgentEvent: mocks.recordAgentEvent,
  endAgentRun: mocks.endAgentRun,
  markAgentRunFailed: mocks.markAgentRunFailed,
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

function makeRequest(body: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/admin/outreach/leads/42/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
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
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.isInAppOutreachGenerationEnabled.mockReturnValue(true)
    mocks.generateOutreachDraftInApp.mockResolvedValue({
      outcome: 'created',
      id: 'queue-row-1',
      subject: 'Hello there',
      body: 'Draft body',
    })
    mocks.startAgentRun.mockResolvedValue({ id: 'agent-run-1' })
    mocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
    mocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })
    mocks.endAgentRun.mockResolvedValue({ id: 'agent-run-1' })
    mocks.markAgentRunFailed.mockResolvedValue({ id: 'agent-run-1' })
    mocks.notifyOutreachDraftReady.mockResolvedValue(undefined)
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

  it('accepts a warm relationship packet for email draft generation', async () => {
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

    const response = await POST(makeRequest({
      warm_relationship: {
        version: 'warm-outreach-relationship/v1',
        contactId: 42,
        contactName: 'Alice',
        objective: 'Prepare a warm email draft.',
        relationshipBasis: 'Existing warm referral in Portfolio.',
        sourceRefs: [
          {
            sourceType: 'portfolio_contact',
            sourceId: '42',
            summary: 'Warm referral record.',
            privateSource: false,
          },
        ],
        confidence: 'high',
        suppression: {
          doNotContact: false,
          unsubscribed: false,
        },
        channelCapabilities: {
          email: {
            available: true,
            providerConfigured: true,
            supportsExternalSend: false,
            manualOnly: false,
          },
        },
        preferredChannel: 'email',
      },
    }), { params: { id: '42' } })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toMatchObject({
      triggered: true,
      outcome: 'created',
      warmRelationshipReadiness: {
        selectedChannel: 'email',
        humanReviewRequired: true,
        approvalBoundary: 'draft_only_no_external_send',
      },
    })
    expect(mocks.generateOutreachDraftInApp).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 42,
        warmRelationshipSummary: expect.objectContaining({
          selected_channel: 'email',
          recommended_template: expect.any(String),
          human_review_required: true,
        }),
      }),
    )
    expect(mocks.notifyOutreachDraftReady).not.toHaveBeenCalled()
    expect(mocks.recordAgentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'notification_skipped',
        message: expect.stringContaining('Slack notification skipped'),
      }),
    )
  })

  it('blocks suppressed warm relationship packets before generation starts', async () => {
    const response = await POST(makeRequest({
      warm_relationship: {
        version: 'warm-outreach-relationship/v1',
        contactId: 42,
        objective: 'Prepare a warm email draft.',
        relationshipBasis: 'Existing warm referral in Portfolio.',
        sourceRefs: [
          {
            sourceType: 'portfolio_contact',
            sourceId: '42',
            summary: 'Warm referral record.',
            privateSource: false,
          },
        ],
        suppression: {
          doNotContact: true,
          unsubscribed: false,
          suppressionReason: 'Contact is marked do not contact in Portfolio.',
        },
        channelCapabilities: {
          email: {
            available: true,
            providerConfigured: false,
            supportsExternalSend: false,
            manualOnly: false,
          },
        },
        preferredChannel: 'email',
      },
    }), { params: { id: '42' } })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Contact is marked do not contact in Portfolio.',
      warmRelationshipReadiness: {
        status: 'blocked',
      },
    })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.generateOutreachDraftInApp).not.toHaveBeenCalled()
    expect(mocks.notifyOutreachDraftReady).not.toHaveBeenCalled()
  })

  it('blocks warm relationship packets for a different lead before generation starts', async () => {
    const response = await POST(makeRequest({
      warm_relationship: {
        version: 'warm-outreach-relationship/v1',
        contactId: 99,
        objective: 'Prepare a warm email draft.',
        relationshipBasis: 'Existing warm referral in Portfolio.',
        sourceRefs: [
          {
            sourceType: 'portfolio_contact',
            sourceId: '99',
            summary: 'Warm referral record.',
            privateSource: false,
          },
        ],
        channelCapabilities: {
          email: {
            available: true,
            providerConfigured: true,
            supportsExternalSend: false,
            manualOnly: false,
          },
        },
        preferredChannel: 'email',
      },
    }), { params: { id: '42' } })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Warm relationship packet does not match this lead.',
    })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.generateOutreachDraftInApp).not.toHaveBeenCalled()
  })

  it('keeps unsupported warm relationship channels manual', async () => {
    const response = await POST(makeRequest({
      warm_relationship: {
        version: 'warm-outreach-relationship/v1',
        contactId: 42,
        objective: 'Prepare a warm Facebook draft.',
        relationshipBasis: 'Existing Facebook relationship in Portfolio.',
        sourceRefs: [
          {
            sourceType: 'facebook',
            summary: 'Facebook relationship is recorded.',
            privateSource: true,
          },
        ],
        channelCapabilities: {
          facebook: {
            available: true,
            providerConfigured: false,
            supportsExternalSend: false,
            manualOnly: true,
          },
        },
        preferredChannel: 'facebook',
      },
    }), { params: { id: '42' } })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('email and LinkedIn only'),
    })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.generateOutreachDraftInApp).not.toHaveBeenCalled()
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
