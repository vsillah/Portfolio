import packet from '@/agentified/campaign/portfolio-campaign-packet.json'
import {
  CALENDAR_CHANNEL_LABELS,
  CALENDAR_SIDE_EFFECTS,
  deriveDueStatus,
  type SocialContentCalendarChannel,
  type SocialContentCampaignPhase,
} from '@/lib/social-content-calendar'
import {
  defaultSocialChannelLanes,
  type SocialContentIntelligenceChannel,
} from '@/lib/social-content-intelligence'

const AGENTIFIED_OWNER_AGENT_KEY = 'chief-of-staff'
const PACKET_PATH = 'agentified/campaign/portfolio-campaign-packet.json'
const FIRST_REVIEW_PACKET_PATH = 'agentified/campaign/workshop-review-packet-2026-11-23.md'
const MS_PER_DAY = 24 * 60 * 60 * 1000

type PacketCampaign = typeof packet.campaign
type PacketCalendarItem = (typeof packet.calendar_items)[number]
export type AgentifiedLaunchCalendarItem = Omit<PacketCalendarItem, 'metadata'> & {
  metadata: Record<string, unknown> & {
    draft_asset_path?: string
    schedule_anchor?: Record<string, unknown>
    schedule_mode?: string
  }
}

export type AgentifiedLaunchScheduleOptions = {
  finalReleaseAt?: string | Date | null
}

export type AgentifiedLaunchImportPlan = {
  packet_path: string
  packet_status: string
  campaign: PacketCampaign
  calendar_items: AgentifiedLaunchCalendarItem[]
  supported_channels: SocialContentCalendarChannel[]
  side_effects: typeof CALENDAR_SIDE_EFFECTS & {
    campaign_upsert: true
    agent_work_items_upsert: true
    calendar_items_upsert: true
    social_drafts_created: false
  }
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values))
}

function channelLabel(channel: string) {
  return CALENDAR_CHANNEL_LABELS[channel as SocialContentCalendarChannel] ?? channel
}

function channelToSelectedLane(channel: SocialContentCalendarChannel): SocialContentIntelligenceChannel {
  if (channel === 'thumbnail') return 'thumbnail'
  if (channel === 'instagram') return 'instagram_reels'
  if (channel === 'facebook') return 'linkedin'
  return channel
}

function phaseLabel(phase: SocialContentCampaignPhase) {
  return `${phase.slice(0, 1).toUpperCase()}${phase.slice(1)}`
}

function researchDirection(item: AgentifiedLaunchCalendarItem) {
  return {
    source_url: 'agentified/campaign/agentified-rollout-plan.md',
    source_label: 'Agentified public workshop campaign plan',
    pattern_status: 'pending_source_and_outlier_review',
    hook_structure: `${phaseLabel(item.campaign_phase as SocialContentCampaignPhase)} with a concrete trust/accountability tension before the framework.`,
    tension_or_missed_opportunity: item.planned_angle,
    promise_value: 'Show how a public guest can practice a bounded agent job, receipt, permission slip, and human review gate.',
    proof_style: 'Current public workshop route and privacy-safe first-party lesson or Operating File capture, after review.',
    title_pattern: `${phaseLabel(item.campaign_phase as SocialContentCampaignPhase)}: practical operating claim`,
    thumbnail_pattern: 'Current workshop screen or owned lesson visual, subject to visual proof and thumbnail review.',
    cta_style: 'Invite a guest to start the public workshop at https://amadutown.com/agentified.',
    source_distance_boundary: 'Use the owned workshop as the factual basis; do not copy outside creator scripts or private learner material.',
  }
}

function dateOrNull(value: string | Date | null | undefined) {
  if (!value) return null
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isFinite(date.getTime()) ? date : null
}

function roundedDays(ms: number) {
  return Number((ms / MS_PER_DAY).toFixed(3))
}

function relativeDate(
  value: string,
  originalScheduled: Date,
  scheduled: Date,
) {
  const sourceDate = dateOrNull(value)
  if (!sourceDate) throw new Error(`Invalid Agentified calendar date: ${value}`)
  return new Date(scheduled.getTime() + sourceDate.getTime() - originalScheduled.getTime()).toISOString()
}

