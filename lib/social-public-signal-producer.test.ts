import { describe, expect, it } from 'vitest'
import { officialSignalPacketFromPage, OFFICIAL_LIVE_SIGNAL_INDEXES, type OfficialSignalDiscovery } from './social-official-live-signals'
import { preparePublicSignalMeasurement } from './social-public-signal-producer'
import { validatePublicSignalMeasurement } from './social-public-signal-measurement'
import { stableTopicIdentity } from './social-trend-work-join'
import { publicObservationIdentity } from './social-public-signal-observation'

const now = '2026-10-20T12:00:00.000Z'
const sourceUrl = OFFICIAL_LIVE_SIGNAL_INDEXES[0].url
const discovery: OfficialSignalDiscovery = {
  source_url: sourceUrl, index_url: sourceUrl, publisher: 'OpenAI', kind: 'agents_api',
  title: 'Agents API update: subagents', published_at: '2026-10-19T00:00:00.000Z',
  coverage_identity: stableTopicIdentity('openai_agents_api_2026-10-19_subagents'),
  topic_identities: ['agentic_operating_systems'], entity_identities: ['openai', 'agents_api'],
  capability_labels: ['subagents'], proof_terms: ['v1/agents', 'subagents'],
}
const html = `<html><div class="mb-12"><h3>October, 2026</h3><div class="mt-5"><div class="grid">Oct 19 Feature v1/agents subagents</div></div></div>${'detail '.repeat(20)}</html>`
const packet = { id: 'official-1', updated_at: now,
  ...officialSignalPacketFromPage({ discovery, html, observedAt: now }) }
const evidence = [sourceUrl, 'https://example.org/observed/agents', 'https://example.net/observed/agents']
  .map((source_url, index) => {
    const observation = { version: 'public_signal_observation_v1', coverage_identity: discovery.coverage_identity,
      source_url, observed_at: now, expires_at: '2026-10-25T12:00:00.000Z',
      public_attention: { observed: 80, required: 100 }, relevance: { observed: 9, required: 10 },
      evidence_note: 'Exact numerator and denominator shown on the linked public source.' }
    return { id: `source-${index}`, source_url, title: 'Public measurement', status: 'approved', actor_metadata: {
      public_signal_observation: { ...observation, observation_identity: publicObservationIdentity(observation), official_packet_id: packet.id },
      operator_review: { decision: 'approved', reviewed_at: now },
    } }
  })

function observationRow(source_url: string, index: number) {
  const observation = {
    version: 'public_signal_observation_v1', coverage_identity: discovery.coverage_identity,
    source_url, observed_at: now, expires_at: '2026-10-25T12:00:00.000Z',
    public_attention: { observed: 80, required: 100 }, relevance: { observed: 9, required: 10 },
    evidence_note: 'Exact numerator and denominator shown on the linked public source.',
  }
  return {
    id: `source-${index}`, source_url, title: 'Public measurement', status: 'approved', actor_metadata: {
      public_signal_observation: {
        ...observation, observation_identity: publicObservationIdentity(observation), official_packet_id: packet.id,
      },
      operator_review: { decision: 'approved', reviewed_at: now },
    },
  }
}

function retarget(
  row: (typeof evidence)[number],
  observationPatch: Record<string, unknown>,
  storedPatch: Record<string, unknown> = {},
) {
  const current = row.actor_metadata.public_signal_observation
  const { observation_identity: _identity, official_packet_id: _packet, ...core } = current
  const observation = { ...core, ...observationPatch }
  return {
    ...row,
    actor_metadata: {
      ...row.actor_metadata,
      public_signal_observation: {
        ...observation,
        observation_identity: publicObservationIdentity(observation),
        official_packet_id: packet.id,
        ...storedPatch,
      },
    },
  }
}

