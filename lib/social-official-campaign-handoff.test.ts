import { createHash } from 'crypto'
import { describe, expect, it } from 'vitest'
import { buildApprovedSourceProjection } from './social-topic-source-receipts'
import { publicSignalMeasurementReceiptId } from './social-public-signal-measurement'
import { OFFICIAL_CAMPAIGN_CANDIDATE_KEY, OFFICIAL_CAMPAIGN_PACKET_IDS,
  officialCampaignBacklogRow, projectOfficialCampaignHandoff } from './social-official-campaign-handoff'

const now = '2026-10-21T16:00:00.000Z'
const cases = [
  { id: OFFICIAL_CAMPAIGN_PACKET_IDS[0], url: 'https://developers.openai.com/api/docs/changelog', index: 'https://developers.openai.com/api/docs/changelog',
    kind: 'agents_api', publisher: 'OpenAI', title: 'Agents API update: Artifact SDK and Ultrafast mode', published: '2026-10-16T00:00:00.000Z',
    coverage: 'openai_agents_api_2026_10_16_artifact_sdk_ultrafast_mode', topics: ['agentic_operating_systems'], entities: ['openai', 'agents_api'] },
  { id: OFFICIAL_CAMPAIGN_PACKET_IDS[1], url: 'https://engineering.fb.com/2026/10/15/ml-applications/how-meta-built-forum-ai-native-engineering/', index: 'https://engineering.fb.com/feed/',
    kind: 'forum_agentic_engineering', publisher: 'Meta', title: 'How Meta Built Forum With AI-Native Engineering', published: '2026-10-15T19:00:03.000Z',
    coverage: 'meta_forum_agentic_engineering_2026_10_15_how_meta_built_forum_ai_native_engineering', topics: ['agentic_operating_systems', 'multi_agent_orchestration'], entities: ['meta', 'forum'] },
  { id: OFFICIAL_CAMPAIGN_PACKET_IDS[2], url: 'https://about.fb.com/news/2026/10/introducing-muse-wonder-models/', index: 'https://about.fb.com/feed/',
    kind: 'muse_agent', publisher: 'Meta', title: 'Introducing Muse Wonder and Muse Wonder Full: Frontier Models for Agents', published: '2026-10-12T17:08:05.000Z',
    coverage: 'meta_muse_agent_2026_10_12_introducing_muse_wonder_models', topics: ['agentic_operating_systems', 'agent_memory'], entities: ['meta', 'muse'] },
] as const
const sha = (value: string) => createHash('sha256').update(value).digest('hex')
function packet(source: typeof cases[number], approved = true) {
  const sourceReceipts = [source.url, `https://example.org/agent-attention/${source.id}`, `https://example.net/agent-attention/${source.id}`]
    .map((source_url, index) => ({ receipt_id: `public-source:campaign-${source.id}-${index}`, source_url,
      observed_at: now, public_attention_score: 0.8, relevance_score: 0.9 }))
  const contents = { version: 'public_signal_measurement_v1' as const, coverage_identity: source.coverage,
    observed_at: now, fresh_until: '2026-10-25T12:00:00.000Z', sample_size: 3,
    formula: 'mean_normalized_public_observations_v1' as const, public_attention_score: 0.8,
    public_attention_threshold: 0.65 as const, relevance_score: 0.9, relevance_threshold: 0.65 as const,
    source_receipts: sourceReceipts }
  const measurement = { ...contents, receipt_id: publicSignalMeasurementReceiptId(contents) }
  return { id: source.id, title: source.title, source_url: source.url, status: approved ? 'approved' : 'review_ready', updated_at: now,
    actor_metadata: { official_signal: { kind: source.kind, publisher: source.publisher, index_url: source.index,
      source_url: source.url, published_at: source.published, observed_at: now, expires_at: '2026-11-10T00:00:00.000Z',
      coverage_identity: source.coverage, topic_identities: [...source.topics], entity_identities: [...source.entities],
      source_fingerprint: sha(`${source.url}|${source.coverage}|${source.title}`), evidence_status: approved ? 'approved' : 'pending_review', raw_content_included: false },
    topic_momentum_receipt: { coverage_identity: source.coverage, topic_identities: [...source.topics], entity_identities: [...source.entities],
      product_identity: 'portfolio', approval_status: approved ? 'approved' : 'pending', privacy_classification: 'public_safe', raw_content_included: false,
      measurement_receipt_id: approved ? measurement.receipt_id : undefined },
    ...(approved ? { public_signal_measurement_receipt: measurement } : {}),
  } }
}
const products = ['portfolio:agent-operations-control-plane', 'portfolio:memory-calendar-and-evidence-plane'].map((sourceId) =>
  buildApprovedSourceProjection({ sourceGroup: 'repository_documents', sourceKind: 'approved_repository_implementation',
    sourceId, productIdentity: 'portfolio', lifecycleStage: 'production_deployed', label: 'Portfolio',
    approvedSummary: 'Portfolio records agent evidence, permission boundaries, and human decisions.',
    privacyClassification: 'public_safe', provenance: `portfolio_repository:${sourceId}`, approvedAt: now, approvedBy: 'reviewer',
    metadata: { topic_identities: ['agentic_operating_systems'] } }))