function resolveBackwardRelativeCalendarItems(
  items: PacketCalendarItem[],
  options: AgentifiedLaunchScheduleOptions = {},
): AgentifiedLaunchCalendarItem[] {
  const finalItem = items[items.length - 1]
  const sourceFinalDate = dateOrNull(finalItem?.scheduled_for)
    ?? dateOrNull(packet.campaign.ends_at)
    ?? dateOrNull(packet.campaign.starts_at)
    ?? new Date()
  const finalReleaseDate = dateOrNull(options.finalReleaseAt) ?? sourceFinalDate

  return items.map((item, index) => {
    const originalScheduled = dateOrNull(item.scheduled_for) ?? sourceFinalDate
    const scheduledOffsetMs = originalScheduled.getTime() - sourceFinalDate.getTime()
    const scheduled = new Date(finalReleaseDate.getTime() + scheduledOffsetMs)
    const previousItem = index > 0 ? items[index - 1] : null
    const nextItem = index < items.length - 1 ? items[index + 1] : null

    return {
      ...item,
      scheduled_for: scheduled.toISOString(),
      due_status: deriveDueStatus(scheduled),
      preparation_deadline: relativeDate(item.preparation_deadline, originalScheduled, scheduled),
      authorization_due_at: relativeDate(item.authorization_due_at, originalScheduled, scheduled),
      metadata: {
        ...item.metadata,
        schedule_mode: 'relative_to_final_shout',
        jit_refresh: {
          ...item.metadata.jit_refresh,
          prepare_by: relativeDate(item.preparation_deadline, originalScheduled, scheduled),
        },
        schedule_anchor: {
          mode: 'relative_to_final_shout',
          final_asset_id: finalItem?.asset_id ?? null,
          final_release_at: finalReleaseDate.toISOString(),
          source_final_scheduled_for: sourceFinalDate.toISOString(),
          source_scheduled_for: item.scheduled_for,
          source_authorization_due_at: item.authorization_due_at,
          source_preparation_deadline: item.preparation_deadline,
          offset_from_final_release_ms: scheduledOffsetMs,
          offset_from_final_release_days: roundedDays(scheduledOffsetMs),
          previous_asset_id: previousItem?.asset_id ?? null,
          next_asset_id: nextItem?.asset_id ?? null,
        },
      },
    }
  })
}

export function agentifiedLaunchImportPlan(
  options: AgentifiedLaunchScheduleOptions = {},
): AgentifiedLaunchImportPlan {
  const calendarItems = resolveBackwardRelativeCalendarItems(packet.calendar_items, options)
  const supportedChannels = unique(
    calendarItems.map((item) => item.channel as SocialContentCalendarChannel),
  )

  return {
    packet_path: PACKET_PATH,
    packet_status: packet.packet_status,
    campaign: options.finalReleaseAt ? {
      ...packet.campaign,
      starts_at: calendarItems[0]?.scheduled_for ?? packet.campaign.starts_at,
      ends_at: calendarItems.at(-1)?.scheduled_for ?? packet.campaign.ends_at,
    } : packet.campaign,
    calendar_items: calendarItems,
    supported_channels: supportedChannels,
    side_effects: {
      ...CALENDAR_SIDE_EFFECTS,
      campaign_upsert: true,
      agent_work_items_upsert: true,
      calendar_items_upsert: true,
      social_drafts_created: false,
    },
  }
}

export function agentifiedLaunchSummary() {
  const plan = agentifiedLaunchImportPlan()
  const phaseCounts = plan.calendar_items.reduce<Record<string, number>>((counts, item) => {
    counts[item.campaign_phase] = (counts[item.campaign_phase] ?? 0) + 1
    return counts
  }, {})

  return {
    campaign_name: plan.campaign.name,
    campaign_slug: plan.campaign.slug,
    template_key: 'whisper_to_shout',
    packet_status: plan.packet_status,
    packet_path: plan.packet_path,
    first_review_packet_path: FIRST_REVIEW_PACKET_PATH,
    schedule_mode: 'relative_to_final_shout',
    final_release_at: plan.calendar_items[plan.calendar_items.length - 1]?.scheduled_for ?? null,
    starts_at: plan.campaign.starts_at,
    ends_at: plan.campaign.ends_at,
    calendar_item_count: plan.calendar_items.length,
    supported_channels: plan.supported_channels,
    phase_counts: phaseCounts,
    side_effects: plan.side_effects,
  }
}

