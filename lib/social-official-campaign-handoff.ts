import { createHash } from 'crypto'
import { validOfficialSignalAttribution } from '@/lib/social-official-live-signals'
import { validatePublicSignalMeasurement } from '@/lib/social-public-signal-measurement'
import type { SocialTopicSourceProjection } from '@/lib/social-topic-source-receipts'

export const OFFICIAL_CAMPAIGN_PACKET_IDS = [
  'c10915a5-4cda-4d2b-843d-9d37e11c0790',
  '23427cb8-0331-4b18-9de0-5f2bd64abe02',
  '82919e2b-a395-4445-9248-11d4affbe08d',
] as const
export const OFFICIAL_CAMPAIGN_CANDIDATE_KEY = 'topic-portfolio-agentic-operating-system-official-signals-v1'
export const OFFICIAL_CAMPAIGN_HANDOFF_VERSION = 'official-signal-campaign-handoff/v1'
const PRODUCT_SOURCE_IDS = [
  'portfolio:agent-operations-control-plane',
  'portfolio:memory-calendar-and-evidence-plane',
] as const
const DAY = 86_400_000

type Row = Record<string, any>
export type OfficialCampaignBlocker = {
  code: string
  observed: string | number
  required: string | number
  owner: string
  next_action: string
  href: string
}
export type OfficialCampaignProjection = {
  version: typeof OFFICIAL_CAMPAIGN_HANDOFF_VERSION
  candidate_key: typeof OFFICIAL_CAMPAIGN_CANDIDATE_KEY
  status: 'blocked' | 'review_ready'
  review_only: true
  input_version: string
  packet_ids: string[]
  product_receipt_ids: string[]
  gate_receipts: Array<{ role: string; receipt_id: string; source_id: string; asset_path: string | null; route_path: string | null }>
  blockers: OfficialCampaignBlocker[]
  channel_reviews: Array<{ channel: 'linkedin' | 'youtube'; title: string; thumbnail_teaser: string | null; copy: string; content_id: string; calendar_item_id: string }>
  source_lineage: Array<{ packet_id: string; title: string; source_url: string; coverage_identity: string; source_fingerprint: string; measurement_receipt_id: string | null }>
  side_effects: { approval: false; provider_call: false; render: false; upload: false; platform_draft: false; external_schedule: false; publish: false; external_send: false }
}

const CLOSED = { approval: false, provider_call: false, render: false, upload: false, platform_draft: false, external_schedule: false, publish: false, external_send: false } as const
const obj = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}
const str = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const array = (value: unknown): string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim())) : []
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const sourceHash = (value: string) => createHash('sha256').update(value).digest('hex')
const intactSummary = (receipt: SocialTopicSourceProjection | undefined) => Boolean(receipt
  && str(receipt.approved_summary) && receipt.summary_sha256 === sourceHash(receipt.approved_summary)
  && Number.isFinite(Date.parse(receipt.approved_at)) && str(receipt.approved_by))
