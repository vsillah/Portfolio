import { beforeEach, describe, expect, it, vi } from 'vitest'

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

import { POST as linkResearchPacket } from '../research-packets/route'
import { PATCH as decideChannelLane } from './[channel]/route'
import { POST as prepareReviewDrafts } from './prepare-review-drafts/route'

function jsonRequest(url: string, body: Record<string, unknown> = {}, method = 'POST') {
  return new Request(url, {
    method,
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const researchPacket = {
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
    source_use_boundary: 'Use the framework only.',
  },
  privacy_notes: 'Public pattern only.',
  retrieved_at: '2026-06-23T10:00:00.000Z',
  status: 'review_ready',
}

function sideEffectsOff(body: Record<string, unknown>) {
  return {
    ...body,
    side_effects: {
      provider_generation: false,
      upload: false,
      publish: false,
      schedule: false,
      external_post: false,
    },
  }
}

describe('social content intelligence research-to-channel-approval workflow', () => {
  let currentWorkItem: Record<string, unknown>

  beforeEach(() => {
    vi.clearAllMocks()
    currentWorkItem = {
      id: 'work-social-1',
      title: 'Approval gates create trust',
      source_type: 'social_topic_trigger',
      metadata: {
        social_topic_trigger: true,
        research_packet_ids: [],
        insight: {
          title: 'Approval gates create trust',
          triggering_event: 'The Social Content review flow made the gate visible.',
          why_vambah_can_speak: 'Vambah is building and reviewing the system directly.',
          evidence_summary: 'Review path and visual gate work shipped locally.',
          content_angle: 'AI should reduce burden, but only when authority and evidence are separated.',
          suggested_hook: 'AI should reduce burden.',
          claim_boundaries: ['Do not imply publishing is automated.'],
          approved_research_patterns: [],
        },
        channel_lanes: {
          linkedin: { status: 'selected', label: 'LinkedIn', required_inputs: ['post text', 'CTA'] },
          youtube_shorts: { status: 'not_started', label: 'YouTube Shorts', required_inputs: ['hook', 'script'] },
        },
      },
    }

    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user', email: 'admin@example.com' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getAgentWorkItem.mockImplementation(async () => currentWorkItem)
    mocks.updateAgentWorkItemMetadata.mockImplementation(async (input) => {
      currentWorkItem = {
        ...currentWorkItem,
        metadata: input.metadata,
      }
      return currentWorkItem
    })
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'social_content_research_packets') throw new Error(`Unexpected table ${table}`)
      return {
        select: vi.fn(() => ({
          in: vi.fn(async () => ({ data: [researchPacket], error: null })),
        })),
        update: vi.fn(() => ({
          in: vi.fn(async () => ({ error: null })),
        })),
      }
    })
  })

  it('links research, prepares channel drafts, and approves LinkedIn and YouTube without production side effects', async () => {
    const linkResponse = await linkResearchPacket(jsonRequest(
      'http://localhost/api/admin/agents/work-items/work-social-1/research-packets',
      {
        packet_ids: ['packet-1'],
        decision_note: 'Use the framework, not the source wording.',
      },
    ) as never, {
      params: { id: 'work-social-1' },
    })

    expect(linkResponse.status).toBe(200)
    expect(await linkResponse.json()).toMatchObject(sideEffectsOff({
      success: true,
      linked_packet_ids: ['packet-1'],
      approved_research_patterns: [
        expect.objectContaining({
          packet_id: 'packet-1',
          source_url: 'https://youtube.com/watch?v=abc',
          pattern_packet: expect.objectContaining({
            hook_structure: 'Start with the missed approval gate.',
          }),
        }),
      ],
    }))

    const prepareResponse = await prepareReviewDrafts(jsonRequest(
      'http://localhost/api/admin/agents/work-items/work-social-1/social-channels/prepare-review-drafts',
    ) as never, {
      params: { id: 'work-social-1' },
    })

    expect(prepareResponse.status).toBe(200)
    expect(await prepareResponse.json()).toMatchObject(sideEffectsOff({
      success: true,
      drafts: {
        linkedin: expect.objectContaining({
          channel: 'linkedin',
          approval_status: 'in_review',
          source_research_patterns: [
            expect.objectContaining({
              source_url: 'https://youtube.com/watch?v=abc',
              hook_structure: 'Start with the missed approval gate.',
            }),
          ],
        }),
        youtube_shorts: expect.objectContaining({
          channel: 'youtube_shorts',
          approval_status: 'in_review',
          fields: expect.objectContaining({
            hook: 'AI should reduce burden.',
            render_readiness: 'pending_human_approval',
          }),
        }),
      },
    }))

    const approveLinkedInResponse = await decideChannelLane(jsonRequest(
      'http://localhost/api/admin/agents/work-items/work-social-1/social-channels/linkedin',
      {
        status: 'approved',
        decision_note: 'Approved for LinkedIn review; external publishing remains gated.',
      },
      'PATCH',
    ) as never, {
      params: { id: 'work-social-1', channel: 'linkedin' },
    })

    expect(approveLinkedInResponse.status).toBe(200)
    expect(await approveLinkedInResponse.json()).toMatchObject(sideEffectsOff({
      success: true,
      lane: expect.objectContaining({
        status: 'approved',
        decision_note: 'Approved for LinkedIn review; external publishing remains gated.',
      }),
    }))

    const approveYouTubeResponse = await decideChannelLane(jsonRequest(
      'http://localhost/api/admin/agents/work-items/work-social-1/social-channels/youtube_shorts',
      {
        status: 'approved',
        decision_note: 'Approved for YouTube Shorts review; rendering remains gated.',
      },
      'PATCH',
    ) as never, {
      params: { id: 'work-social-1', channel: 'youtube_shorts' },
    })

    expect(approveYouTubeResponse.status).toBe(200)
    expect(await approveYouTubeResponse.json()).toMatchObject(sideEffectsOff({
      success: true,
      lane: expect.objectContaining({
        status: 'approved',
        decision_note: 'Approved for YouTube Shorts review; rendering remains gated.',
      }),
    }))

    const metadata = currentWorkItem.metadata as Record<string, unknown>
    const lanes = metadata.channel_lanes as Record<string, Record<string, unknown>>
    const insight = metadata.insight as Record<string, unknown>
    expect(insight.approved_research_patterns).toEqual([
      expect.objectContaining({ packet_id: 'packet-1' }),
    ])
    expect(lanes.linkedin.status).toBe('approved')
    expect(lanes.youtube_shorts.status).toBe('approved')
    expect(lanes.linkedin.draft_packet).toEqual(expect.objectContaining({
      channel: 'linkedin',
      approval_status: 'approved',
      decision_note: 'Approved for LinkedIn review; external publishing remains gated.',
    }))
    expect(lanes.youtube_shorts.draft_packet).toEqual(expect.objectContaining({
      channel: 'youtube_shorts',
      approval_status: 'approved',
      decision_note: 'Approved for YouTube Shorts review; rendering remains gated.',
    }))
  })
})
