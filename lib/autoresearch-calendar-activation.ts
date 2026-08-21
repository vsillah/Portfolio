import {
  CALENDAR_CHANNEL_LABELS,
  CALENDAR_SIDE_EFFECTS,
  defaultAuthorizationDueAt,
  deriveDueStatus,
  type SocialContentCalendarChannel,
} from '@/lib/social-content-calendar'
import type { SocialPlatform } from '@/lib/social-content'
import {
  AGENTIFIED_AUTORESEARCH_BACKLOG_FIXTURES,
  AUTORESEARCH_BACKLOG_SIDE_EFFECTS,
  projectAutoResearchBacklogItem,
  type AutoResearchBacklogChannel,
  type AutoResearchChannelVariantRecommendation,
  type CrossChannelAutoResearchBacklogItem,
} from '@/lib/cross-channel-autoresearch-backlog'

type SupabaseLike = {
  from: (table: string) => unknown
}

type QueryResult<T> = Promise<{ data?: T | null; error?: { message?: string; code?: string } | null }>

type CalendarRow = {
  id: string
  social_content_id?: string | null
  metadata?: Record<string, unknown> | null
}

type SocialContentRow = {
  id: string
  platform?: SocialPlatform | null
  rag_context?: Record<string, unknown> | null
}

type CampaignRow = {
  id: string
}

export type AutoResearchActivationRecordState = 'inserted' | 'existing' | 'linked' | 'blocked'

export type AutoResearchActivationRecord = {
  channel: SocialContentCalendarChannel
  idempotencyKey: string
  state: AutoResearchActivationRecordState
  calendarItemId: string | null
  socialContentId: string | null
  providerBlocked: boolean
  manualOnly: boolean
  reason: string
}

export type AutoResearchActivationResult = {
  itemId: string
  title: string
  records: AutoResearchActivationRecord[]
  blocked: AutoResearchActivationRecord[]
  summary: {
    requested: number
    insertedCalendarItems: number
    insertedSocialContentRows: number
    reusedCalendarItems: number
    reusedSocialContentRows: number
    blocked: number
  }
  side_effects: typeof AUTORESEARCH_BACKLOG_SIDE_EFFECTS & {
    provider_generation: false
    external_schedule: false
    external_post: false
    social_content_draft_created: boolean
    calendar_rows_created: boolean
  }
  callable_external_actions: []
}

const QUEUE_CHANNELS: Partial<Record<AutoResearchBacklogChannel, SocialPlatform>> = {
  linkedin: 'linkedin',
  x: 'x',
  youtube: 'youtube',
  youtube_shorts: 'youtube',
  instagram: 'instagram',
  instagram_reels: 'instagram',
  facebook: 'facebook',
}

const CHANNEL_OFFSETS: Record<SocialContentCalendarChannel, number> = {
  linkedin: 7,
  x: 8,
  youtube: 12,
  youtube_shorts: 10,
  instagram: 9,
  instagram_reels: 11,
  facebook: 9,
  tiktok: 13,
  thumbnail: 6,
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asSelectQuery<T>(value: unknown) {
  return value as {
    select: (columns: string) => {
      eq?: (column: string, value: string) => {
        maybeSingle?: () => QueryResult<T>
        limit?: (count: number) => QueryResult<T[]>
      }
      contains?: (column: string, value: Record<string, unknown>) => {
        eq?: (column: string, value: string) => {
          maybeSingle?: () => QueryResult<T>
          limit?: (count: number) => QueryResult<T[]>
        }
        maybeSingle?: () => QueryResult<T>
        limit?: (count: number) => QueryResult<T[]>
      }
      maybeSingle?: () => QueryResult<T>
    }
    insert: (row: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => QueryResult<T>
      }
    }
    update: (row: Record<string, unknown>) => {
      eq: (column: string, value: string) => QueryResult<T>
    }
  }
}

function errorMessage(error: { message?: string } | null | undefined, fallback: string) {
  return error?.message || fallback
}

