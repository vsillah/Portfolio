/**
 * POST /api/webhooks/n8n/outreach-followup-trigger — Phase 4
 *
 * Replaces the dead `WF-CLG-002` (`clg-outreach-gen`) webhook that
 * `WF-CLG-003: Send and Follow-Up` used to call after the 4-day no-reply
 * branch. Verifies bearer auth, body validation (template_key vs.
 * EMAIL_TEMPLATE_KEYS, sequence_step bounds, missing contact_submission_id),
 * lead-status gating (DNC + removed_at), generator outcomes (created /
 * existing / skipped), sequence-step clamping, provider-key failures, and the
 * Slack-notify side-effect for newly created drafts.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  generateOutreachDraftInApp: vi.fn(),
  isInAppOutreachGenerationEnabled: vi.fn(),
  notifyOutreachDraftReady: vi.fn(),
  contactSelectSingle: vi.fn(),
  contactUpdateEq: vi.fn(),
}))

vi.mock('@/lib/outreach-queue-generator', () => ({
  generateOutreachDraftInApp: mocks.generateOutreachDraftInApp,
  isInAppOutreachGenerationEnabled: mocks.isInAppOutreachGenerationEnabled,
}))

vi.mock('@/lib/slack-outreach-notification', () => ({
  notifyOutreachDraftReady: mocks.notifyOutreachDraftReady,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => mocks.contactSelectSingle(),
        }),
      }),
      update: () => ({
        eq: (col: string, val: unknown) => mocks.contactUpdateEq(col, val),
      }),
    }),
  },
}))

import { POST } from './route'

function makeReq(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(
    'http://localhost/api/webhooks/n8n/outreach-followup-trigger',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer test-secret',
        ...headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.N8N_INGEST_SECRET = 'test-secret'
  mocks.isInAppOutreachGenerationEnabled.mockReturnValue(true)
  mocks.contactSelectSingle.mockResolvedValue({
    data: {
      id: 42,
      name: 'Jane Doe',
      email: 'jane@example.com',
      do_not_contact: false,
      removed_at: null,
    },
    error: null,
  })
  mocks.contactUpdateEq.mockResolvedValue({ data: null, error: null })
  mocks.generateOutreachDraftInApp.mockResolvedValue({
    outcome: 'created',
    id: 'queue-uuid-1',
    subject: 'Following up after our chat',
  })
  mocks.notifyOutreachDraftReady.mockResolvedValue(true)
})

describe('POST /api/webhooks/n8n/outreach-followup-trigger', () => {
  it('returns 401 without a bearer header', async () => {
    const req = new NextRequest(
      'http://localhost/api/webhooks/n8n/outreach-followup-trigger',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contact_submission_id: 42 }),
      },
    )
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 with the wrong bearer token', async () => {
    const res = await POST(
      makeReq({ contact_submission_id: 42 }, { authorization: 'Bearer nope' }),
    )
    expect(res.status).toBe(401)
  })

  it('returns 400 when contact_submission_id is missing', async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
    const body = (await res.json()) as Record<string, unknown>
    expect(String(body.error)).toContain('contact_submission_id')
  })

  it('returns 400 when contact_submission_id is non-numeric', async () => {
    const res = await POST(makeReq({ contact_submission_id: 'banana' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const res = await POST(makeReq('{not json'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an unknown template_key', async () => {
    const res = await POST(
      makeReq({ contact_submission_id: 42, template_key: 'fake_template' }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as Record<string, unknown>
    expect(String(body.error)).toContain('fake_template')
  })

  it('returns 404 when the lead is not found', async () => {
    mocks.contactSelectSingle.mockResolvedValue({
      data: null,
      error: { message: 'No rows' },
    })
    const res = await POST(makeReq({ contact_submission_id: 42 }))
    expect(res.status).toBe(404)
  })

  it('returns 400 for a do-not-contact lead', async () => {
    mocks.contactSelectSingle.mockResolvedValue({
      data: {
        id: 42,
        name: 'Jane',
        email: 'jane@x.com',
        do_not_contact: true,
        removed_at: null,
      },
      error: null,
    })
    const res = await POST(makeReq({ contact_submission_id: 42 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for a removed lead', async () => {
    mocks.contactSelectSingle.mockResolvedValue({
      data: {
        id: 42,
        name: 'Jane',
        email: 'jane@x.com',
        do_not_contact: false,
        removed_at: '2026-04-20T00:00:00Z',
      },
      error: null,
    })
    const res = await POST(makeReq({ contact_submission_id: 42 }))
    expect(res.status).toBe(400)
  })

  it('returns 503 when in-app generation is disabled', async () => {
    mocks.isInAppOutreachGenerationEnabled.mockReturnValue(false)
    const res = await POST(makeReq({ contact_submission_id: 42 }))
    expect(res.status).toBe(503)
  })

  it('generates a draft, fires Slack notify, returns the queue id (happy path)', async () => {
    const res = await POST(
      makeReq({
        contact_submission_id: 42,
        sequence_step: 2,
        template_key: 'email_follow_up',
      }),
    )
    expect(res.status).toBe(200)

    expect(mocks.generateOutreachDraftInApp).toHaveBeenCalledWith({
      contactId: 42,
      sequenceStep: 2,
      force: false,
      templateKey: 'email_follow_up',
    })

    const body = (await res.json()) as Record<string, unknown>
    expect(body.ok).toBe(true)
    expect(body.contact_submission_id).toBe(42)
    expect(body.outcome).toBe('created')
    expect(body.queue_id).toBe('queue-uuid-1')
    expect(body.subject).toBe('Following up after our chat')
    expect(body.sequence_step).toBe(2)
    expect(body.template_key).toBe('email_follow_up')

    expect(mocks.notifyOutreachDraftReady).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 42,
        channel: 'email',
        queueId: 'queue-uuid-1',
        templateKey: 'email_follow_up',
      }),
    )
  })

  it('accepts string contact_submission_id and forwards force=true to the generator', async () => {
    const res = await POST(
      makeReq({
        contact_submission_id: '42',
        force: true,
      }),
    )

    expect(res.status).toBe(200)
    expect(mocks.generateOutreachDraftInApp).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 42,
        force: true,
      }),
    )
  })

  it('returns existing draft metadata without firing Slack when the generator finds a duplicate', async () => {
    mocks.generateOutreachDraftInApp.mockResolvedValue({
      outcome: 'existing',
      queueId: 'existing-queue-1',
      templateKey: 'email_follow_up',
    })

    const res = await POST(makeReq({ contact_submission_id: 42 }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.outcome).toBe('existing')
    expect(body.already_exists).toBe(true)
    expect(body.queue_id).toBe('existing-queue-1')
    expect(body.template_key).toBe('email_follow_up')
    expect(mocks.notifyOutreachDraftReady).not.toHaveBeenCalled()
  })

  it('returns outcome=skipped + reason without firing Slack when generator skips', async () => {
    mocks.generateOutreachDraftInApp.mockResolvedValue({
      outcome: 'skipped',
      reason: 'draft_exists',
    })
    const res = await POST(makeReq({ contact_submission_id: 42 }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.outcome).toBe('skipped')
    expect(body.reason).toBe('draft_exists')
    expect(mocks.notifyOutreachDraftReady).not.toHaveBeenCalled()
  })

  it('clamps sequence_step out-of-range to 1', async () => {
    await POST(
      makeReq({ contact_submission_id: 42, sequence_step: 99 }),
    )
    expect(mocks.generateOutreachDraftInApp).toHaveBeenCalledWith(
      expect.objectContaining({ sequenceStep: 1 }),
    )
  })

  it('returns 503 when the LLM provider key is missing', async () => {
    mocks.generateOutreachDraftInApp.mockRejectedValue(
      new Error('OPENAI_API_KEY not configured'),
    )
    const res = await POST(makeReq({ contact_submission_id: 42 }))
    expect(res.status).toBe(503)
  })

  it('returns 503 when the Anthropic provider key is missing', async () => {
    mocks.generateOutreachDraftInApp.mockRejectedValue(
      new Error('ANTHROPIC_API_KEY not configured'),
    )
    const res = await POST(makeReq({ contact_submission_id: 42 }))
    expect(res.status).toBe(503)
  })

  it('returns 500 on unexpected generator failure', async () => {
    mocks.generateOutreachDraftInApp.mockRejectedValue(new Error('boom'))
    const res = await POST(makeReq({ contact_submission_id: 42 }))
    expect(res.status).toBe(500)
  })
})