function stableUuid(value: string) {
  const hex = hash(value).slice(0, 32).split('')
  hex[12] = '5'
  hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16)
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`
}
function block(code: string, observed: string | number, required: string | number, owner: string, nextAction: string, href: string): OfficialCampaignBlocker {
  return { code, observed, required, owner, next_action: nextAction, href }
}

// These are review concepts, not approved copy or media. Exact claims are limited
// to the two approved Portfolio implementation receipts and the three sources.
const CHANNELS = {
  linkedin: {
    title: 'Who decides when an AI agent can act?',
    thumbnail_teaser: null,
    copy: 'Agent capability is moving quickly. OpenAI and Meta have each published new work on agent systems.\n\nPortfolio is where I am building the other half of that story: source evidence, human decisions, and clear permission boundaries around agent work.\n\nWhat decision would you keep in human hands?',
  },
  youtube: {
    title: 'Who Gives an AI Agent Permission to Act?',
    thumbnail_teaser: 'WHO DECIDES?',
    copy: 'OpenAI and Meta have published recent work on agents. This review outlines a Portfolio walkthrough: show the source trail, the human decision, and the point where execution stays closed. The final script, visual proof, thumbnail, and description still need separate review.',
  },
} as const

export function projectOfficialCampaignHandoff(input: {
  packets: Row[]
  productReceipts: SocialTopicSourceProjection[]
  gateReceipts: SocialTopicSourceProjection[]
  calendar: Row[]
  now: string
}): OfficialCampaignProjection {
  const blockers: OfficialCampaignBlocker[] = []
  const nowMs = Date.parse(input.now)
  const packets = OFFICIAL_CAMPAIGN_PACKET_IDS.map((id) => input.packets.find((row) => row.id === id))
  const productReceipts = PRODUCT_SOURCE_IDS.map((id) => input.productReceipts.find((row) => row.source_id === id))
  const sourceLineage = packets.flatMap((packet) => {
    if (!packet) return []
    const official = obj(obj(packet.actor_metadata).official_signal)
    const measurement = obj(obj(packet.actor_metadata).public_signal_measurement_receipt)
    return [{ packet_id: packet.id, title: str(packet.title), source_url: str(packet.source_url), coverage_identity: str(official.coverage_identity),
      source_fingerprint: str(official.source_fingerprint), measurement_receipt_id: str(measurement.receipt_id) || null }]
  })
  const inputVersion = `sha256:${hash({ version: OFFICIAL_CAMPAIGN_HANDOFF_VERSION, channel_copy: CHANNELS,
    packets: packets.map((row) => row ? { id: row.id, status: row.status, updated_at: row.updated_at, actor_metadata: row.actor_metadata } : null),
    productReceipts: productReceipts.map((row) => row ? { receipt_id: row.receipt_id, summary_sha256: row.summary_sha256, metadata: row.metadata } : null),
    gates: input.gateReceipts.filter((row) => !['privacy', 'originality'].includes(str(obj(row.metadata).official_campaign_gate)))
      .map((row) => ({ receipt_id: row.receipt_id, summary_sha256: row.summary_sha256, metadata: row.metadata })),
    calendar: input.calendar.map((row) => ({ id: row.id, channel: row.channel, campaign_id: row.campaign_id,
      scheduled_for: row.scheduled_for, candidate_key: obj(row.metadata).official_campaign_candidate_key })),
  })}`

  if (!Number.isFinite(nowMs)) blockers.push(block('clock_invalid', input.now, 'valid evaluation time', 'social_content_research', 'Retry with a valid server clock.', '/admin/social-content?workflow=evidence'))
  for (let index = 0; index < packets.length; index += 1) {
    const id = OFFICIAL_CAMPAIGN_PACKET_IDS[index]
    const packet = packets[index]
    if (!packet) { blockers.push(block('official_packet_missing', id, 'one exact packet', 'social_content_research', 'Restore the named official packet in Content Intelligence.', `/admin/agents/content-intelligence?section=research&packet=${encodeURIComponent(id)}`)); continue }
    const metadata = obj(packet.actor_metadata)
    const official = obj(metadata.official_signal)
    const momentum = obj(metadata.topic_momentum_receipt)
    const attributionMetadata = { ...metadata,
      official_signal: { ...official, evidence_status: 'pending_review' },
      topic_momentum_receipt: { ...momentum, approval_status: 'pending' },
    }
    const attributable = validOfficialSignalAttribution({ source_url: str(packet.source_url), title: str(packet.title), actor_metadata: attributionMetadata })
      && str(official.source_fingerprint) === sourceHash(`${packet.source_url}|${official.coverage_identity}|${packet.title}`)
    if (!attributable || official.raw_content_included !== false || momentum.raw_content_included !== false)
      blockers.push(block('official_attribution_invalid', id, 'exact attributable public source', 'social_content_research', 'Recheck the official source and packet lineage.', `/admin/agents/content-intelligence?section=research&packet=${encodeURIComponent(id)}`))
    if (!Number.isFinite(nowMs) || Date.parse(str(official.expires_at)) <= nowMs || Date.parse(str(official.published_at)) > nowMs)
      blockers.push(block('official_packet_stale', str(official.expires_at) || 'missing', 'current source window', 'social_content_research', 'Refresh the official source and review the replacement packet.', `/admin/agents/content-intelligence?section=research&packet=${encodeURIComponent(id)}`))
    if (packet.status !== 'approved' || official.evidence_status !== 'approved' || momentum.approval_status !== 'approved' || momentum.privacy_classification !== 'public_safe')
      blockers.push(block('official_review_pending', `${packet.status}/${momentum.approval_status}`, 'approved/approved, public safe', 'content_reviewer', 'Review the exact public claim and privacy receipt in Content Intelligence.', `/admin/agents/content-intelligence?section=research&packet=${encodeURIComponent(id)}`))
    const measurement = metadata.public_signal_measurement_receipt
    const measured = validatePublicSignalMeasurement({ stored: measurement, submitted: measurement,
      coverageIdentity: str(official.coverage_identity), officialSourceUrl: str(packet.source_url), now: input.now })
    if (!measured.valid) blockers.push(block('source_measurement_unscored', measured.reason, '3 approved unique sources across 2 hosts; attention and relevance >= 0.65', 'social_content_research', 'Add exact public observations, approve them, and prepare a source-bound measurement.', `/admin/agents/content-intelligence?section=research&packet=${encodeURIComponent(id)}`))
    else if (packet.status === 'approved' && momentum.measurement_receipt_id !== measured.receipt.receipt_id)
      blockers.push(block('measurement_lineage_mismatch', str(momentum.measurement_receipt_id) || 'none', measured.receipt.receipt_id, 'social_content_research', 'Reconcile the approved momentum receipt with the exact source-bound measurement.', `/admin/agents/content-intelligence?section=research&packet=${encodeURIComponent(id)}`))
  }
  for (let index = 0; index < productReceipts.length; index += 1) {
    const receipt = productReceipts[index]
    if (!receipt || !intactSummary(receipt) || receipt.product_identity !== 'portfolio' || receipt.approval_status !== 'approved'
      || receipt.privacy_classification !== 'public_safe' || receipt.raw_content_included !== false
      || receipt.source_kind !== 'approved_repository_implementation' || !str(receipt.provenance)
      || !array(obj(receipt.metadata).topic_identities).includes('agentic_operating_systems'))
      blockers.push(block('portfolio_product_proof_missing', PRODUCT_SOURCE_IDS[index], 'approved Portfolio implementation receipt', 'portfolio_product_owner', 'Restore the privacy-safe approved repository proof for Portfolio.', '/admin/social-content?workflow=evidence'))
  }

  const gateBy = (role: string) => input.gateReceipts.find((row) => obj(row.metadata).official_campaign_gate === role)
  const visual = gateBy('product_visual')
  const visualMeta = obj(visual?.metadata)
  if (!visual || !intactSummary(visual) || visual.product_identity !== 'portfolio' || visual.approval_status !== 'approved' || visual.privacy_classification !== 'public_safe'
    || visual.raw_content_included !== false || !/^sha256:[a-f0-9]{64}$/.test(str(visualMeta.asset_sha256))
    || !str(visualMeta.asset_path).startsWith('/') || !str(visualMeta.route_path).startsWith('/admin/')
    || visualMeta.privacy_review_status !== 'approved' || visualMeta.rights_status !== 'owned'
    || !Number.isFinite(Date.parse(str(visualMeta.captured_at))) || Date.parse(str(visualMeta.captured_at)) > nowMs
    || nowMs - Date.parse(str(visualMeta.captured_at)) > 30 * DAY
    || !array(visualMeta.claim_bindings).includes('portfolio_governed_agent_operations'))
    blockers.push(block('product_visual_proof_missing', visual?.receipt_id ?? 'none', 'owned current screenshot or route proof with hash, rights and privacy review', 'portfolio_product_owner', 'Capture a redacted Portfolio route and bind it to the agent-control claim.', '/admin/social-content?workflow=evidence'))
  for (const channel of ['linkedin', 'youtube'] as const) {
    const outlier = gateBy(`outlier_${channel}`)
    const outlierMeta = obj(outlier?.metadata)
    const sourceUrls = array(outlierMeta.source_urls)
    const scores = Array.isArray(outlierMeta.normalized_scores) ? outlierMeta.normalized_scores : []
    const allowedSource = channel === 'youtube' ? /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=/ : /^https:\/\/(?:www\.)?linkedin\.com\/posts\//
    if (!outlier || !intactSummary(outlier) || outlier.product_identity !== 'portfolio' || outlier.approval_status !== 'approved' || outlier.privacy_classification !== 'public_safe'
      || outlier.raw_content_included !== false || outlierMeta.status !== 'passed' || outlierMeta.route !== 'social-content-outlier-decision/v1'
      || outlierMeta.channel !== channel || Number(outlierMeta.minimum_sample_size) < 5 || sourceUrls.length < 5 || new Set(sourceUrls).size !== sourceUrls.length
      || sourceUrls.some((url) => !allowedSource.test(url)) || scores.length !== sourceUrls.length
      || scores.some((score) => typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100)
      || Number(outlierMeta.outlier_threshold) < 75 || !scores.some((score) => score >= Number(outlierMeta.outlier_threshold))
      || !Number.isFinite(Date.parse(str(outlierMeta.observed_at))) || Date.parse(str(outlierMeta.observed_at)) > nowMs
      || !Number.isFinite(Date.parse(str(outlierMeta.fresh_until))) || Date.parse(str(outlierMeta.fresh_until)) <= nowMs
      || Date.parse(str(outlierMeta.fresh_until)) > Date.parse(str(outlierMeta.observed_at)) + 7 * DAY
      || outlierMeta.curated_playlist_performance_weight !== 0
      || !array(outlierMeta.topic_identities).includes('agentic_operating_systems'))
      blockers.push(block(`outlier_${channel}_missing`, outlier?.receipt_id ?? 'none', `5 current ${channel} comparables, one score >= 75, playlist weight 0`, 'social_content_research', `Record a current same-topic ${channel} outlier decision with included and excluded comparisons.`, '/admin/social-content?workflow=evidence'))
  }
  for (const role of ['privacy', 'originality'] as const) {
    const receipt = gateBy(role)
    const metadata = obj(receipt?.metadata)
    if (!receipt || !intactSummary(receipt) || receipt.product_identity !== 'portfolio' || receipt.approval_status !== 'approved'
      || receipt.privacy_classification !== 'public_safe' || receipt.raw_content_included !== false
      || metadata.status !== 'passed' || metadata.input_version !== inputVersion)
      blockers.push(block(`${role}_receipt_missing`, receipt?.receipt_id ?? 'none', `passed receipt bound to ${inputVersion}`, role === 'privacy' ? 'privacy_reviewer' : 'content_reviewer', `Review the exact ${role} boundary against this evidence version.`, '/admin/social-content?workflow=evidence'))
  }
  const calendar = (['linkedin', 'youtube'] as const).map((channel) => input.calendar.find((row) => row.channel === channel
    && obj(row.metadata).official_campaign_candidate_key === OFFICIAL_CAMPAIGN_CANDIDATE_KEY))
  for (let index = 0; index < calendar.length; index += 1) {
    const row = calendar[index]
    const expectedId = stableUuid(`${OFFICIAL_CAMPAIGN_CANDIDATE_KEY}:${index === 0 ? 'linkedin' : 'youtube'}:${inputVersion}`)
    const bound = obj(obj(row?.metadata).official_campaign_handoff)
    if (!row || row.authorization_status !== 'pending' || (row.social_content_id && (row.social_content_id !== expectedId || bound.input_version !== inputVersion)) || Date.parse(str(row.scheduled_for)) <= nowMs)
      blockers.push(block('calendar_slot_missing', row?.id ?? 'none', `future pending ${index === 0 ? 'LinkedIn' : 'YouTube'} review slot`, 'social_content_editor', 'Create or clear the existing campaign calendar slot and bind this candidate key in its metadata.', '/admin/agents/content-intelligence?section=calendar'))
  }
  if (calendar[0] && calendar[1] && (!calendar[0].campaign_id || calendar[0].campaign_id !== calendar[1].campaign_id))
    blockers.push(block('campaign_binding_ambiguous', `${calendar[0].campaign_id}/${calendar[1].campaign_id}`, 'same existing campaign', 'social_content_editor', 'Put both channel slots in one campaign.', '/admin/agents/content-intelligence?section=calendar'))

  const channelReviews = blockers.length ? [] : (['linkedin', 'youtube'] as const).map((channel, index) => ({
    channel, ...CHANNELS[channel], content_id: stableUuid(`${OFFICIAL_CAMPAIGN_CANDIDATE_KEY}:${channel}:${inputVersion}`), calendar_item_id: str(calendar[index]?.id),
  }))
  return { version: OFFICIAL_CAMPAIGN_HANDOFF_VERSION, candidate_key: OFFICIAL_CAMPAIGN_CANDIDATE_KEY,
    status: blockers.length ? 'blocked' : 'review_ready', review_only: true, input_version: inputVersion,
    packet_ids: [...OFFICIAL_CAMPAIGN_PACKET_IDS], product_receipt_ids: productReceipts.flatMap((row) => row ? [row.receipt_id] : []),
    gate_receipts: input.gateReceipts.map((row) => ({ role: str(obj(row.metadata).official_campaign_gate), receipt_id: row.receipt_id,
      source_id: row.source_id, asset_path: str(obj(row.metadata).asset_path) || null, route_path: str(obj(row.metadata).route_path) || null })),
    blockers, channel_reviews: channelReviews, source_lineage: sourceLineage, side_effects: CLOSED }
}

export function officialCampaignBacklogRow(projection: OfficialCampaignProjection, now: string) {
  const ready = projection.status === 'review_ready'
  return {
    candidate_key: projection.candidate_key,
    title: 'Portfolio: who decides when an AI agent can act?',
    triggering_event: 'Three exact public OpenAI and Meta agent releases are under source review.',
    source_type: 'portfolio_work',
    source_label: 'Official public signals + approved Portfolio implementation',
    source_ids: [...projection.packet_ids, 'portfolio:agent-operations-control-plane', 'portfolio:memory-calendar-and-evidence-plane'],
    why_vambah_can_speak: 'Portfolio has approved repository receipts for its governed agent control plane and memory/calendar path.',
    brand_goal: 'Explain the agent permission boundary through visible Portfolio product work.',
    content_angle: 'Show the source trail, human decision, and closed execution gate.',
    suggested_hook: CHANNELS.linkedin.title,
    audience: 'Builders and operators deciding where agents may act',
    sensitivity: 'public_safe', status: 'available', source_policy: 'sanitized_summaries_only',
    evidence_summary: ready ? 'Exact public source, measurement, Portfolio implementation, visual, privacy, originality, outlier, and calendar receipts passed.' : 'Candidate blocked until every source and review receipt passes.',
    claim_boundaries: ['No practitioner anecdote or outcome claim without evidence.', 'No provider, platform, schedule, or publication action from this handoff.'],
    metadata: { official_campaign_handoff: projection, review_state: ready ? 'review_ready' : 'blocked',
      channel_lanes: ready ? Object.fromEntries(projection.channel_reviews.map((review) => [review.channel, { status: 'in_review', social_content_id: review.content_id, calendar_item_id: review.calendar_item_id }])) : {},
      external_execution_enabled: false },
    generated_at: now, last_seen_at: now,
  }
}