function calendarChannelFor(channel: AutoResearchBacklogChannel): SocialContentCalendarChannel | null {
  if (channel === 'manual') return null
  return channel
}

function platformTargetsFor(channel: SocialContentCalendarChannel): SocialPlatform[] {
  const platform = QUEUE_CHANNELS[channel]
  return platform ? [platform] : []
}

function supportsSocialContentQueue(channel: SocialContentCalendarChannel) {
  return Boolean(QUEUE_CHANNELS[channel])
}

function isProviderBlocked(
  item: CrossChannelAutoResearchBacklogItem,
  variant: AutoResearchChannelVariantRecommendation,
) {
  return item.status === 'manual_hold'
    || item.status === 'blocked'
    || variant.channelFit === 'blocked'
    || variant.manualState === 'manual_hold'
    || variant.channel === 'tiktok'
}

function isManualOnly(
  item: CrossChannelAutoResearchBacklogItem,
  variant: AutoResearchChannelVariantRecommendation,
) {
  return isProviderBlocked(item, variant)
    || variant.providerBoundary === 'provider_setup_required'
    || variant.providerBoundary === 'upload_gate_required'
    || variant.providerBoundary === 'publish_gate_required'
}

function activationIdempotencyKey(
  item: CrossChannelAutoResearchBacklogItem,
  channel: SocialContentCalendarChannel,
) {
  const workItemKey = item.releaseLinkage?.workItemId ?? 'no-work-item'
  return `autoresearch-calendar-activation:${workItemKey}:${item.id}:${channel}`
}

function scheduledFor(channel: SocialContentCalendarChannel, now: Date) {
  const days = CHANNEL_OFFSETS[channel] ?? 7
  const date = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  date.setUTCHours(14, 0, 0, 0)
  return date.toISOString()
}

function plannedAngleFor(
  item: CrossChannelAutoResearchBacklogItem,
  variant: AutoResearchChannelVariantRecommendation,
) {
  return [
    variant.hookHypothesis,
    variant.proofPlacement,
    `CTA role: ${variant.ctaRole.replace(/_/g, ' ')}.`,
    `Source boundary: ${item.sourceDistance.allowedPatternUse}`,
  ].filter(Boolean).join(' ')
}

function approvalBoundaryFor(
  item: CrossChannelAutoResearchBacklogItem,
  variant: AutoResearchChannelVariantRecommendation,
  providerBlocked: boolean,
) {
  if (variant.channel === 'tiktok') {
    return 'TikTok is a manual calendar candidate only until developer app/provider approval, platform strategy, audio rights, copy approval, visuals/media review, final submit approval, and status reconciliation are complete.'
  }
  if (providerBlocked || item.status === 'manual_hold') {
    return 'Manual review is required before this channel can move beyond internal calendar visibility.'
  }
  return 'Internal backlog/calendar activation only. Copy approval, visuals/media, platform draft handoff, final submit approval, provider execution, and status reconciliation remain separate gates.'
}

