import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  publishToFacebook: vi.fn(),
  publishToInstagram: vi.fn(),
  publishToLinkedIn: vi.fn(),
  publishToTikTok: vi.fn(),
  publishToX: vi.fn(),
  publishToYouTube: vi.fn(),
  syncCampaignCalendarForSocialContent: vi.fn(),
  buildPlatformOrchestrationPlan: vi.fn(),
  isPlatformSubmissionGateApproved: vi.fn(),
  getProductionAssets: vi.fn(),
  getVideoRedactionGate: vi.fn(),
}))

vi.mock('@/lib/publishing/facebook', () => ({ publishToFacebook: mocks.publishToFacebook }))
vi.mock('@/lib/publishing/instagram', () => ({ publishToInstagram: mocks.publishToInstagram }))
vi.mock('@/lib/publishing/linkedin', () => ({ publishToLinkedIn: mocks.publishToLinkedIn }))
vi.mock('@/lib/publishing/tiktok', () => ({ publishToTikTok: mocks.publishToTikTok }))
vi.mock('@/lib/publishing/x', () => ({ publishToX: mocks.publishToX }))
vi.mock('@/lib/publishing/youtube', () => ({ publishToYouTube: mocks.publishToYouTube }))
vi.mock('@/lib/social-content-calendar-linkage', () => ({
  syncCampaignCalendarForSocialContent: mocks.syncCampaignCalendarForSocialContent,
}))
vi.mock('@/lib/social-platform-orchestration', () => ({
  buildPlatformOrchestrationPlan: mocks.buildPlatformOrchestrationPlan,
  isPlatformSubmissionGateApproved: mocks.isPlatformSubmissionGateApproved,
}))
vi.mock('@/lib/social-production-assets', () => ({
  getProductionAssets: mocks.getProductionAssets,
  getVideoRedactionGate: mocks.getVideoRedactionGate,
}))

import { publishSocialContentItem } from './social-content-publisher'

type QueryResult = { data: unknown; error: unknown }

function createAdmin(handlers: Record<string, () => unknown>) {
  return {
    from: vi.fn((table: string) => {
      const handler = handlers[table]
      if (!handler) throw new Error(`Unexpected table: ${table}`)
      return handler()
    }),
  }
}

function queueLookup(result: QueryResult) {
  const single = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  return { select, eq, single }
}

function publishesLookup(result: QueryResult) {
  const eq = vi.fn().mockResolvedValue(result)
  const select = vi.fn().mockReturnValue({ eq })
  return { select, eq }
}

describe('publishSocialContentItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getProductionAssets.mockReturnValue({})
    mocks.getVideoRedactionGate.mockReturnValue({ ready: true, unresolvedItems: [] })
    mocks.isPlatformSubmissionGateApproved.mockReturnValue(true)
  })

  it('returns 404 when the queue item is missing', async () => {
    const admin = createAdmin({
      social_content_queue: () => queueLookup({ data: null, error: { message: 'missing' } }),
    })

    const result = await publishSocialContentItem({ admin, id: 'missing-id' })

    expect(result).toEqual({ status: 404, body: { error: 'Content not found' } })
    expect(mocks.publishToX).not.toHaveBeenCalled()
  })

  it('rejects draft content that is not approved or scheduled', async () => {
    const admin = createAdmin({
      social_content_queue: () => queueLookup({
        data: { id: 'c1', status: 'draft', rag_context: {} },
        error: null,
      }),
    })

    const result = await publishSocialContentItem({ admin, id: 'c1' })

    expect(result).toEqual({
      status: 400,
      body: { error: 'Content must be approved before publishing' },
    })
    expect(mocks.getVideoRedactionGate).not.toHaveBeenCalled()
  })

  it('blocks publish when video redaction review is incomplete', async () => {
    mocks.getVideoRedactionGate.mockReturnValue({
      ready: false,
      message: 'Resolve face blur items first',
      unresolvedItems: [{ id: 'r1' }, { id: 'r2' }],
    })
    const admin = createAdmin({
      social_content_queue: () => queueLookup({
        data: { id: 'c1', status: 'approved', rag_context: { production: true } },
        error: null,
      }),
    })

    const result = await publishSocialContentItem({ admin, id: 'c1' })

    expect(result).toEqual({
      status: 409,
      body: {
        error: 'Resolve face blur items first',
        unresolved_redaction_items: 2,
      },
    })
  })

  it('rejects approved content that has no publish records', async () => {
    const admin = createAdmin({
      social_content_queue: () => queueLookup({
        data: { id: 'c1', status: 'approved', rag_context: {} },
        error: null,
      }),
      social_content_publishes: () => publishesLookup({ data: [], error: null }),
    })

    const result = await publishSocialContentItem({ admin, id: 'c1' })

    expect(result).toEqual({
      status: 400,
      body: { error: 'No publish records found - approve the content first' },
    })
  })

  it('returns a no-op success when all publish records are already completed', async () => {
    const publishes = [
      { platform: 'x', status: 'published' },
      { platform: 'linkedin', status: 'published' },
    ]
    const admin = createAdmin({
      social_content_queue: () => queueLookup({
        data: { id: 'c1', status: 'scheduled', rag_context: {} },
        error: null,
      }),
      social_content_publishes: () => publishesLookup({ data: publishes, error: null }),
    })

    const result = await publishSocialContentItem({ admin, id: 'c1' })

    expect(result.status).toBe(200)
    expect(result.body.message).toBe('No pending platforms to publish')
    expect(result.body.results).toEqual([
      { platform: 'x', status: 'published', skipped: true },
      { platform: 'linkedin', status: 'published', skipped: true },
    ])
    expect(mocks.buildPlatformOrchestrationPlan).not.toHaveBeenCalled()
    expect(mocks.publishToX).not.toHaveBeenCalled()
  })

  it('blocks publish when platform submission orchestration is not available', async () => {
    mocks.buildPlatformOrchestrationPlan.mockReturnValue({
      platforms: [
        {
          label: 'X',
          nextAction: 'Connect X provider',
          stages: [
            { key: 'final_submission', state: 'blocked', detail: 'Final submission gate not approved' },
            { key: 'automatic_submission', state: 'blocked', detail: 'Provider not connected' },
          ],
        },
      ],
    })

    const admin = createAdmin({
      social_content_queue: () => queueLookup({
        data: { id: 'c1', status: 'approved', rag_context: {}, post_text: 'hello' },
        error: null,
      }),
      social_content_publishes: () => publishesLookup({
        data: [{ platform: 'x', status: 'pending' }],
        error: null,
      }),
      social_content_config: () => ({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    })

    const result = await publishSocialContentItem({ admin, id: 'c1' })

    expect(result.status).toBe(409)
    expect(result.body.error).toBe(
      'Platform submission requires final approval and connected platform configuration.',
    )
    expect(result.body.blockers).toEqual(['X: Final submission gate not approved'])
    expect(mocks.publishToX).not.toHaveBeenCalled()
  })
})
