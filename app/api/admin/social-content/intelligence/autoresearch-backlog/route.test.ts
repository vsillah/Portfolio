import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  activateAutoResearchBacklogItem: vi.fn(),
  findAutoResearchBacklogItem: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: vi.fn() },
}))

vi.mock('@/lib/autoresearch-calendar-activation', () => ({
  activateAutoResearchBacklogItem: mocks.activateAutoResearchBacklogItem,
  findAutoResearchBacklogItem: mocks.findAutoResearchBacklogItem,
}))

import { GET, POST } from './route'

function request(url = 'http://localhost/api/admin/social-content/intelligence/autoresearch-backlog') {
  return new Request(url, {
    headers: { authorization: 'Bearer admin-token' },
  })
}

function postRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/social-content/intelligence/autoresearch-backlog', {
    method: 'POST',
    headers: {
      authorization: 'Bearer admin-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('/api/admin/social-content/intelligence/autoresearch-backlog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user', email: 'admin@example.com' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.findAutoResearchBacklogItem.mockReturnValue({
      id: 'autoresearch-agentified-agt-x-01',
      title: 'Agentified release thread: build trust before scale',
    })
    mocks.activateAutoResearchBacklogItem.mockResolvedValue({
      itemId: 'autoresearch-agentified-agt-x-01',
      title: 'Agentified release thread: build trust before scale',
      records: [{
        channel: 'x',
        state: 'inserted',
        calendarItemId: 'calendar-x',
        socialContentId: 'social-x',
        providerBlocked: false,
        manualOnly: false,
        reason: 'Internal records created.',
      }],
      blocked: [],
      summary: {
        requested: 1,
        insertedCalendarItems: 1,
        insertedSocialContentRows: 1,
        reusedCalendarItems: 0,
        reusedSocialContentRows: 0,
        blocked: 0,
      },
      side_effects: {
        provider_call: false,
        slack_send: false,
        cron_activation: false,
        migration: false,
        publish: false,
        schedule: false,
        upload: false,
        production_mutation: false,
        provider_generation: false,
        external_schedule: false,
        external_post: false,
        social_content_draft_created: true,
        calendar_rows_created: true,
      },
      callable_external_actions: [],
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns a read-only AutoResearch backlog projection without callable actions', async () => {
    const response = await GET(request() as never)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.summary).toEqual({
      total: 11,
      readyForInternalHandoff: 5,
      blockedOrManual: 11,
      callableExternalActions: 0,
    })
    expect(body.opportunity_summary).toEqual({
      total: 17,
      highPriority: 5,
      channels: ['x', 'linkedin', 'youtube_shorts', 'instagram', 'facebook', 'youtube', 'thumbnail', 'tiktok', 'manual'],
      requiresHumanGate: 17,
    })
    expect(body.opportunities[0]).toMatchObject({
      title: 'Agentified release thread: build trust before scale',
      priority: 'high',
      channel: 'x',
      requiredGate: 'final_submission',
    })
    expect(body.opportunities[0].measurementHypothesis).toContain('Seven-day review')
    expect(body.side_effects).toEqual({
      provider_call: false,
      slack_send: false,
      cron_activation: false,
      migration: false,
      publish: false,
      schedule: false,
      upload: false,
      production_mutation: false,
    })
    expect(body.callable_external_actions).toEqual([])
    const xItem = body.items.find((item: { id: string }) => item.id === 'autoresearch-agentified-agt-x-01')
    expect(xItem).toMatchObject({
      id: 'autoresearch-agentified-agt-x-01',
      firstBlockedOrPendingGate: 'final_submission',
      callableExternalActions: [],
      campaign: {
        slug: 'agentified-trust-scale-2026-07',
        phase: 'tease',
      },
    })
    expect(xItem.sourcePacketPaths).toContain('agentified/campaign/portfolio-campaign-packet.json')
    expect(xItem.sourceReferences[0]).toEqual(expect.objectContaining({
      sourceType: 'public_post',
      confidence: 'medium',
      transferablePattern: expect.stringContaining('workflow tension'),
    }))
    expect(body.items.map((item: { title: string }) => item.title)).toEqual(expect.arrayContaining([
      'The speed problem is becoming a trust problem',
      'The operating layer behind AMINA',
      'The Receipt Every Agent Needs',
      'What the cover is really showing',
      'AMINA is the operating loop',
      'Short-form proof cutdown needs a platform review',
      'The Receipt Every Agent Needs thumbnail promise',
    ]))
    expect(body.items.flatMap((item: { variants: Array<{ channel: string }> }) => (
      item.variants.map((variant) => variant.channel)
    ))).toEqual(expect.arrayContaining([
      'linkedin',
      'x',
      'youtube',
      'youtube_shorts',
      'instagram',
      'facebook',
      'tiktok',
      'manual',
      'thumbnail',
    ]))
  })

  it('activates an approved backlog item into internal records without callable external actions', async () => {
    const response = await POST(postRequest({
      item_id: 'autoresearch-agentified-agt-x-01',
      channels: ['x', 'not-a-channel'],
    }) as never)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(mocks.findAutoResearchBacklogItem).toHaveBeenCalledWith('autoresearch-agentified-agt-x-01')
    expect(mocks.activateAutoResearchBacklogItem).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 'admin-user',
      channels: ['x'],
    }))
    expect(body.activation).toMatchObject({
      itemId: 'autoresearch-agentified-agt-x-01',
      summary: {
        insertedCalendarItems: 1,
        insertedSocialContentRows: 1,
      },
      side_effects: expect.objectContaining({
        provider_call: false,
        slack_send: false,
        publish: false,
        schedule: false,
        upload: false,
        provider_generation: false,
        external_post: false,
      }),
      callable_external_actions: [],
    })
    expect(body.projection.callable_external_actions).toEqual([])
  })

  it('rejects activation for unknown backlog items', async () => {
    mocks.findAutoResearchBacklogItem.mockReturnValue(null)

    const response = await POST(postRequest({ item_id: 'missing-item' }) as never)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'AutoResearch backlog item not found' })
    expect(mocks.activateAutoResearchBacklogItem).not.toHaveBeenCalled()
  })
})
