import { createAgentWorkItem } from '@/lib/agent-work-items'
import { supabaseAdmin } from '@/lib/supabase'
import {
  CALENDAR_CHANNEL_LABELS,
  CALENDAR_SIDE_EFFECTS,
  parseMetadata,
  type SocialContentCalendarItem,
} from '@/lib/social-content-calendar'

type CalendarActionAuth = {
  user: {
    id: string
  }
}

type HandoffResult = {
  calendarItem: SocialContentCalendarItem
  socialContentId: string | null
  handoffWorkItemId: string
  handoffKind: 'linkedin_social_content_draft' | 'channel_planning_handoff'
}

function calendarSelect() {
  return `
    *,
    attraction_campaigns (id, name, slug, status, starts_at, ends_at),
    agent_work_items (id, title, status, priority),
    social_content_queue (id, status, post_text, scheduled_for)
  `
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function campaignName(item: SocialContentCalendarItem) {
  return item.attraction_campaigns?.name ?? 'Unassigned campaign'
}

function buildDraftSeed(item: SocialContentCalendarItem) {
  const plannedAngle = cleanText(item.planned_angle)
  return [
    `Calendar draft seed: ${item.title}`,
    plannedAngle ? `Planned angle: ${plannedAngle}` : null,
    `Campaign phase: ${item.campaign_phase}`,
    'This is an internal draft seed. Shaka/content agents should turn it into reviewed channel copy before any publish approval.',
  ].filter(Boolean).join('\n\n')
}

function buildDraftRagContext(item: SocialContentCalendarItem, auth: CalendarActionAuth) {
  const metadata = parseMetadata(item.metadata)
  return {
    source: 'social_content_calendar_authorization',
    source_type: 'social_content_calendar_item',
    calendar_item_id: item.id,
    campaign_id: item.campaign_id,
    campaign_name: campaignName(item),
    campaign_phase: item.campaign_phase,
    channel: item.channel,
    planned_angle: item.planned_angle,
    scheduled_for: item.scheduled_for,
    authorization_status: 'authorized',
    authorized_at: new Date().toISOString(),
    authorized_by: auth.user.id,
    publish_gate: 'draft_only',
    external_execution_enabled: false,
    approval_boundary: 'Internal draft handoff only. This does not publish, schedule externally, upload, call media providers, or create public content.',
    linked_agent_work_item_id: item.agent_work_item_id,
    calendar_metadata: metadata,
  }
}

async function readCalendarItem(id: string): Promise<SocialContentCalendarItem> {
  const { data, error } = await supabaseAdmin
    .from('social_content_calendar_items')
    .select(calendarSelect())
    .eq('id', id)
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Calendar item not found')
  }

  return data as SocialContentCalendarItem
}

async function findExistingLinkedInDraft(calendarItemId: string) {
  const { data, error } = await supabaseAdmin
    .from('social_content_queue')
    .select('id')
    .contains('rag_context', {
      source: 'social_content_calendar_authorization',
      calendar_item_id: calendarItemId,
    })
    .maybeSingle()

  if (error) throw new Error(`Failed to check existing Social Content draft: ${error.message}`)
  return typeof data?.id === 'string' ? data.id : null
}

