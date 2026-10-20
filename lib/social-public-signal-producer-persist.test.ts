import { describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>>, writes: 0 }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: () => ({
  select: () => {
    let status = ''
    let key = ''
    const query = {
      eq: (_field: string, value: string) => { status = value; return query },
      contains: (_field: string, filter: Record<string, unknown>) => { key = Object.keys(filter)[0]; return query },
      limit: async () => ({ data: db.rows.filter((row) => row.status === status
        && Object.hasOwn(row.actor_metadata as object, key)), error: null }),
    }
    return query
  },
  update: (value: Record<string, unknown>) => {
    const filters: Record<string, unknown> = {}
    const query = {
      eq: (field: string, expected: unknown) => { filters[field] = expected; return query },
      select: async () => {
        const row = db.rows.find((item) => Object.entries(filters).every(([key, expected]) => item[key] === expected))
        if (row) { row.actor_metadata = value.actor_metadata; db.writes += 1 }
        return { data: row ? [{ id: row.id }] : [], error: null }
      },
    }
    return query
  },
}) } }))

import { persistPendingPublicSignalMeasurements } from './social-public-signal-producer'
import { officialSignalPacketFromPage, OFFICIAL_LIVE_SIGNAL_INDEXES, type OfficialSignalDiscovery } from './social-official-live-signals'
import { stableTopicIdentity } from './social-trend-work-join'

const now = '2026-10-20T12:00:00.000Z'
const url = OFFICIAL_LIVE_SIGNAL_INDEXES[0].url
const discovery: OfficialSignalDiscovery = {
  source_url: url, index_url: url, publisher: 'OpenAI', kind: 'agents_api',
  title: 'Agents API update: subagents', published_at: '2026-10-19T00:00:00.000Z',
  coverage_identity: stableTopicIdentity('openai_agents_api_2026-10-19_subagents'),
  topic_identities: ['agentic_operating_systems'], entity_identities: ['openai', 'agents_api'],
  capability_labels: ['subagents'], proof_terms: ['v1/agents', 'subagents'],
}
const html = `<html><div class="mb-12"><h3>October, 2026</h3><div class="mt-5"><div class="grid">Oct 19 Feature v1/agents subagents</div></div></div>${'detail '.repeat(20)}</html>`

describe('pending public signal persistence', () => {
  it('writes preparation only once and leaves approval and pending scores unchanged', async () => {
    db.writes = 0
    db.rows = [{ id: 'official-1', updated_at: now, ...officialSignalPacketFromPage({ discovery, html, observedAt: now }) },
      ...[url, 'https://example.org/agents', 'https://example.net/agents'].map((source_url, index) => ({
        id: `source-${index}`, source_url, title: 'Public observation', status: 'approved', updated_at: now,
        actor_metadata: { public_signal_observation: {
          version: 'public_signal_observation_v1', coverage_identity: discovery.coverage_identity,
          source_url, observed_at: now, expires_at: '2026-10-25T12:00:00.000Z',
          public_attention: { observed: 80, required: 100 }, relevance: { observed: 9, required: 10 },
        } },
      }))]
    const first = await persistPendingPublicSignalMeasurements(now)
    expect(first).toMatchObject({ packets_scanned: 1, receipts_ready: 1, review_only: true })
    expect(db.writes).toBe(1)
    const official = db.rows[0]
    expect(official.status).toBe('review_ready')
    expect((official.actor_metadata as Record<string, unknown>).topic_momentum_receipt).toMatchObject({
      approval_status: 'pending', public_attention_score: null, relevance_score: null,
    })
    expect(await persistPendingPublicSignalMeasurements(now)).toMatchObject({ packets_scanned: 1, receipts_ready: 1 })
    expect(db.writes).toBe(1)
  })
})
