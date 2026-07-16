import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  agentifiedLaunchImportPlan,
  agentifiedLaunchSummary,
  buildAgentifiedCalendarRow,
  buildAgentifiedWorkItemInput,
} from './agentified-launch-campaign'

type PacketCalendarItem = Parameters<typeof buildAgentifiedWorkItemInput>[0]

function packetItem(assetId: string): PacketCalendarItem {
  const item = agentifiedLaunchImportPlan().calendar_items.find(
    (candidate) => candidate.asset_id === assetId,
  )

  if (!item) throw new Error(`Missing Agentified packet item: ${assetId}`)
  return item
}

describe('Agentified launch campaign import builders', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-16T14:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('summarizes the complete launch arc and keeps every external side effect disabled', () => {
    expect(agentifiedLaunchSummary()).toEqual(expect.objectContaining({
      campaign_slug: 'agentified-trust-scale-2026-07',
      packet_status: 'draft_prepare_only',
      calendar_item_count: 12,
      supported_channels: expect.arrayContaining(['linkedin', 'youtube_shorts', 'thumbnail']),
      phase_counts: {
        tease: 2,
        teach: 3,
        proof: 4,
        offer: 3,
      },
      side_effects: {
        provider_generation: false,
        upload: false,
        external_schedule: false,
        publish: false,
        external_post: false,
        campaign_upsert: true,
        agent_work_items_upsert: true,
        calendar_items_upsert: true,
        social_drafts_created: false,
      },
    }))
    expect(agentifiedLaunchSummary().supported_channels).toHaveLength(3)
  })

  it('promotes proof and offer assets while leaving earlier launch phases at medium priority', () => {
    const expectedPriorityByPhase = {
      tease: 'medium',
      teach: 'medium',
      proof: 'high',
      offer: 'high',
    } as const

    for (const item of agentifiedLaunchImportPlan().calendar_items) {
      expect(buildAgentifiedWorkItemInput(item).priority).toBe(
        expectedPriorityByPhase[item.campaign_phase],
      )
    }
  })

  it('selects only the packet channel lane, including the thumbnail placeholder lane', () => {
    for (const assetId of ['AGT-LI-01', 'AGT-SHORT-01', 'AGT-PAGE-01']) {
      const item = packetItem(assetId)
      const input = buildAgentifiedWorkItemInput(item)
      const selectedLanes = Object.entries(input.metadata.channel_lanes)
        .filter(([, lane]) => lane.status === 'selected')
        .map(([channel]) => channel)

      expect(selectedLanes).toEqual([item.channel])
      expect(input.metadata.channel_lanes[item.channel].updated_at).toBe(
        '2026-07-16T14:00:00.000Z',
      )
    }
  })

  it('gives every work item a stable idempotency key and prepare-only governance metadata', () => {
    for (const item of agentifiedLaunchImportPlan().calendar_items) {
      const input = buildAgentifiedWorkItemInput(item)

      expect(input.status).toBe('queued')
      expect(input.ownerRuntime).toBe('manual')
      expect(input.idempotencyKey).toBe(`agentified-launch:${item.asset_id}`)
      expect(input.overlapGroup).toBe('agentified-launch-campaign')
      expect(input.metadata).toEqual(expect.objectContaining({
        source_policy: 'public_safe_campaign_packet_only',
        agentified_asset_id: item.asset_id,
        side_effects: {
          provider_generation: false,
          upload: false,
          schedule: false,
          publish: false,
          external_post: false,
        },
      }))
      expect(input.metadata.insight.claim_boundaries).toEqual(
        expect.arrayContaining([
          expect.stringContaining('prepare-only'),
          expect.stringContaining('Do not imply autonomous platform publishing'),
        ]),
      )
    }
  })

  it('preserves scheduling and human-gate fields from every packet item', () => {
    for (const item of agentifiedLaunchImportPlan().calendar_items) {
      const row = buildAgentifiedCalendarRow({
        item,
        campaignId: 'campaign-agentified',
        workItemId: `work-${item.asset_id}`,
        createdBy: 'admin-user',
      })

      expect(row).toEqual(expect.objectContaining({
        channel: item.channel,
        campaign_phase: item.campaign_phase,
        planned_angle: item.planned_angle,
        scheduled_for: item.scheduled_for,
        due_status: item.due_status,
        authorization_status: item.authorization_status,
        authorization_due_at: item.authorization_due_at,
        autonomy_eligible: false,
        metadata: expect.objectContaining({
          human_gate_required: true,
          agentified_asset_id: item.asset_id,
        }),
      }))
    }
  })

  it('builds bounded, non-autonomous calendar rows linked to their campaign work item', () => {
    const item = {
      ...packetItem('AGT-PAGE-01'),
      title: 'A'.repeat(260),
    } as PacketCalendarItem

    const row = buildAgentifiedCalendarRow({
      item,
      campaignId: 'campaign-agentified',
      workItemId: 'work-AGT-PAGE-01',
      createdBy: 'admin-user',
    })

    expect(row).toEqual(expect.objectContaining({
      campaign_id: 'campaign-agentified',
      agent_work_item_id: 'work-AGT-PAGE-01',
      social_content_id: null,
      channel: 'thumbnail',
      title: 'A'.repeat(240),
      autonomy_eligible: false,
      created_by: 'admin-user',
      metadata: expect.objectContaining({
        agentified_asset_id: 'AGT-PAGE-01',
        external_execution_enabled: false,
        imported_from_agentified_packet: true,
        side_effects: {
          provider_generation: false,
          upload: false,
          external_schedule: false,
          publish: false,
          external_post: false,
          social_draft_created: false,
        },
      }),
    }))
  })
})
