import { supabaseAdmin } from '@/lib/supabase'
import {
  OFFICIAL_CAMPAIGN_CANDIDATE_KEY,
  OFFICIAL_CAMPAIGN_PACKET_IDS,
  officialCampaignBacklogRow,
  projectOfficialCampaignHandoff,
  type OfficialCampaignProjection,
} from '@/lib/social-official-campaign-handoff'
import type { SocialTopicSourceProjection } from '@/lib/social-topic-source-receipts'

type Row = Record<string, any>
const TABLE = 'social_topic_backlog'
const PACKET_TABLE = 'social_content_research_packets'
const RECEIPT_TABLE = 'social_topic_source_receipts'
const CALENDAR_TABLE = 'social_content_calendar_items'
const CONTENT_TABLE = 'social_content_queue'
const GATE_ROLES = ['product_visual', 'outlier_linkedin', 'outlier_youtube', 'privacy', 'originality'] as const

function object(value: unknown): Row { return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {} }
function message(error: unknown) { return error instanceof Error ? error.message : 'handoff_read_or_write_failed' }

export async function readOfficialCampaignHandoff(now = new Date().toISOString()) {
  // Exact-ID reads only. This never scans private content or runs a collector.
  const [packetResult, productResult, calendarResult, backlogResult, ...gateResults] = await Promise.all([
    supabaseAdmin.from(PACKET_TABLE).select('id,title,source_url,status,updated_at,actor_metadata').in('id', [...OFFICIAL_CAMPAIGN_PACKET_IDS]),
    supabaseAdmin.from(RECEIPT_TABLE).select('*').in('source_id', ['portfolio:agent-operations-control-plane', 'portfolio:memory-calendar-and-evidence-plane']),
    supabaseAdmin.from(CALENDAR_TABLE).select('*').contains('metadata', { official_campaign_candidate_key: OFFICIAL_CAMPAIGN_CANDIDATE_KEY }).in('channel', ['linkedin', 'youtube']).limit(3),
    supabaseAdmin.from(TABLE).select('id,candidate_key,metadata,updated_at,status').eq('candidate_key', OFFICIAL_CAMPAIGN_CANDIDATE_KEY).maybeSingle(),
    ...GATE_ROLES.map((role) => supabaseAdmin.from(RECEIPT_TABLE).select('*').eq('product_identity', 'portfolio').contains('metadata', { official_campaign_gate: role }).limit(2)),
  ])
  if (packetResult.error || productResult.error || calendarResult.error || backlogResult.error || gateResults.some((result) => result.error))
    throw new Error('official_campaign_evidence_read_failed')
  if ((calendarResult.data?.length ?? 0) > 2 || gateResults.some((result) => (result.data?.length ?? 0) > 1))
    throw new Error('official_campaign_evidence_ambiguous')
  const projection = projectOfficialCampaignHandoff({
    packets: (packetResult.data ?? []) as Row[],
    productReceipts: (productResult.data ?? []) as SocialTopicSourceProjection[],
    gateReceipts: gateResults.flatMap((result) => (result.data ?? []) as SocialTopicSourceProjection[]),
    calendar: (calendarResult.data ?? []) as Row[],
    now,
  })
  return { projection, backlog: backlogResult.data as Row | null, calendar: (calendarResult.data ?? []) as Row[] }
}

async function saveBacklog(projection: OfficialCampaignProjection, existing: Row | null, now: string) {
  const prior = object(object(existing?.metadata).official_campaign_handoff)
  if (prior.input_version === projection.input_version && prior.status === projection.status
    && JSON.stringify(prior.blockers) === JSON.stringify(projection.blockers)
    && JSON.stringify(prior.channel_reviews) === JSON.stringify(projection.channel_reviews)) return 'unchanged' as const
  const row = officialCampaignBacklogRow(projection, now)
  if (existing) {
    // Do not reset a human-selected or completed topic. The existing metadata
    // is preserved, and a concurrent edit must win over this producer.
    if (existing.status !== 'available') throw new Error('official_campaign_backlog_sealed')
    const { data, error } = await supabaseAdmin.from(TABLE).update({ ...row, metadata: { ...object(existing.metadata), ...row.metadata } })
      .eq('id', existing.id).eq('updated_at', existing.updated_at).select('id').maybeSingle()
    if (error || !data) throw new Error('official_campaign_backlog_conflict')
  } else {
    const { error } = await supabaseAdmin.from(TABLE).insert(row)
    if (error) throw new Error(error.code === '23505' ? 'official_campaign_backlog_conflict' : 'official_campaign_backlog_write_failed')
  }
  return 'saved' as const
}