function buildActivationMetadata(input: {
  item: CrossChannelAutoResearchBacklogItem
  variant: AutoResearchChannelVariantRecommendation
  channel: SocialContentCalendarChannel
  idempotencyKey: string
  now: string
  actorUserId: string
  socialContentId?: string | null
}) {
  const projection = projectAutoResearchBacklogItem(input.item)
  const providerBlocked = isProviderBlocked(input.item, input.variant)
  const manualOnly = isManualOnly(input.item, input.variant)
  return {
    source: 'autoresearch_calendar_activation',
    autoresearch_activation: {
      idempotency_key: input.idempotencyKey,
      backlog_item_id: input.item.id,
      backlog_item_title: input.item.title,
      channel: input.channel,
      activated_at: input.now,
      activated_by: input.actorUserId,
      work_item_id: input.item.releaseLinkage?.workItemId ?? null,
      calendar_asset_id: input.item.releaseLinkage?.calendarAssetId ?? null,
      manual_packet_path: input.item.releaseLinkage?.manualPacketPath ?? null,
      social_content_id: input.socialContentId ?? null,
    },
    campaign_slug: input.item.campaignSlug ?? null,
    campaign_phase: input.item.campaignPhase ?? null,
    agentified_asset_id: input.item.releaseLinkage?.calendarAssetId ?? null,
    source_packet_paths: input.item.sourcePacketPaths,
    source_references: input.item.provenance.map((source) => ({
      source_id: source.sourceId,
      source_type: source.sourceType,
      url_or_path: source.urlOrPath,
      visible_signal_basis: source.visibleSignalBasis ?? null,
      transferable_pattern: source.transferablePattern,
      confidence: source.confidence,
    })),
    gate_ledger: projection.gates,
    first_blocked_or_pending_gate: projection.firstBlockedOrPendingGate,
    provider_blocked: providerBlocked,
    manual_only: manualOnly,
    provider_boundary: input.variant.providerBoundary,
    manual_state: input.variant.manualState ?? null,
    approval_boundary: approvalBoundaryFor(input.item, input.variant, providerBlocked),
    external_execution_enabled: false,
    side_effects: {
      ...CALENDAR_SIDE_EFFECTS,
      provider_generation: false,
      external_post: false,
      social_content_draft_created: supportsSocialContentQueue(input.channel) && !providerBlocked,
    },
  }
}

function queueRowFor(input: {
  item: CrossChannelAutoResearchBacklogItem
  variant: AutoResearchChannelVariantRecommendation
  channel: SocialContentCalendarChannel
  idempotencyKey: string
  scheduledFor: string
  now: string
  actorUserId: string
}) {
  const platform = QUEUE_CHANNELS[input.channel]
  if (!platform) return null
  const metadata = buildActivationMetadata(input)
  const tags = input.variant.hashtagNeeds?.reviewState === 'blocked'
    ? []
    : input.variant.hashtagNeeds?.candidateTags ?? []

  return {
    platform,
    status: 'draft',
    post_text: [
      `AutoResearch draft seed: ${input.item.title}`,
      plannedAngleFor(input.item, input.variant),
      'Shaka/content agents must convert this into channel copy before approval. This row does not publish, upload, schedule externally, call media providers, or submit content.',
    ].join('\n\n'),
    cta_text: input.item.ctaHypothesis.hypothesis,
    cta_url: null,
    hashtags: tags,
    image_prompt: input.variant.visualNeeds
      .map((need) => `${need.kind}: ${need.description}`)
      .join('\n') || null,
    framework_visual_type: null,
    voiceover_text: input.variant.recommendedFormat === 'short_form_video' || input.variant.recommendedFormat === 'long_form_video'
      ? input.variant.hookHypothesis
      : null,
    video_generation_method: 'none',
    topic_extracted: {
      topic: input.item.title,
      angle: input.variant.hookHypothesis,
      key_insight: input.variant.proofPlacement,
      personal_tie_in: input.item.targetAvatar,
      framework_visual: 'cycle',
    },
    hormozi_framework: {
      framework_type: 'proof_placement',
      hook_type: input.variant.recommendedFormat,
      proof_pattern: 'autoresearch_source_to_governed_calendar',
      cta_pattern: input.variant.ctaRole,
    },
    rag_context: metadata,
    scheduled_for: null,
    admin_notes: [
      `Activated from AutoResearch backlog item ${input.item.id}.`,
      `Idempotency key: ${input.idempotencyKey}.`,
      'Draft only. Copy approval, visual/media review, platform draft handoff, final submit approval, provider execution, and status reconciliation remain separate gates.',
    ].join('\n'),
    target_platforms: platformTargetsFor(input.channel),
    content_format: input.variant.recommendedFormat === 'carousel' ? 'carousel' : 'single_image',
  }
}

