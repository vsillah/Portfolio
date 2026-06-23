import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { POST } from './route'

function request() {
  return new Request('http://localhost/api/admin/campaigns/campaign-1/content-plan', {
    method: 'POST',
    headers: { authorization: 'Bearer admin-token' },
  })
}

describe('/api/admin/campaigns/[id]/content-plan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request() as never, { params: { id: 'campaign-1' } })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('creates missing whisper-to-shout calendar items without creating drafts or publishes', async () => {
    const campaignSingle = vi.fn(async () => ({
      data: {
        id: 'campaign-1',
        name: 'Agent Ops Campaign',
        starts_at: '2026-06-24T00:00:00.000Z',
        ends_at: '2026-07-04T00:00:00.000Z',
      },
      error: null,
    }))
    const campaignSelect = vi.fn(() => ({ eq: vi.fn(() => ({ single: campaignSingle })) }))

    const existingOrder = vi.fn(async () => ({
      data: [{ id: 'existing-tease', campaign_phase: 'tease', channel: 'linkedin' }],
      error: null,
    }))
    const existingSelect = vi.fn(() => ({ eq: vi.fn(() => ({ order: existingOrder })) }))
    const existingEq = vi.fn(async () => ({
      data: [{ id: 'existing-tease', campaign_phase: 'tease', channel: 'linkedin' }],
      error: null,
    }))

    const insertedRows = [
      { id: 'teach-item', campaign_phase: 'teach' },
      { id: 'proof-item', campaign_phase: 'proof' },
      { id: 'offer-item', campaign_phase: 'offer' },
    ]
    const insertSelect = vi.fn(async () => ({ data: insertedRows, error: null }))
    const insert = vi.fn(() => ({ select: insertSelect }))

    mocks.from.mockImplementation((table: string) => {
      if (table === 'attraction_campaigns') return { select: campaignSelect }
      if (table === 'social_content_calendar_items') {
        if (mocks.from.mock.calls.filter(([name]) => name === 'social_content_calendar_items').length === 1) {
          return { select: vi.fn(() => ({ eq: existingEq })) }
        }
        return { insert }
      }
      return {}
    })

    const response = await POST(request() as never, { params: { id: 'campaign-1' } })

    expect(response.status).toBe(200)
    expect(insert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ campaign_phase: 'teach', campaign_id: 'campaign-1', created_by: 'admin-user' }),
      expect.objectContaining({ campaign_phase: 'proof' }),
      expect.objectContaining({ campaign_phase: 'offer' }),
    ]))
    expect(await response.json()).toMatchObject({
      ok: true,
      created_count: 3,
      skipped_existing_count: 1,
      planned_phases: ['tease', 'teach', 'proof', 'offer'],
      side_effects: {
        publish: false,
        external_post: false,
        social_draft_created: false,
      },
    })
  })
})