async function createLinkedInSocialContentDraft(item: SocialContentCalendarItem, auth: CalendarActionAuth) {
  const existingId = item.social_content_id ?? (await findExistingLinkedInDraft(item.id))
  if (existingId) return existingId

  const ragContext = buildDraftRagContext(item, auth)
  const { data, error } = await supabaseAdmin
    .from('social_content_queue')
    .insert({
      platform: 'linkedin',
      status: 'draft',
      post_text: buildDraftSeed(item),
      cta_text: null,
      cta_url: null,
      hashtags: ['#AIProduct', '#ProductManagement', '#AmaduTownAdvisory'],
      image_prompt: null,
      framework_visual_type: null,
      topic_extracted: {
        topic: item.title,
        angle: item.planned_angle ?? item.title,
        key_insight: 'Calendar-authorized Shaka insight requires governed copy production.',
        personal_tie_in: 'Queued from a campaign-aware Content Intelligence calendar gate.',
        framework_visual: 'architecture',
      },
      hormozi_framework: {
        framework_type: 'campaign_calendar_handoff',
        hook_type: 'triggering_event',
        proof_pattern: 'Shaka insight plus approved research evidence',
        cta_pattern: 'human-reviewed channel CTA',
      },
      rag_context: ragContext,
      admin_notes: [
        'Created by Content Intelligence calendar authorization.',
        'Draft handoff only. Publishing, external scheduling, media generation, uploads, and provider sends remain separately approval-gated.',
        `Calendar item: ${item.id}`,
        `Campaign: ${campaignName(item)}`,
        `Scheduled intent: ${item.scheduled_for}`,
      ].join('\n'),
      target_platforms: ['linkedin'],
      video_generation_method: 'none',
      content_format: 'single_image',
      content_pillar: 'technology_as_equalizer',
      companion_post_text: null,
      scheduled_for: null,
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new Error(error?.message ?? 'Failed to create Social Content draft')
  }

  return String(data.id)
}

async function createDraftHandoffWorkItem(input: {
  item: SocialContentCalendarItem
  socialContentId: string | null
  auth: CalendarActionAuth
}) {
  const { item, socialContentId, auth } = input
  const channelLabel = CALENDAR_CHANNEL_LABELS[item.channel]
  const isLinkedInDraft = item.channel === 'linkedin' && Boolean(socialContentId)

  return createAgentWorkItem({
    title: `Prepare ${channelLabel} draft handoff: ${item.title}`,
    objective: [
      `Use the authorized calendar item to prepare the ${channelLabel} draft handoff.`,
      item.planned_angle ? `Planned angle: ${item.planned_angle}` : null,
      isLinkedInDraft && socialContentId
        ? `Continue in the Social Content draft at /admin/social-content/${socialContentId}.`
        : 'Prepare planning/export-readiness inputs only; this channel does not have an approved publishing integration in V1.',
      'Do not publish, schedule externally, upload, call media providers, or create public content from this gate.',
    ].filter(Boolean).join(' '),
    priority: 'high',
    status: 'queued',
    ownerAgentKey: 'content-repurposing',
    ownerRuntime: 'codex',
    source: {
      type: 'social_content_calendar_authorization',
      id: item.id,
      label: item.title,
    },
    overlapGroup: 'social-content-calendar',
    metadata: {
      source: 'social_content_calendar_authorization',
      calendar_item_id: item.id,
      campaign_id: item.campaign_id,
      campaign_name: campaignName(item),
      agent_work_item_id: item.agent_work_item_id,
      social_content_id: socialContentId,
      channel: item.channel,
      campaign_phase: item.campaign_phase,
      scheduled_for: item.scheduled_for,
      authorized_by: auth.user.id,
      authorized_at: new Date().toISOString(),
      draft_handoff_only: true,
      external_execution_enabled: false,
      approval_boundary: 'internal_platform_draft_handoff_only',
      side_effects: {
        ...CALENDAR_SIDE_EFFECTS,
        social_content_draft_created: Boolean(socialContentId),
      },
    },
    idempotencyKey: `social-content-calendar-draft-handoff:${item.id}`,
  })
}

export async function authorizeCalendarDraftHandoff(
  id: string,
  auth: CalendarActionAuth,
): Promise<HandoffResult> {
  const item = await readCalendarItem(id)
  const metadata = parseMetadata(item.metadata)
  const socialContentId = item.channel === 'linkedin'
    ? await createLinkedInSocialContentDraft(item, auth)
    : item.social_content_id

  const handoffWorkItem = await createDraftHandoffWorkItem({
    item,
    socialContentId,
    auth,
  })

  const nextMetadata = {
    ...metadata,
    authorized_at: new Date().toISOString(),
    authorized_by: auth.user.id,
    draft_handoff_only: true,
    external_execution_enabled: false,
    platform_draft_handoff: {
      kind: item.channel === 'linkedin' ? 'linkedin_social_content_draft' : 'channel_planning_handoff',
      status: 'queued',
      work_item_id: handoffWorkItem.id,
      social_content_id: socialContentId,
      created_at: new Date().toISOString(),
    },
  }

  const { data, error } = await supabaseAdmin
    .from('social_content_calendar_items')
    .update({
      authorization_status: 'authorized',
      social_content_id: socialContentId,
      metadata: nextMetadata,
    })
    .eq('id', id)
    .select(calendarSelect())
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to authorize calendar draft handoff')
  }

  return {
    calendarItem: data as SocialContentCalendarItem,
    socialContentId,
    handoffWorkItemId: handoffWorkItem.id,
    handoffKind: item.channel === 'linkedin' ? 'linkedin_social_content_draft' : 'channel_planning_handoff',
  }
}

export async function rejectCalendarDraftHandoff(input: {
  id: string
  decisionNote: string
  auth: CalendarActionAuth
}) {
  const item = await readCalendarItem(input.id)
  const metadata = parseMetadata(item.metadata)
  const rejectedAt = new Date().toISOString()
  const revisionWorkItem = await createAgentWorkItem({
    title: `Revise content calendar item: ${item.title}`,
    objective: [
      `Revise the ${CALENDAR_CHANNEL_LABELS[item.channel]} calendar item before it can be authorized.`,
      `Decision note: ${input.decisionNote}`,
      'Return the revised item to pending review. Do not publish, schedule externally, upload, call media providers, or create public content.',
    ].join(' '),
    priority: 'high',
    status: 'queued',
    ownerAgentKey: 'chief-of-staff',
    ownerRuntime: 'codex',
    source: {
      type: 'social_content_calendar_revision',
      id: item.id,
      label: item.title,
    },
    overlapGroup: 'social-content-calendar',
    metadata: {
      source: 'social_content_calendar_revision',
      calendar_item_id: item.id,
      campaign_id: item.campaign_id,
      agent_work_item_id: item.agent_work_item_id,
      social_content_id: item.social_content_id,
      channel: item.channel,
      campaign_phase: item.campaign_phase,
      decision_note: input.decisionNote,
      rejected_by: input.auth.user.id,
      rejected_at: rejectedAt,
      returned_to_shaka: true,
      external_execution_enabled: false,
      side_effects: CALENDAR_SIDE_EFFECTS,
    },
    idempotencyKey: `social-content-calendar-revision:${item.id}:${Date.parse(rejectedAt)}`,
  })

  const { data, error } = await supabaseAdmin
    .from('social_content_calendar_items')
    .update({
      authorization_status: 'rejected',
      metadata: {
        ...metadata,
        authorization_decision_note: input.decisionNote,
        rejected_at: rejectedAt,
        rejected_by: input.auth.user.id,
        returned_to_shaka: true,
        revision_work_item_id: revisionWorkItem.id,
        external_execution_enabled: false,
      },
    })
    .eq('id', input.id)
    .select(calendarSelect())
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to reject calendar draft handoff')
  }

  return {
    calendarItem: data as SocialContentCalendarItem,
    revisionWorkItemId: revisionWorkItem.id,
  }
}