function calendarRowFor(input: {
  item: CrossChannelAutoResearchBacklogItem
  variant: AutoResearchChannelVariantRecommendation
  channel: SocialContentCalendarChannel
  idempotencyKey: string
  campaignId: string | null
  scheduledFor: string
  now: string
  actorUserId: string
  socialContentId: string | null
}) {
  return {
    campaign_id: input.campaignId,
    agent_work_item_id: input.item.releaseLinkage?.workItemId ?? null,
    social_content_id: input.socialContentId,
    channel: input.channel,
    campaign_phase: input.item.campaignPhase ?? 'tease',
    title: `${CALENDAR_CHANNEL_LABELS[input.channel]}: ${input.item.title}`.slice(0, 240),
    planned_angle: plannedAngleFor(input.item, input.variant),
    scheduled_for: input.scheduledFor,
    due_status: deriveDueStatus(input.scheduledFor, new Date(input.now)),
    authorization_status: 'pending',
    authorization_due_at: defaultAuthorizationDueAt(input.scheduledFor),
    autonomy_eligible: false,
    metadata: buildActivationMetadata(input),
    created_by: input.actorUserId,
  }
}

async function maybeFindByJsonContains<T>(
  admin: SupabaseLike,
  table: string,
  column: string,
  value: Record<string, unknown>,
  eqFilter?: { column: string; value: string },
) {
  const query = asSelectQuery<T>(admin.from(table)).select('*')
  const contains = query.contains?.(column, value)
  if (!contains) return null
  const filtered = eqFilter && contains.eq ? contains.eq(eqFilter.column, eqFilter.value) : contains
  const result = filtered.maybeSingle
    ? await filtered.maybeSingle()
    : null
  if (!result) return null
  if (result.error) throw new Error(errorMessage(result.error, `Failed to read ${table}`))
  return (result.data ?? null) as T | null
}

async function findCampaignId(admin: SupabaseLike, slug?: string | null) {
  if (!slug) return null
  const query = asSelectQuery<CampaignRow>(admin.from('attraction_campaigns')).select('id')
  const result = query.eq ? await query.eq('slug', slug).maybeSingle?.() : null
  if (!result) return null
  if (result.error) throw new Error(errorMessage(result.error, 'Failed to read campaign'))
  return result.data?.id ?? null
}

async function findExistingCalendarRow(input: {
  admin: SupabaseLike
  idempotencyKey: string
  calendarAssetId?: string | null
  channel: SocialContentCalendarChannel
}) {
  const byIdempotency = await maybeFindByJsonContains<CalendarRow>(
    input.admin,
    'social_content_calendar_items',
    'metadata',
    { autoresearch_activation: { idempotency_key: input.idempotencyKey } },
    { column: 'channel', value: input.channel },
  )
  if (byIdempotency) return byIdempotency

  if (!input.calendarAssetId) return null
  return maybeFindByJsonContains<CalendarRow>(
    input.admin,
    'social_content_calendar_items',
    'metadata',
    { agentified_asset_id: input.calendarAssetId },
    { column: 'channel', value: input.channel },
  )
}

async function findExistingSocialContentRow(input: {
  admin: SupabaseLike
  idempotencyKey: string
  platform: SocialPlatform
  calendarAssetId?: string | null
}) {
  const byIdempotency = await maybeFindByJsonContains<SocialContentRow>(
    input.admin,
    'social_content_queue',
    'rag_context',
    { autoresearch_activation: { idempotency_key: input.idempotencyKey } },
    { column: 'platform', value: input.platform },
  )
  if (byIdempotency) return byIdempotency

  if (!input.calendarAssetId) return null
  return await maybeFindByJsonContains<SocialContentRow>(
    input.admin,
    'social_content_queue',
    'rag_context',
    { agentified_asset_id: input.calendarAssetId },
    { column: 'platform', value: input.platform },
  ) ?? maybeFindByJsonContains<SocialContentRow>(
    input.admin,
    'social_content_queue',
    'rag_context',
    { launch_draft_asset_id: input.calendarAssetId },
    { column: 'platform', value: input.platform },
  )
}

