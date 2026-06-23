import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  listAgentWorkItems: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-work-items', () => ({
  listAgentWorkItems: mocks.listAgentWorkItems,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

function request(url = 'http://localhost/api/admin/social-content/intelligence/daily-digest') {
  return new Request(url, {
    headers: { authorization: 'Bearer admin-token' },
  })
}

const packets = [
  {
    id: 'packet-1',
    source_url: 'https://youtube.com/watch?v=abc',
    platform: 'youtube',
    creator_name: 'Creator',
    creator_handle: '@creator',
    title: 'Approval gate outlier',
    hook_transcript: 'Start with the moment the workflow broke.',
    thumbnail_url: 'https://example.com/thumb.jpg',
    outlier_score: 91,
    pattern_status: 'usable_framework',
    pattern_packet: {
      hook_structure: 'Open with the broken approval path.',
      promise_value: 'Show how trust gets built.',
      thumbnail_pattern: 'High contrast before and after frame.',
    },
    privacy_notes: 'Public pattern only.',
    retrieved_at: '2026-06-23T10:00:00.000Z',
    status: 'review_ready',
  },
  {
    id: 'packet-2',
    source_url: 'https://youtube.com/watch?v=copy',
    platform: 'youtube',
    creator_name: 'Too Close',
    title: 'Do not use directly',
    outlier_score: 88,
    pattern_status: 'too_close_to_source',
    pattern_packet: {},
    retrieved_at: '2026-06-23T09:00:00.000Z',
    status: 'review_ready',
  },
]

const workItems = [
  {
    id: 'work-1',
    title: 'Approval gates create trust',
    status: 'proposed',
    priority: 'high',
    source_type: 'social_topic_trigger',
    metadata: {
      channel_lanes: {
        linkedin: { status: 'not_started', label: 'LinkedIn', required_inputs: ['post text', 'CTA'] },
        youtube_shorts: { status: 'blocked', label: 'YouTube Shorts', required_inputs: ['hook', 'script'] },
        instagram_reels: { status: 'not_started', label: 'Instagram Reels', required_inputs: ['hook', 'caption'] },
        thumbnail: { status: 'not_started', label: 'Thumbnail', required_inputs: ['short thumbnail text', '2-3 variants'] },
      },
      insight: {
        title: 'Approval gates create trust',
        triggering_event: 'A shipped review gate changed the work.',
        why_vambah_can_speak: 'Vambah built the system.',
        audience: 'operators',
        sensitivity: 'needs_review',
      },
    },
  },
]

function mockPacketQuery(packetRows = packets) {
  const limit = vi.fn(async () => ({ data: packetRows, error: null }))
  const orderSecond = vi.fn(() => ({ limit }))
  const orderFirst = vi.fn(() => ({ order: orderSecond }))
  const gte = vi.fn(() => ({ order: orderFirst }))
  const select = vi.fn(() => ({ gte }))
  mocks.from.mockReturnValue({ select })
  return { select, gte, orderFirst, orderSecond, limit }
}

describe('/api/admin/social-content/intelligence/daily-digest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user', email: 'admin@example.com' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.listAgentWorkItems.mockResolvedValue(workItems)
    mockPacketQuery()
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('builds a read-only daily digest from public research and Shaka insights', async () => {
    const query = mockPacketQuery()

    const response = await GET(request('http://localhost/api/admin/social-content/intelligence/daily-digest?lookback_days=5&limit=12') as never)

    expect(response.status).toBe(200)
    expect(mocks.from).toHaveBeenCalledWith('social_content_research_packets')
    expect(query.gte).toHaveBeenCalledWith('retrieved_at', expect.any(String))
    expect(mocks.listAgentWorkItems).toHaveBeenCalledWith({
      sourceType: 'social_topic_trigger',
      limit: 12,
    })

    const body = await response.json()
    expect(body.digest.summary).toEqual({
      new_research_packets: 2,
      usable_patterns: 1,
      shaka_insights: 1,
      blocked_or_sensitive_items: 2,
    })
    expect(body.digest.strongest_patterns).toEqual([
      expect.objectContaining({
        packet_id: 'packet-1',
        title: 'Approval gate outlier',
        outlier_score: 91,
        hook_structure: 'Open with the broken approval path.',
      }),
    ])
    expect(body.digest.recommended_insights).toEqual([
      expect.objectContaining({
        work_item_id: 'work-1',
        title: 'Approval gates create trust',
        why_vambah_can_speak: 'Vambah built the system.',
      }),
    ])
    expect(body.digest.suggested_channel_lanes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        work_item_id: 'work-1',
        channel: 'youtube_shorts',
        status: 'blocked',
      }),
      expect.objectContaining({
        channel: 'thumbnail',
        label: 'Thumbnail',
      }),
    ]))
    expect(body.digest.thumbnail_opportunities).toHaveLength(1)
    expect(body.digest.blocked_or_sensitive_items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'research_packet',
        id: 'packet-2',
        reason: 'too_close_to_source',
      }),
      expect.objectContaining({
        type: 'shaka_insight',
        id: 'work-1',
        reason: 'needs_review',
      }),
    ]))
    expect(body.digest.side_effects).toEqual({
      provider_generation: false,
      upload: false,
      publish: false,
      schedule: false,
      external_post: false,
      apify_run: false,
    })
    expect(body.digest.governance.schedule_activation).toBe('approval_required')
  })
})
