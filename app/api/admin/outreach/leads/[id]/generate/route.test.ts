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
}

type MeetingRow = {
  transcript: string | null
  raw_notes: string | null
  structured_notes: Record<string, unknown> | null
}

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/outreach/leads/42/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })
}

function mockLeadAndMeetings(lead: LeadRow | null, meetings: MeetingRow[] = []) {
  mocks.from.mockImplementation((table: string) => {
    if (table === 'contact_submissions') {
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
      }
    }

    if (table === 'meeting_records') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: meetings, error: null })),
            })),
          })),
        })),
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
    mocks.triggerOutreachGeneration.mockResolvedValue({ triggered: true })
  })

  it('returns auth error response when admin verification fails', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(), { params: { id: '42' } })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.triggerOutreachGeneration).not.toHaveBeenCalled()
  })

  it('returns 400 when lead ID is invalid', async () => {
    const response = await POST(makeRequest(), { params: { id: 'not-a-number' } })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid lead ID' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('blocks outreach generation for do-not-contact leads', async () => {
    mockLeadAndMeetings({
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
    expect(mocks.triggerOutreachGeneration).not.toHaveBeenCalled()
  })

  it('blocks outreach generation for removed leads', async () => {
    mockLeadAndMeetings({
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
    expect(mocks.triggerOutreachGeneration).not.toHaveBeenCalled()
  })

  it('uses structured meeting summary and quick_wins fallback pain points', async () => {
    mockLeadAndMeetings(
      {
        id: 42,
        name: 'Alice',
        email: 'alice@example.com',
        company: 'Acme',
        rep_pain_points: null,
        quick_wins: 'Automate weekly reporting',
        do_not_contact: false,
        removed_at: null,
        lead_source: 'warm_referral',
      },
      [
        {
          transcript: 't'.repeat(1200),
          raw_notes: 'raw notes fallback',
          structured_notes: { summary: 'Structured meeting summary' },
        },
      ]
    )

    const response = await POST(makeRequest(), { params: { id: '42' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ triggered: true })
    expect(mocks.triggerOutreachGeneration).toHaveBeenCalledWith({
      contact_id: 42,
      score_tier: 'hot',
      lead_score: 80,
      sequence_step: 1,
      is_followup: false,
      meeting_summary: 'Structured meeting summary',
      pain_points: 'Automate weekly reporting',
    })
  })

  it('returns in-app fallback when webhook reports not triggered', async () => {
    mockLeadAndMeetings({
      id: 42,
      name: 'Alice',
      email: 'alice@example.com',
      company: 'Acme',
      rep_pain_points: 'manual pain',
      quick_wins: null,
      do_not_contact: false,
      removed_at: null,
      lead_source: 'warm_referral',
    })
    mocks.triggerOutreachGeneration.mockResolvedValue({ triggered: false })

    const response = await POST(makeRequest(), { params: { id: '42' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      triggered: false,
      fallback: 'in-app',
    })
  })

  it('returns in-app fallback when webhook throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockLeadAndMeetings({
      id: 42,
      name: 'Alice',
      email: 'alice@example.com',
      company: 'Acme',
      rep_pain_points: 'manual pain',
      quick_wins: null,
      do_not_contact: false,
      removed_at: null,
      lead_source: 'warm_referral',
    })
    mocks.triggerOutreachGeneration.mockRejectedValue(new Error('n8n down'))

    const response = await POST(makeRequest(), { params: { id: '42' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      triggered: false,
      fallback: 'in-app',
    })
    expect(consoleSpy).toHaveBeenCalled()
  })
})