async function ensureReviewContent(projection: OfficialCampaignProjection, review: OfficialCampaignProjection['channel_reviews'][number]) {
  const { data: existing, error: readError } = await supabaseAdmin.from(CONTENT_TABLE).select('id,status,rag_context,scheduled_for,published_at,platform_post_id')
    .eq('id', review.content_id).maybeSingle()
  if (readError) throw new Error('official_campaign_review_read_failed')
  if (existing) {
    const context = object(existing.rag_context)
    if (existing.status !== 'draft' || existing.scheduled_for || existing.published_at || existing.platform_post_id
      || context.official_campaign_input_version !== projection.input_version) throw new Error('official_campaign_review_conflict')
    return 'unchanged' as const
  }
  const context = {
    source: 'official_signal_campaign_handoff', candidate_key: projection.candidate_key,
    official_campaign_input_version: projection.input_version, channel: review.channel,
    source_lineage: projection.source_lineage, product_receipt_ids: projection.product_receipt_ids,
    gate_receipts: projection.gate_receipts,
    calendar_item_id: review.calendar_item_id, thumbnail_teaser: review.thumbnail_teaser,
    title_thumbnail_relationship: review.channel === 'youtube' ? 'complementary_teaser' : null,
    source_proof_required: true, copy_approved: false, asset_approved: false,
    external_execution_enabled: false, approval_status: 'in_review', side_effects: projection.side_effects,
  }
  const insert: Row = {
    id: review.content_id, platform: review.channel, target_platforms: [review.channel],
    status: 'draft', post_text: review.copy, rag_context: context,
    is_test_data: false,
  }
  if (review.channel === 'youtube') {
    insert.youtube_title = review.title
    insert.youtube_description = 'A review of recent official agent releases, then a Portfolio walkthrough of source evidence, human decisions, and permission boundaries. Source links and final visual evidence remain in review.'
  }
  const { error } = await supabaseAdmin.from(CONTENT_TABLE).insert(insert)
  if (error) throw new Error(error.code === '23505' ? 'official_campaign_review_conflict' : 'official_campaign_review_write_failed')
  return 'created' as const
}

async function bindCalendar(projection: OfficialCampaignProjection, review: OfficialCampaignProjection['channel_reviews'][number], row: Row) {
  if (!row || row.id !== review.calendar_item_id || row.channel !== review.channel || row.authorization_status !== 'pending')
    throw new Error('official_campaign_calendar_conflict')
  if (row.social_content_id === review.content_id && object(object(row.metadata).official_campaign_handoff).input_version === projection.input_version)
    return
  if (row.social_content_id) throw new Error('official_campaign_calendar_conflict')
  const nextMetadata = { ...object(row.metadata), official_campaign_handoff: {
    candidate_key: projection.candidate_key, input_version: projection.input_version,
    content_id: review.content_id, source_packet_ids: projection.packet_ids,
    review_only: true, external_execution_enabled: false,
  } }
  const { data, error } = await supabaseAdmin.from(CALENDAR_TABLE)
    .update({ social_content_id: review.content_id, metadata: nextMetadata })
    .eq('id', row.id).eq('updated_at', row.updated_at).is('social_content_id', null)
    .select('id').maybeSingle()
  if (error || !data) throw new Error('official_campaign_calendar_conflict')
}

export async function prepareOfficialCampaignHandoff(now = new Date().toISOString()) {
  const snapshot = await readOfficialCampaignHandoff(now)
  let projection = snapshot.projection
  if (snapshot.backlog && snapshot.backlog.status !== 'available') throw new Error('official_campaign_backlog_sealed')
  if (projection.status === 'review_ready') {
    try {
      for (const review of projection.channel_reviews) await ensureReviewContent(projection, review)
      for (const review of projection.channel_reviews) await bindCalendar(projection, review, snapshot.calendar.find((row) => row.id === review.calendar_item_id) as Row)
    } catch (error) {
      projection = { ...projection, status: 'blocked', channel_reviews: [], blockers: [...projection.blockers, {
        code: 'review_binding_incomplete', observed: message(error), required: 'two matching unsealed channel reviews and calendar bindings',
        owner: 'social_content_editor', next_action: 'Inspect the existing draft and calendar rows, then retry this exact evidence version.',
        href: '/admin/agents/content-intelligence?section=calendar',
      }] }
    }
  }
  const persistence = await saveBacklog(projection, snapshot.backlog, now)
  return { projection, persistence }
}