const visual = buildApprovedSourceProjection({ sourceGroup: 'owned_media_summaries', sourceKind: 'owned_media_summary', sourceId: 'qa:portfolio-visual',
  productIdentity: 'portfolio', lifecycleStage: 'production_deployed', label: 'Portfolio route proof', approvedSummary: 'Redacted agent decision screen.',
  privacyClassification: 'public_safe', provenance: 'qa:owned-capture', approvedAt: now, approvedBy: 'reviewer',
  metadata: { official_campaign_gate: 'product_visual', asset_sha256: `sha256:${'a'.repeat(64)}`, asset_path: '/review-assets/portfolio-agent-decision.png',
    route_path: '/admin/agents/coordination', privacy_review_status: 'approved', rights_status: 'owned', captured_at: now,
    claim_bindings: ['portfolio_governed_agent_operations'] } })
function outlier(channel: 'linkedin' | 'youtube') { return buildApprovedSourceProjection({ sourceGroup: 'public_momentum', sourceKind: 'social_trend', sourceId: `qa:portfolio-outlier:${channel}`,
  productIdentity: 'portfolio', lifecycleStage: 'insight', label: `${channel} agent systems comparables`, approvedSummary: 'Five exact public comparables.',
  privacyClassification: 'public_safe', provenance: `qa:outlier:${channel}`, approvedAt: now, approvedBy: 'reviewer',
  metadata: { official_campaign_gate: `outlier_${channel}`, status: 'passed', route: 'social-content-outlier-decision/v1', channel, minimum_sample_size: 5,
    source_urls: [1, 2, 3, 4, 5].map((n) => channel === 'youtube' ? `https://www.youtube.com/watch?v=fixture${n}` : `https://www.linkedin.com/posts/fixture-${n}`),
    normalized_scores: [80, 77, 74, 72, 70], outlier_threshold: 75, observed_at: now, fresh_until: '2026-10-25T12:00:00.000Z', curated_playlist_performance_weight: 0,
    topic_identities: ['agentic_operating_systems'] } }) }
const calendar = (['linkedin', 'youtube'] as const).map((channel) => ({ id: `${channel}-slot`, channel,
  campaign_id: 'campaign-1', scheduled_for: '2026-11-01T12:00:00.000Z', authorization_status: 'pending', social_content_id: null,
  updated_at: now, metadata: { official_campaign_candidate_key: OFFICIAL_CAMPAIGN_CANDIDATE_KEY } }))
function input() { return { packets: cases.map((source) => packet(source)), productReceipts: products, gateReceipts: [visual, outlier('linkedin'), outlier('youtube')], calendar, now } }
function decisionReceipt(role: 'privacy' | 'originality', version: string) {
  return buildApprovedSourceProjection({ sourceGroup: 'owned_media_summaries', sourceKind: 'owned_media_summary', sourceId: `qa:${role}`,
    productIdentity: 'portfolio', lifecycleStage: 'insight', label: role, approvedSummary: `${role} review for the exact evidence version.`,
    privacyClassification: 'public_safe', provenance: `qa:${role}`, approvedAt: now, approvedBy: 'reviewer',
    metadata: { official_campaign_gate: role, status: 'passed', input_version: version } })
}