async function insertRow<T>(
  admin: SupabaseLike,
  table: string,
  row: Record<string, unknown>,
) {
  const result = await asSelectQuery<T>(admin.from(table))
    .insert(row)
    .select('*')
    .single()
  if (result.error || !result.data) {
    throw new Error(errorMessage(result.error, `Failed to insert ${table}`))
  }
  return result.data as T
}

async function updateCalendarLink(input: {
  admin: SupabaseLike
  calendarItemId: string
  socialContentId: string
  idempotencyKey: string
  existingMetadata?: Record<string, unknown> | null
}) {
  const metadata = asRecord(input.existingMetadata)
  const activation = asRecord(metadata.autoresearch_activation)
  const result = await asSelectQuery<CalendarRow>(input.admin.from('social_content_calendar_items'))
    .update({
      social_content_id: input.socialContentId,
      metadata: {
        ...metadata,
        autoresearch_activation: {
          ...activation,
          idempotency_key: input.idempotencyKey,
          social_content_id: input.socialContentId,
        },
        external_execution_enabled: false,
      },
    })
    .eq('id', input.calendarItemId)
  if (result.error) {
    throw new Error(errorMessage(result.error, 'Failed to link social content to calendar item'))
  }
}

export function findAutoResearchBacklogItem(
  itemId: string,
  items: CrossChannelAutoResearchBacklogItem[] = AGENTIFIED_AUTORESEARCH_BACKLOG_FIXTURES,
) {
  return items.find((item) => item.id === itemId) ?? null
}