describe('public signal measurement producer', () => {
  it('emits a deterministic source-bound receipt with exact observed and required values', () => {
    const first = preparePublicSignalMeasurement({ packet, evidence, now })
    const second = preparePublicSignalMeasurement({ packet, evidence: [...evidence].reverse(), now })
    expect(first.receipt).toEqual(second.receipt)
    expect(first.receipt).toMatchObject({ sample_size: 3, public_attention_score: 0.8,
      relevance_score: 0.9, public_attention_threshold: 0.65, relevance_threshold: 0.65 })
    expect(first.receipt?.source_receipts[0]).toMatchObject({ observed_values: { public_attention: 80, relevance: 9 },
      required_values: { public_attention: 100, relevance: 10 } })
    expect(validatePublicSignalMeasurement({ stored: first.receipt, submitted: first.receipt,
      coverageIdentity: discovery.coverage_identity, officialSourceUrl: sourceUrl, now }).valid).toBe(true)
    const withReceipt = { ...packet, actor_metadata: { ...packet.actor_metadata, public_signal_measurement_receipt: first.receipt } }
    expect(preparePublicSignalMeasurement({ packet: withReceipt, evidence, now })).toMatchObject({ changed: false, receipt: first.receipt })
  })

  it('holds insufficient, stale, excluded, mismatched and low score evidence Unscored', () => {
    const insufficient = preparePublicSignalMeasurement({ packet, evidence: evidence.slice(0, 2), now })
    expect(insufficient).toMatchObject({ receipt: null, state: { status: 'Unscored', owner: 'social_content_research',
      observed_value: 2, required_value: 3, attempt_count: 1, max_attempts: 3 } })
    expect(preparePublicSignalMeasurement({ packet: { ...packet, actor_metadata: { ...packet.actor_metadata,
      public_signal_measurement_state: insufficient.state } }, evidence: evidence.slice(0, 2), now }).changed).toBe(false)
    const stale = { ...evidence[0], actor_metadata: { public_signal_observation: {
      ...evidence[0].actor_metadata.public_signal_observation, observed_at: '2026-10-01T00:00:00.000Z' } } }
    expect(preparePublicSignalMeasurement({ packet, evidence: [stale, ...evidence.slice(1)], now }).receipt).toBeNull()
    const excluded = { ...evidence[1], actor_metadata: { public_signal_observation: {
      ...evidence[1].actor_metadata.public_signal_observation, excluded: true } } }
    expect(preparePublicSignalMeasurement({ packet, evidence: [evidence[0], excluded, evidence[2]], now }).receipt).toBeNull()
    const mismatched = { ...evidence[1], actor_metadata: { public_signal_observation: {
      ...evidence[1].actor_metadata.public_signal_observation, source_url: 'https://different.example.org/' } } }
    expect(preparePublicSignalMeasurement({ packet, evidence: [evidence[0], mismatched, evidence[2]], now }).receipt).toBeNull()
    const low = evidence.map((row) => {
      const observation = { ...row.actor_metadata.public_signal_observation, public_attention: { observed: 40, required: 100 } }
      return { ...row, actor_metadata: { ...row.actor_metadata, public_signal_observation: {
        ...observation, observation_identity: publicObservationIdentity(observation) } } }
    })
    expect(preparePublicSignalMeasurement({ packet, evidence: low, now })).toMatchObject({ receipt: null,
      state: { reason: 'measured_score_below_threshold', observed_value: 0.4, required_value: 0.65 } })
    expect(preparePublicSignalMeasurement({ packet, evidence: evidence.map((row) => ({ ...row,
      actor_metadata: { ...row.actor_metadata, public_signal_observation: {
        ...row.actor_metadata.public_signal_observation, relevance: { observed: 1, required: 10 },
      } } })), now }).receipt).toBeNull()
  })

  it('keeps single-host, missing-official, stale, and mis-bound evidence unscored', () => {
    const sameHost = [
      sourceUrl,
      'https://developers.openai.com/blog/agents-a',
      'https://developers.openai.com/blog/agents-b',
    ].map((source_url, index) => observationRow(source_url, index))
    expect(preparePublicSignalMeasurement({ packet, evidence: sameHost, now })).toMatchObject({
      receipt: null,
      state: { reason: 'insufficient_attributable_public_sources', observed_value: 3, required_value: 3 },
    })
    const externalOnly = [
      'https://example.org/observed/a',
      'https://example.net/observed/b',
      'https://example.com/observed/c',
    ].map((source_url, index) => observationRow(source_url, index))
    expect(preparePublicSignalMeasurement({ packet, evidence: externalOnly, now })).toMatchObject({
      receipt: null,
      state: { reason: 'insufficient_attributable_public_sources', observed_value: 3, required_value: 3 },
    })
    const boosted = evidence.map((row, index) => index === 0
      ? retarget(row, { public_attention: { observed: 200, required: 100 } })
      : row)
    const clamped = preparePublicSignalMeasurement({ packet, evidence: boosted, now })
    expect(clamped.receipt?.public_attention_score).toBe(0.8667)
    expect(clamped.receipt?.source_receipts[0]).toMatchObject({ public_attention_score: 1, observed_values: { public_attention: 200 } })
    expect(preparePublicSignalMeasurement({ packet, evidence, now }).receipt?.fresh_until).toBe('2026-10-25T12:00:00.000Z')
    const sooner = evidence.map((row, index) => index === 2
      ? retarget(row, { expires_at: '2026-10-22T12:00:00.000Z' })
      : row)
    expect(preparePublicSignalMeasurement({ packet, evidence: sooner, now }).receipt?.fresh_until).toBe('2026-10-22T12:00:00.000Z')
    expect(preparePublicSignalMeasurement({ packet: { ...packet, status: 'approved' }, evidence, now })).toMatchObject({
      receipt: null, state: { reason: 'official_packet_stale_or_not_pending', status: 'Unscored' },
    })
    const expired = structuredClone(packet)
    ;(expired.actor_metadata.official_signal as { expires_at: string }).expires_at = '2026-10-01T00:00:00.000Z'
    expect(preparePublicSignalMeasurement({ packet: expired, evidence, now })).toMatchObject({
      receipt: null, state: { reason: 'official_packet_stale_or_not_pending' },
    })
    const misidentified = evidence.map((row, index) => index === 1 ? retarget(row, {}, { observation_identity: `public-observation:${'a'.repeat(64)}` }) : row)
    expect(preparePublicSignalMeasurement({ packet, evidence: misidentified, now })).toMatchObject({
      receipt: null, state: { reason: 'insufficient_or_excluded_attributable_public_sources', observed_value: 2 },
    })
    const wrongPacket = evidence.map((row, index) => index === 1 ? retarget(row, {}, { official_packet_id: 'other-packet' }) : row)
    expect(preparePublicSignalMeasurement({ packet, evidence: wrongPacket, now })).toMatchObject({
      receipt: null, state: { reason: 'insufficient_or_excluded_attributable_public_sources', observed_value: 2 },
    })
  })

  it('respects the bounded retry and immutable-receipt gates', () => {
    const state = preparePublicSignalMeasurement({ packet, evidence: [], now }).state!
    const exhausted = preparePublicSignalMeasurement({ packet: { ...packet, actor_metadata: { ...packet.actor_metadata,
      public_signal_measurement_state: { ...state, attempt_count: 3 } } }, evidence, now })
    expect(exhausted).toMatchObject({ receipt: null, changed: false, state: { reason: 'retry_limit_reached_owner_review_required' } })
    const altered = { ...packet, actor_metadata: { ...packet.actor_metadata, public_signal_measurement_receipt: { receipt_id: 'forged' } } }
    expect(preparePublicSignalMeasurement({ packet: altered, evidence, now })).toMatchObject({ receipt: null,
      state: { reason: 'existing_measurement_immutable_review_required' } })
  })
})
