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
    vi.setSystemTime(new Date('2026-07-27T13:45:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('summarizes the complete launch arc and keeps every external side effect disabled', () => {
    expect(agentifiedLaunchSummary()).toEqual(expect.objectContaining({
      campaign_slug: 'agentified-trust-scale-2026-07',
      packet_status: 'draft_prepare_only',
      first_review_packet_path: 'agentified/campaign/launch-review-packet-2026-07-27.md',
      starts_at: '2026-07-27T15:00:00-04:00',
      ends_at: '2026-08-09T18:00:00-04:00',
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

  it('keeps the re-baselined calendar current or future from July 27 launch intake', () => {
    const launchBaseline = new Date('2026-07-27T09:45:00-04:00').getTime()
    const plan = agentifiedLaunchImportPlan()

    expect(plan.campaign.starts_at).toBe('2026-07-27T15:00:00-04:00')
    expect(plan.campaign.ends_at).toBe('2026-08-09T18:00:00-04:00')
    expect(plan.calendar_items[0]).toEqual(expect.objectContaining({
      asset_id: 'AGT-LI-01',
      scheduled_for: '2026-07-27T19:00:00.000Z',
      authorization_due_at: '2026-07-27T17:00:00.000Z',
    }))
    expect(plan.calendar_items.at(-1)).toEqual(expect.objectContaining({
      asset_id: 'AGT-PAGE-01',
      scheduled_for: '2026-08-09T16:00:00.000Z',
    }))
    expect(plan.calendar_items[0].metadata).toEqual(expect.objectContaining({
      schedule_mode: 'relative_to_final_shout',
      schedule_anchor: expect.objectContaining({
        mode: 'relative_to_final_shout',
        final_asset_id: 'AGT-PAGE-01',
        final_release_at: '2026-08-09T16:00:00.000Z',
        source_scheduled_for: '2026-07-27T15:00:00-04:00',
        offset_from_final_release_days: -12.875,
      }),
    }))

    for (const item of plan.calendar_items) {
      expect(new Date(item.scheduled_for).getTime()).toBeGreaterThanOrEqual(launchBaseline)
      expect(new Date(item.authorization_due_at).getTime()).toBeGreaterThanOrEqual(launchBaseline)
    }
  })

  it('recalculates the whole sequence backward from a supplied final shout date', () => {
    const sourcePlan = agentifiedLaunchImportPlan()
    const shiftedPlan = agentifiedLaunchImportPlan({
      finalReleaseAt: '2026-08-21T16:00:00.000Z',
    })
    const sourceFinal = new Date(sourcePlan.calendar_items.at(-1)?.scheduled_for ?? '').getTime()
    const shiftedFinal = new Date(shiftedPlan.calendar_items.at(-1)?.scheduled_for ?? '').getTime()

    expect(shiftedPlan.calendar_items.at(-1)).toEqual(expect.objectContaining({
      asset_id: 'AGT-PAGE-01',
      scheduled_for: '2026-08-21T16:00:00.000Z',
    }))

    shiftedPlan.calendar_items.forEach((item, index) => {
      const sourceItem = sourcePlan.calendar_items[index]
      const sourceAnchor = sourceItem.metadata.schedule_anchor as { source_scheduled_for: string }
      const sourceOffset = new Date(sourceItem.scheduled_for).getTime() - sourceFinal
      const shiftedOffset = new Date(item.scheduled_for).getTime() - shiftedFinal
      const sourceAuthorizationLead = new Date(sourceItem.authorization_due_at).getTime()
        - new Date(sourceItem.scheduled_for).getTime()
      const shiftedAuthorizationLead = new Date(item.authorization_due_at).getTime()
        - new Date(item.scheduled_for).getTime()

      expect(shiftedOffset).toBe(sourceOffset)
      expect(shiftedAuthorizationLead).toBe(sourceAuthorizationLead)
      expect(item.metadata.schedule_anchor).toEqual(expect.objectContaining({
        final_release_at: '2026-08-21T16:00:00.000Z',
        final_asset_id: 'AGT-PAGE-01',
        source_scheduled_for: sourceAnchor.source_scheduled_for,
      }))
    })
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
        expectedPriorityByPhase[item.campaign_phase as keyof typeof expectedPriorityByPhase],
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
      const selectedLane = input.metadata.channel_lanes[
        item.channel as keyof typeof input.metadata.channel_lanes
      ]
      expect(selectedLane.updated_at).toBe(
        '2026-07-27T13:45:00.000Z',
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
        first_review_packet_path: 'agentified/campaign/launch-review-packet-2026-07-27.md',
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
          first_review_packet_path: 'agentified/campaign/launch-review-packet-2026-07-27.md',
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