describe('three-source Portfolio campaign handoff', () => {
  it('keeps current review-ready packets blocked and produces one stable backlog identity', () => {
    const state = input()
    state.packets = cases.map((source) => packet(source, false))
    const first = projectOfficialCampaignHandoff(state)
    const second = projectOfficialCampaignHandoff(state)
    expect(first).toEqual(second)
    expect(first.status).toBe('blocked')
    expect(first.channel_reviews).toEqual([])
    expect(first.blockers.filter((entry) => entry.code === 'official_review_pending')).toHaveLength(3)
    expect(first.blockers.filter((entry) => entry.code === 'source_measurement_unscored')).toHaveLength(3)
    expect(first.source_lineage.map((entry) => entry.packet_id)).toEqual([...OFFICIAL_CAMPAIGN_PACKET_IDS])
    expect(officialCampaignBacklogRow(first, now)).toMatchObject({ candidate_key: OFFICIAL_CAMPAIGN_CANDIDATE_KEY, source_type: 'portfolio_work', metadata: { review_state: 'blocked', external_execution_enabled: false } })
  })

  it('creates only two channel-native internal review identities after every exact gate passes', () => {
    const state = input()
    const version = projectOfficialCampaignHandoff(state).input_version
    state.gateReceipts.push(decisionReceipt('privacy', version), decisionReceipt('originality', version))
    const result = projectOfficialCampaignHandoff(state)
    expect(result.status).toBe('review_ready')
    expect(result.blockers).toEqual([])
    expect(result.channel_reviews.map((item) => item.channel)).toEqual(['linkedin', 'youtube'])
    expect(result.channel_reviews[1].thumbnail_teaser).not.toBe(result.channel_reviews[1].title)
    expect(result.channel_reviews.map((item) => item.calendar_item_id)).toEqual(['linkedin-slot', 'youtube-slot'])
    expect(result.gate_receipts.map((item) => item.role)).toEqual(['product_visual', 'outlier_linkedin', 'outlier_youtube', 'privacy', 'originality'])
    expect(result.gate_receipts[0]).toMatchObject({ asset_path: '/review-assets/portfolio-agent-decision.png', route_path: '/admin/agents/coordination' })
    expect(result.side_effects).toEqual(expect.objectContaining({ approval: false, provider_call: false, platform_draft: false, external_schedule: false, publish: false }))
    expect(projectOfficialCampaignHandoff(state).channel_reviews).toEqual(result.channel_reviews)
  })

  it('blocks tampering, stale evidence, wrong product proof, weak outlier, and stale review receipts', () => {
    const base = input()
    const version = projectOfficialCampaignHandoff(base).input_version
    base.gateReceipts.push(decisionReceipt('privacy', version), decisionReceipt('originality', version))
    const bad: Parameters<typeof projectOfficialCampaignHandoff>[0] = { ...base, packets: [...base.packets], productReceipts: [...base.productReceipts], gateReceipts: [...base.gateReceipts], calendar: [...base.calendar] }
    bad.packets[0] = { ...bad.packets[0], title: 'Tampered headline' }
    bad.productReceipts[0] = { ...bad.productReceipts[0], product_identity: 'agentified' }
    bad.gateReceipts[1] = { ...outlier('linkedin'), metadata: { ...outlier('linkedin').metadata, normalized_scores: [60, 61, 62, 63, 64] } }
    bad.calendar[1] = { ...bad.calendar[1], scheduled_for: '2026-10-20T12:00:00.000Z' }
    const result = projectOfficialCampaignHandoff(bad)
    expect(result.status).toBe('blocked')
    expect(result.channel_reviews).toEqual([])
    expect(result.blockers.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      'official_attribution_invalid', 'portfolio_product_proof_missing', 'outlier_linkedin_missing', 'calendar_slot_missing', 'privacy_receipt_missing', 'originality_receipt_missing',
    ]))
  })
})
