import { describe, expect, it, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  getAgentWorkItem: vi.fn(),
  updateAgentWorkItemMetadata: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-work-items', () => ({
  getAgentWorkItem: mocks.getAgentWorkItem,
  updateAgentWorkItemMetadata: mocks.updateAgentWorkItemMetadata,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/agents/work-items/work-1/research-packets', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const workItem = {
  id: 'work-1',
  source_type: 'social_topic_trigger',
  metadata: {
    social_topic_trigger: true,
    research_packet_ids: ['packet-existing'],
    insight: {
      title: 'Approval gates create trust',
      approved_research_patterns: [
        {
          packet_id: 'packet-existing',
          source_url: 'https://example.com/existing',
          pattern_packet: { hook_structure: 'Existing hook' },
        },
      ],
    },
  },
}

const packet = {
  id: 'packet-1',
  source_url: 'https://youtube.com/watch?v=abc',
  platform: 'youtube',
  creator_name: 'Creator',
  creator_handle: '@creator',
  title: 'Useful outlier',
  outlier_score: 87,
  pattern_status: 'needs_brand_translation',
  pattern_packet: {
    hook_structure: 'Start with the missed approval gate.',
    promise_value: 'Show how review gates build trust.',
  },
  privacy_notes: 'Public pattern only.',
  retrieved_at: '2026-06-23T10:00:00.000Z',
  status: 'review_ready',
}

function mockResearchPacketQuery(packetRows = [packet]) {
  mocks.from.mockImplementation((table: string) => {
    if (table !== 'social_content_research_packets') throw new Error(`Unexpected table ${table}`)
    return {
      select: vi.fn(() => ({
        in: vi.fn(async () => ({ data: packetRows, error: null })),
      })),
      update: vi.fn(() => ({
        in: vi.fn(async () => ({ error: null })),
      })),
    }
  })
}

describe('/api/admin/agents/work-items/[id]/research-packets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user', email: 'admin@example.com' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getAgentWorkItem.mockResolvedValue(workItem)
    mocks.updateAgentWorkItemMetadata.mockResolvedValue(workItem)
    mockResearchPacketQuery()
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ packet_ids: ['packet-1'] }) as never, {
      params: { id: 'work-1' },
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.getAgentWorkItem).not.toHaveBeenCalled()
  })

  it('rejects research patterns that are too close to the source', async () => {
    mockResearchPacketQuery([{ ...packet, pattern_status: 'too_close_to_source' }])

    const response = await POST(request({ packet_ids: ['packet-1'] }) as never, {
      params: { id: 'work-1' },
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Only usable or brand-translation research patterns can be linked to an insight',
    })
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })

  it('links public research patterns to a social insight without production side effects', async () => {
    const response = await POST(request({
      packet_ids: ['packet-1'],
      decision_note: 'Use the hook framework, not the wording.',
    }) as never, {
      params: { id: 'work-1' },
    })

    expect(response.status).toBe(200)
    expect(mocks.updateAgentWorkItemMetadata).toHaveBeenCalledWith(expect.objectContaining({
      id: 'work-1',
      note: 'Linked 1 public research pattern(s) to social insight.',
      metadata: expect.objectContaining({
        research_packet_ids: ['packet-existing', 'packet-1'],
        research_patterns_decision_note: 'Use the hook framework, not the wording.',
        insight: expect.objectContaining({
          approved_research_patterns: expect.arrayContaining([
            expect.objectContaining({
              packet_id: 'packet-1',
              source_url: 'https://youtube.com/watch?v=abc',
              pattern_packet: expect.objectContaining({
                hook_structure: 'Start with the missed approval gate.',
              }),
            }),
          ]),
        }),
      }),
    }))
    expect(await response.json()).toMatchObject({
      success: true,
      linked_packet_ids: ['packet-existing', 'packet-1'],
      side_effects: {
        provider_generation: false,
        upload: false,
        publish: false,
        schedule: false,
        external_post: false,
      },
    })
  })
})
