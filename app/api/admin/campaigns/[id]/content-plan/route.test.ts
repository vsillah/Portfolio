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

function request(body?: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/campaigns/campaign-1/content-plan', {
    method: 'POST',
    headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
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
      template_key: 'whisper_to_shout',
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

  it('uses the selected calendar template when generating campaign milestones', async () => {
    const campaignSingle = vi.fn(async () => ({
      data: {
        id: 'campaign-1',
        name: 'Agent Ops Video Launch',
        starts_at: '2026-07-01T00:00:00.000Z',
        ends_at: '2026-07-21T00:00:00.000Z',
      },
      error: null,
    }))
    const campaignSelect = vi.fn(() => ({ eq: vi.fn(() => ({ single: campaignSingle })) }))
    const existingEq = vi.fn(async () => ({ data: [], error: null }))
    const insertedRows = [
      { id: 'topic-item', campaign_phase: 'tease' },
      { id: 'hook-item', campaign_phase: 'teach' },
      { id: 'thumbnail-item', campaign_phase: 'proof' },
      { id: 'retro-item', campaign_phase: 'offer' },
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

    const response = await POST(
      request({ template_key: 'youtube_video_release' }) as never,
      { params: { id: 'campaign-1' } },
    )

    expect(response.status).toBe(200)
    expect(insert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        campaign_phase: 'proof',
        channel: 'thumbnail',
        metadata: expect.objectContaining({
          template_key: 'youtube_video_release',
          milestone_key: 'thumbnail_title_package',
          required_assets: expect.arrayContaining(['thumbnail_reference']),
        }),
      }),
      expect.objectContaining({
        campaign_phase: 'offer',
        channel: 'youtube_shorts',
        metadata: expect.objectContaining({
          approval_gates: expect.arrayContaining(['post_publish_review']),
        }),
      }),
    ]))
    expect(await response.json()).toMatchObject({
      ok: true,
      template_key: 'youtube_video_release',
      template_label: 'YouTube video release',
      created_count: 4,
      skipped_existing_count: 0,
      side_effects: {
        publish: false,
        external_post: false,
        social_draft_created: false,
      },
    })
  })

  it('skips every selected-template milestone that already exists', async () => {
    const campaignSingle = vi.fn(async () => ({
      data: {
        id: 'campaign-1',
        name: 'Agent Ops Video Launch',
        starts_at: '2026-07-01T00:00:00.000Z',
        ends_at: '2026-07-21T00:00:00.000Z',
      },
      error: null,
    }))
    const campaignSelect = vi.fn(() => ({ eq: vi.fn(() => ({ single: campaignSingle })) }))
    const existingEq = vi.fn(async () => ({
      data: [
        {
          id: 'topic-item',
          campaign_phase: 'tease',
          channel: 'linkedin',
          metadata: { template_key: 'youtube_video_release' },
        },
        {
          id: 'hook-item',
          campaign_phase: 'teach',
          channel: 'youtube_shorts',
          metadata: { campaign_arc: 'youtube_video_release' },
        },
        {
          id: 'thumbnail-item',
          campaign_phase: 'proof',
          channel: 'thumbnail',
          metadata: { template_key: 'youtube_video_release' },
        },
        {
          id: 'retro-item',
          campaign_phase: 'offer',
          channel: 'youtube_shorts',
          metadata: { template_key: 'youtube_video_release' },
        },
      ],
      error: null,
    }))
    const insert = vi.fn()

    mocks.from.mockImplementation((table: string) => {
      if (table === 'attraction_campaigns') return { select: campaignSelect }
      if (table === 'social_content_calendar_items') return { select: vi.fn(() => ({ eq: existingEq })), insert }
      return {}
    })

    const response = await POST(
      request({ template_key: 'youtube_video_release' }) as never,
      { params: { id: 'campaign-1' } },
    )

    expect(response.status).toBe(200)
    expect(insert).not.toHaveBeenCalled()
    expect(await response.json()).toMatchObject({
      ok: true,
      template_key: 'youtube_video_release',
      created_count: 0,
      skipped_existing_count: 4,
      planned_phases: ['tease', 'teach', 'proof', 'offer'],
    })
  })
})