export async function activateAutoResearchBacklogItem(input: {
  admin: SupabaseLike
  item: CrossChannelAutoResearchBacklogItem
  actorUserId: string
  channels?: AutoResearchBacklogChannel[]
  now?: Date
}): Promise<AutoResearchActivationResult> {
  const now = input.now ?? new Date()
  const nowIso = now.toISOString()
  const projection = projectAutoResearchBacklogItem(input.item)
  const requestedChannels = new Set(input.channels?.length
    ? input.channels
    : input.item.channelVariants.map((variant) => variant.channel))
  const variants = input.item.channelVariants.filter((variant) => requestedChannels.has(variant.channel))
  const records: AutoResearchActivationRecord[] = []
  let insertedCalendarItems = 0
  let insertedSocialContentRows = 0
  let reusedCalendarItems = 0
  let reusedSocialContentRows = 0

  if (projection.gates.source_basis.state !== 'approved') {
    const blocked = variants.map((variant) => {
      const channel = calendarChannelFor(variant.channel) ?? 'linkedin'
      return {
        channel,
        idempotencyKey: activationIdempotencyKey(input.item, channel),
        state: 'blocked' as const,
        calendarItemId: null,
        socialContentId: null,
        providerBlocked: true,
        manualOnly: true,
        reason: 'Source basis must be approved before creating durable calendar candidates.',
      }
    })
    return {
      itemId: input.item.id,
      title: input.item.title,
      records: blocked,
      blocked,
      summary: {
        requested: variants.length,
        insertedCalendarItems,
        insertedSocialContentRows,
        reusedCalendarItems,
        reusedSocialContentRows,
        blocked: blocked.length,
      },
      side_effects: {
        ...AUTORESEARCH_BACKLOG_SIDE_EFFECTS,
        provider_generation: false,
        external_schedule: false,
        external_post: false,
        social_content_draft_created: false,
        calendar_rows_created: false,
      },
      callable_external_actions: [],
    }
  }

  const campaignId = await findCampaignId(input.admin, input.item.campaignSlug)

  for (const variant of variants) {
    const channel = calendarChannelFor(variant.channel)
    if (!channel) {
      records.push({
        channel: 'linkedin',
        idempotencyKey: `autoresearch-calendar-activation:${input.item.id}:manual`,
        state: 'blocked',
        calendarItemId: null,
        socialContentId: null,
        providerBlocked: true,
        manualOnly: true,
        reason: 'Manual review packets stay separate from actionable calendar rows.',
      })
      continue
    }

    const idempotencyKey = activationIdempotencyKey(input.item, channel)
    const calendarAssetId = input.item.releaseLinkage?.calendarAssetId ?? null
    const providerBlocked = isProviderBlocked(input.item, variant)
    const manualOnly = isManualOnly(input.item, variant)
    const existingCalendar = await findExistingCalendarRow({
      admin: input.admin,
      idempotencyKey,
      calendarAssetId,
      channel,
    })
    if (existingCalendar) reusedCalendarItems += 1

    let socialContentId = existingCalendar?.social_content_id ?? null
    let socialState: 'inserted' | 'existing' | null = null

    if (!providerBlocked && supportsSocialContentQueue(channel)) {
      const expectedPlatform = QUEUE_CHANNELS[channel]
      const existingSocial = socialContentId
        ? { id: socialContentId }
        : expectedPlatform
          ? await findExistingSocialContentRow({
            admin: input.admin,
            idempotencyKey,
            platform: expectedPlatform,
            calendarAssetId,
          })
          : null
      if (existingSocial?.id) {
        socialContentId = existingSocial.id
        socialState = 'existing'
        reusedSocialContentRows += 1
      } else {
        const queueRow = queueRowFor({
          item: input.item,
          variant,
          channel,
          idempotencyKey,
          scheduledFor: scheduledFor(channel, now),
          now: nowIso,
          actorUserId: input.actorUserId,
        })
        if (queueRow) {
          const inserted = await insertRow<SocialContentRow>(input.admin, 'social_content_queue', queueRow)
          socialContentId = inserted.id
          socialState = 'inserted'
          insertedSocialContentRows += 1
        }
      }
    }

    let calendarItemId = existingCalendar?.id ?? null
    let state: AutoResearchActivationRecordState = existingCalendar ? 'existing' : 'inserted'
    if (!existingCalendar) {
      const inserted = await insertRow<CalendarRow>(
        input.admin,
        'social_content_calendar_items',
        calendarRowFor({
          item: input.item,
          variant,
          channel,
          idempotencyKey,
          campaignId,
          scheduledFor: scheduledFor(channel, now),
          now: nowIso,
          actorUserId: input.actorUserId,
          socialContentId,
        }),
      )
      calendarItemId = inserted.id
      insertedCalendarItems += 1
    } else if (!existingCalendar.social_content_id && socialContentId) {
      await updateCalendarLink({
        admin: input.admin,
        calendarItemId: existingCalendar.id,
        socialContentId,
        idempotencyKey,
        existingMetadata: existingCalendar.metadata,
      })
      state = 'linked'
    }

    records.push({
      channel,
      idempotencyKey,
      state,
      calendarItemId,
      socialContentId,
      providerBlocked,
      manualOnly,
      reason: providerBlocked
        ? approvalBoundaryFor(input.item, variant, providerBlocked)
        : socialState === 'inserted'
          ? 'Internal Social Content draft seed and calendar candidate created. Normal copy, media, handoff, final submit, provider, and reconciliation gates remain pending.'
          : 'Existing Portfolio records reused. Normal copy, media, handoff, final submit, provider, and reconciliation gates remain pending.',
    })
  }

  const blocked = records.filter((record) => record.providerBlocked || record.state === 'blocked')
  return {
    itemId: input.item.id,
    title: input.item.title,
    records,
    blocked,
    summary: {
      requested: variants.length,
      insertedCalendarItems,
      insertedSocialContentRows,
      reusedCalendarItems,
      reusedSocialContentRows,
      blocked: blocked.length,
    },
    side_effects: {
      ...AUTORESEARCH_BACKLOG_SIDE_EFFECTS,
      provider_generation: false,
      external_schedule: false,
      external_post: false,
      social_content_draft_created: insertedSocialContentRows > 0,
      calendar_rows_created: insertedCalendarItems > 0,
    },
    callable_external_actions: [],
  }
}
