import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  agentifiedLaunchImportPlan,
  agentifiedLaunchSummary,
  buildAgentifiedCalendarRow,
  buildAgentifiedWorkItemInput,
} from './agentified-launch-campaign'

function packetItem(assetId: string) {
  const item = agentifiedLaunchImportPlan().calendar_items.find((candidate) => candidate.asset_id === assetId)
  if (!item) throw new Error(`Missing Agentified packet item: ${assetId}`)
  return item
}

const reviewPacket = 'agentified/campaign/workshop-review-packet-2026-11-23.md'
const campaignSlug = 'agentified-workshop-2026-post-thanksgiving'

describe('Agentified public workshop campaign import builders', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-23T15:00:00.000Z'))
  })

  afterEach(() => vi.useRealTimers())

  it('summarizes the proposed workshop calendar without email or X import rows', () => {
    expect(agentifiedLaunchSummary()).toEqual(expect.objectContaining({
      campaign_name: 'Agentified: Public Workshop Practice',
      campaign_slug: campaignSlug,
      template_key: 'whisper_to_shout',
      packet_status: 'draft_prepare_only',
      first_review_packet_path: reviewPacket,
      starts_at: '2026-11-30T10:00:00-05:00',
      ends_at: '2026-12-18T10:00:00-05:00',
      calendar_item_count: 10,
      supported_channels: ['linkedin', 'instagram', 'instagram_reels', 'youtube', 'youtube_shorts'],
      phase_counts: { tease: 1, teach: 3, proof: 5, offer: 1 },
      side_effects: expect.objectContaining({ provider_generation: false, upload: false, external_schedule: false, publish: false, external_post: false, social_drafts_created: false }),
    }))
    expect(agentifiedLaunchSummary().supported_channels).not.toContain('x')
  })

  it('uses the current ET slots and a six-day preparation lead for every item', () => {
    const plan = agentifiedLaunchImportPlan()
    expect(plan.campaign).toMatchObject({
      campaign_type: 'free_challenge', status: 'draft', min_purchase_amount: 0,
      payout_amount_value: 0, starts_at: '2026-11-30T10:00:00-05:00', ends_at: '2026-12-18T10:00:00-05:00',
    })
    expect(plan.calendar_items[0]).toEqual(expect.objectContaining({
      asset_id: 'AW-LI-01', scheduled_for: '2026-11-30T15:00:00.000Z',
      preparation_deadline: '2026-11-24T15:00:00.000Z', authorization_due_at: '2026-11-24T15:00:00.000Z',
    }))
    expect(plan.calendar_items.at(-1)).toEqual(expect.objectContaining({ asset_id: 'AW-LI-05', scheduled_for: '2026-12-18T15:00:00.000Z' }))
    for (const item of plan.calendar_items) {
      expect(new Date(item.scheduled_for).getTime() - new Date(item.preparation_deadline).getTime()).toBe(6 * 24 * 60 * 60 * 1000)
      expect(item.authorization_due_at).toBe(item.preparation_deadline)
      expect((item.metadata.jit_refresh as { prepare_by: string }).prepare_by).toBe(item.preparation_deadline)
      expect(item.authorization_status).toBe('pending')
      expect(item.autonomy_eligible).toBe(false)
    }
  })

  it('moves the explicit final shout while preserving each item and preparation offset', () => {
    const original = agentifiedLaunchImportPlan()
    const shifted = agentifiedLaunchImportPlan({ finalReleaseAt: '2026-12-25T15:00:00.000Z' })
    expect(shifted.campaign.starts_at).toBe('2026-12-07T15:00:00.000Z')
    expect(shifted.campaign.ends_at).toBe('2026-12-25T15:00:00.000Z')
    expect(shifted.calendar_items.at(-1)?.asset_id).toBe('AW-LI-05')
    shifted.calendar_items.forEach((item, index) => {
      const source = original.calendar_items[index]
      expect(new Date(item.scheduled_for).getTime() - new Date(source.scheduled_for).getTime()).toBe(7 * 24 * 60 * 60 * 1000)
      expect(new Date(item.scheduled_for).getTime() - new Date(item.preparation_deadline).getTime()).toBe(6 * 24 * 60 * 60 * 1000)
      expect((item.metadata.jit_refresh as { prepare_by: string }).prepare_by).toBe(item.preparation_deadline)
      expect(item.metadata.schedule_anchor).toEqual(expect.objectContaining({ final_asset_id: 'AW-LI-05', source_scheduled_for: source.metadata.schedule_anchor?.source_scheduled_for }))
    })
  })

  it('creates one selected channel lane and reviewable, non-executing work metadata', () => {
    for (const item of agentifiedLaunchImportPlan().calendar_items) {
      const input = buildAgentifiedWorkItemInput(item)
      const expectedLane = item.channel === 'instagram' ? 'instagram_reels' : item.channel
      const selected = Object.entries(input.metadata.channel_lanes).filter(([, lane]) => lane.status === 'selected').map(([key]) => key)
      expect(selected).toEqual([expectedLane])
      expect(input.priority).toBe(item.campaign_phase === 'proof' || item.campaign_phase === 'offer' ? 'high' : 'medium')
      expect(input.status).toBe('queued')
      expect(input.ownerRuntime).toBe('manual')
      expect(input.idempotencyKey).toBe(`agentified-workshop:${item.asset_id}`)
      expect(input.overlapGroup).toBe('agentified-workshop-campaign')
      expect(input.objective).toContain('public Agentified workshop campaign')
      expect(input.metadata).toEqual(expect.objectContaining({
        campaign_slug: campaignSlug,
        agentified_asset_id: item.asset_id,
        source_paths: item.metadata.source_paths,
        preparation_deadline: item.preparation_deadline,
        review_gates: item.metadata.review_gates,
        first_review_packet_path: reviewPacket,
        side_effects: { provider_generation: false, upload: false, schedule: false, publish: false, external_post: false },
      }))
      expect(input.metadata.insight.triggering_event).toBe('Public Agentified workshop guest-learning campaign')
      expect(input.metadata.insight.approved_research_patterns).toEqual([])
      expect(input.metadata.insight.research_direction.pattern_status).toBe('pending_source_and_outlier_review')
      expect(input.metadata.insight.evidence_summary).not.toMatch(/manuscript|preorder|book launch/i)
    }
    expect(buildAgentifiedWorkItemInput(packetItem('AW-IG-CAR-01')).metadata.channel_lane_mapping_note).toContain('carousel')
  })

  it('builds bounded calendar rows linked to their work item and review packet', () => {
    for (const item of agentifiedLaunchImportPlan().calendar_items) {
      const row = buildAgentifiedCalendarRow({ item, campaignId: 'campaign-agentified', workItemId: `work-${item.asset_id}`, createdBy: 'admin-user' })
      expect(row).toEqual(expect.objectContaining({
        campaign_id: 'campaign-agentified', agent_work_item_id: `work-${item.asset_id}`,
        channel: item.channel, campaign_phase: item.campaign_phase, scheduled_for: item.scheduled_for,
        authorization_due_at: item.authorization_due_at, authorization_status: 'pending', autonomy_eligible: false,
        metadata: expect.objectContaining({
          agentified_asset_id: item.asset_id, preparation_deadline: item.preparation_deadline,
          first_review_packet_path: reviewPacket, external_execution_enabled: false,
          side_effects: { provider_generation: false, upload: false, external_schedule: false, publish: false, external_post: false, social_draft_created: false },
        }),
      }))
    }
    const item = { ...packetItem('AW-LI-05'), title: 'A'.repeat(260) }
    const row = buildAgentifiedCalendarRow({ item, campaignId: 'campaign-agentified', workItemId: 'work-AW-LI-05', createdBy: 'admin-user' })
    expect(row.title).toHaveLength(240)
  })
})
