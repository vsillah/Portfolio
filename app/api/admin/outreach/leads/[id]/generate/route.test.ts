import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  triggerOutreachGeneration: vi.fn(),
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

vi.mock('@/lib/n8n', () => ({
  triggerOutreachGeneration: mocks.triggerOutreachGeneration,
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/outreach/leads/42/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function buildLeadQuery(lead: Record<string, unknown>) {
  const single = vi.fn().mockResolvedValue({ data: lead, error: null })
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq }))
  return { select, eq, single }
}

function buildMeetingQuery(meetings: Record<string, unknown>[]) {
  const limit = vi.fn().mockResolvedValue({ data: meetings, error: null })
  const order = vi.fn(() => ({ limit }))
  const eq = vi.fn(() => ({ order }))
  const select = vi.fn(() => ({ eq }))
  return { select, eq, order, limit }
}

function buildQueueCountQuery(count: number | null) {
  const eq = vi.fn().mockResolvedValue({ count, error: null })
  const select = vi.fn(() => ({ eq }))
  return { select, eq }
}

describe('POST /api/admin/outreach/leads/[id]/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ id: 'admin-user' })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('returns queueCountImmediate from outreach_queue after a successful trigger', async () => {
    const leadQuery = buildLeadQuery({
      id: 42,
      name: 'Acme',
      email: 'owner@acme.com',
      company: 'Acme',
      rep_pain_points: 'pipeline',
      quick_wins: null,
      do_not_contact: false,
      removed_at: null,
      lead_source: 'warm_inbound',
    })
    const meetingQuery = buildMeetingQuery([])
    const queueCountQuery = buildQueueCountQuery(2)

    mocks.from.mockImplementation((table: string) => {
      if (table === 'contact_submissions') return leadQuery
      if (table === 'meeting_records') return meetingQuery
      if (table === 'outreach_queue') return queueCountQuery
      throw new Error(`Unexpected table ${table}`)
    })
    mocks.triggerOutreachGeneration.mockResolvedValue({ triggered: true })

    const response = await POST(makeRequest({ templateKey: 'email_follow_up' }), {
      params: { id: '42' },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      triggered: true,
      queueCountImmediate: 2,
      templateKey: 'email_follow_up',
    })
    expect(mocks.triggerOutreachGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        contact_id: 42,
        template_key: 'email_follow_up',
      }),
    )
    expect(queueCountQuery.select).toHaveBeenCalledWith('id', {
      count: 'exact',
      head: true,
    })
    expect(queueCountQuery.eq).toHaveBeenCalledWith('contact_submission_id', 42)
  })

  it('normalizes null queue count to 0 and preserves in-app fallback payload', async () => {
    const leadQuery = buildLeadQuery({
      id: 42,
      name: 'Acme',
      email: 'owner@acme.com',
      company: 'Acme',
      rep_pain_points: null,
      quick_wins: null,
      do_not_contact: false,
      removed_at: null,
      lead_source: 'warm_inbound',
    })
    const meetingQuery = buildMeetingQuery([])
    const queueCountQuery = buildQueueCountQuery(null)

    mocks.from.mockImplementation((table: string) => {
      if (table === 'contact_submissions') return leadQuery
      if (table === 'meeting_records') return meetingQuery
      if (table === 'outreach_queue') return queueCountQuery
      throw new Error(`Unexpected table ${table}`)
    })
    mocks.triggerOutreachGeneration.mockResolvedValue({ triggered: false })

    const response = await POST(makeRequest({ templateKey: 'not_a_real_template' }), {
      params: { id: '42' },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      triggered: false,
      queueCountImmediate: 0,
      fallback: 'in-app',
    })
    expect(mocks.triggerOutreachGeneration).toHaveBeenCalledWith(
      expect.not.objectContaining({ template_key: expect.any(String) }),
    )
  })
})