export function buildAgentifiedWorkItemInput(item: AgentifiedLaunchCalendarItem) {
  const channel = item.channel as SocialContentCalendarChannel
  const selectedLane = channelToSelectedLane(channel)
  const now = new Date().toISOString()
  const lanes = defaultSocialChannelLanes()
  lanes[selectedLane] = {
    ...lanes[selectedLane],
    status: 'selected',
    updated_at: now,
  }

  return {
    title: `Agentified ${phaseLabel(item.campaign_phase as SocialContentCampaignPhase)}: ${item.title}`,
    objective: [
      `Prepare ${channelLabel(channel)} review assets for the public Agentified workshop campaign.`,
      item.planned_angle,
      'Keep all provider generation, uploads, scheduling, and publishing behind later human gates.',
    ].join(' '),
    priority: item.campaign_phase === 'offer' || item.campaign_phase === 'proof' ? 'high' as const : 'medium' as const,
    status: 'queued' as const,
    ownerAgentKey: AGENTIFIED_OWNER_AGENT_KEY,
    ownerRuntime: 'manual' as const,
    source: {
      type: 'social_topic_trigger',
      id: item.asset_id,
      label: item.title,
    },
    expectedFiles: [
      'agentified/campaign/draft-assets.md',
      'agentified/campaign/release-calendar.md',
      'agentified/campaign/human-gate-review.md',
      FIRST_REVIEW_PACKET_PATH,
    ],
    overlapGroup: 'agentified-workshop-campaign',
    metadata: {
      social_topic_trigger: true,
      insight_version: 'agentified_workshop_campaign_v1',
      generated_at: now,
      generated_by: 'agentified_launch_import',
      trigger_source: 'agentified_campaign_packet',
      source_policy: 'public_safe_campaign_packet_only',
      source_counts: {
        campaign_packet: 1,
        calendar_item: 1,
      },
      privacy_boundary: 'Use synthetic or blank workshop proof only; exclude learner responses, identities, verification tokens, private chats, client data, and unpublished provider assets.',
      research_packet_ids: [],
      campaign_slug: item.campaign_slug,
      campaign_phase: item.campaign_phase,
      calendar_channel: item.channel,
      agentified_asset_id: item.asset_id,
      draft_asset_path: item.metadata.draft_asset_path,
      first_review_packet_path: FIRST_REVIEW_PACKET_PATH,
      source_paths: item.metadata.source_paths,
      preparation_deadline: item.preparation_deadline,
      review_gates: item.metadata.review_gates,
      external_action_locks: item.metadata.external_action_locks,
      channel_lane_mapping_note: channel === 'instagram' ? 'The intelligence lane uses instagram_reels; this calendar item is a carousel and needs visual format review.' : null,
      channel_lanes: lanes,
      insight: {
        candidate_id: item.asset_id,
        title: item.title,
        triggering_event: 'Public Agentified workshop guest-learning campaign',
        source_type: 'agentified_campaign_packet',
        source_label: PACKET_PATH,
        source_ids: [item.asset_id],
        why_vambah_can_speak: 'The public Agentified workshop is an owned first-party learning surface with an Operating File, receipts, permissions, and review-gate exercises.',
        brand_goal: 'Invite product leaders and builders to practice useful governed-agent work in the public workshop.',
        content_angle: item.planned_angle,
        suggested_hook: item.title,
        audience: 'Product leaders, builders, founders, nonprofit and small-business operators, and AI-curious teams carrying the risk of agentic work.',
        sensitivity: 'public_safe_review_required',
        evidence_summary: 'Prepared from the current workshop campaign packet and public workshop sources; current capture and source/outlier evidence are pending.',
        claim_boundaries: [
          'Treat this campaign as prepare-only until source, visual, challenger, and human gates pass.',
          'Use current first-party workshop proof without exposing learner data or private admin records.',
          'Do not imply autonomous platform publishing, provider rendering, external scheduling, accreditation, or job outcomes.',
        ],
        approved_research_patterns: [],
        research_direction: researchDirection(item),
      },
      side_effects: {
        provider_generation: false,
        upload: false,
        schedule: false,
        publish: false,
        external_post: false,
      },
    },
    idempotencyKey: `agentified-workshop:${item.asset_id}`,
  }
}

export function buildAgentifiedCalendarRow(input: {
  item: AgentifiedLaunchCalendarItem
  campaignId: string
  workItemId: string
  createdBy: string
}) {
  return {
    campaign_id: input.campaignId,
    agent_work_item_id: input.workItemId,
    social_content_id: null,
    channel: input.item.channel,
    campaign_phase: input.item.campaign_phase,
    title: input.item.title.slice(0, 240),
    planned_angle: input.item.planned_angle,
    scheduled_for: input.item.scheduled_for,
    due_status: input.item.due_status,
    authorization_status: input.item.authorization_status,
    authorization_due_at: input.item.authorization_due_at,
    autonomy_eligible: false,
    metadata: {
      ...input.item.metadata,
      agentified_asset_id: input.item.asset_id,
      campaign_slug: input.item.campaign_slug,
      source_packet_path: PACKET_PATH,
      first_review_packet_path: FIRST_REVIEW_PACKET_PATH,
      preparation_deadline: input.item.preparation_deadline,
      review_gates: input.item.metadata.review_gates,
      external_action_locks: input.item.metadata.external_action_locks,
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
    },
    created_by: input.createdBy,
  }
}
