import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(), readRows: [] as Array<Record<string, unknown>>, inserted: [] as Array<Record<string, unknown>>,
  measure: vi.fn(), collect: vi.fn(), persistOfficial: vi.fn(),
  insertError: null as { code?: string; message?: string } | null,
}))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.verifyAdmin, isAuthError: (value: unknown) => !!value && typeof value === 'object' && 'error' in value }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: () => ({
  select: () => {
    let key = ''
    const query = { contains: (_field: string, value: Record<string, unknown>) => { key = Object.keys(value)[0]; return query },
      order: () => query, limit: async () => ({ data: mocks.readRows.filter(row => Object.hasOwn(row.actor_metadata as object, key)), error: null }) }
    return query
  },
  insert: (value: Record<string, unknown>) => ({ select: () => ({ single: async () => {
    if (mocks.insertError) return { data: null, error: mocks.insertError }
    mocks.inserted.push(value)
    return { data: { id: 'source-packet-1', status: value.status }, error: null }
  } }) }),
}) } }))
vi.mock('@/lib/social-public-signal-producer', () => ({ persistPendingPublicSignalMeasurements: mocks.measure }))
vi.mock('@/lib/social-official-live-signals', () => ({
  collectOfficialLiveSignalPackets: mocks.collect, persistPendingOfficialSignalPackets: mocks.persistOfficial,
  validOfficialSignalAttribution: () => true,
}))

import { GET, POST } from './route'

const official = { id: '11111111-1111-1111-1111-111111111111', title: 'Official release',
  source_url: 'https://developers.openai.com/api/docs/changelog', status: 'review_ready', updated_at: '2026-10-20T12:00:00Z',
  actor_metadata: { official_signal: { coverage_identity: 'openai_agents_api', source_fingerprint: 'f'.repeat(64),
    published_at: '2026-10-20T12:00:00Z', observed_at: '2026-10-20T12:00:00Z', expires_at: '2099-10-25T12:00:00Z' } } }
function request(method: string, body?: unknown) { return new NextRequest('http://localhost/api/admin/social-content/source-coverage/official-signals',
  { method, ...(body ? { body: JSON.stringify(body) } : {}) }) }

describe('official public signal operator route', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.readRows = [official]; mocks.inserted = []; mocks.insertError = null;
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true });
    mocks.measure.mockResolvedValue({ packets_scanned: 1, receipts_ready: 0, outcomes: [], review_only: true }) })

  it('requires the existing admin role before reads or writes', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Admin access required', status: 403 })
    expect((await GET(request('GET'))).status).toBe(403)
    expect((await POST(request('POST', { action: 'measure', packet_id: official.id }))).status).toBe(403)
    expect(mocks.measure).not.toHaveBeenCalled()
  })

  it('projects pending evidence without making release ready and scopes measurement to one packet', async () => {
    const read = await (await GET(request('GET'))).json()
    expect(read).toMatchObject({ review_only: true, release_ready: false, packets: [{ id: official.id,
      measurement_status: 'Unscored', blocked_reason: 'measurement_not_attempted', attempt_count: 0, owner: 'social_content_research' }] })
    const measured = await (await POST(request('POST', { action: 'measure', packet_id: official.id }))).json()
    expect(measured).toMatchObject({ packets_scanned: 1, release_ready: false })
    expect(mocks.measure).toHaveBeenCalledWith(expect.any(String), official.id)
  })

  it('rejects missing public evidence and saves one review-only observation with exact values', async () => {
    const invalid = await POST(request('POST', { action: 'intake_observation', observation: {
      coverage_identity: 'openai_agents_api', source_url: 'http://example.org',
    } }))
    expect(invalid.status).toBe(400)
    const now = new Date()
    const observation = { coverage_identity: 'openai_agents_api', source_url: 'https://example.org/agents',
      observed_at: new Date(now.getTime() - 3600000).toISOString(), expires_at: new Date(now.getTime() + 86400000).toISOString(),
      public_attention: { observed: 80, required: 100 }, relevance: { observed: 9, required: 10 },
      evidence_note: 'Exact public figures and denominator recorded from this page.' }
    const response = await POST(request('POST', { action: 'intake_observation', observation }))
    expect(response.status).toBe(200)
    expect(mocks.inserted[0]).toMatchObject({ status: 'review_ready', actor_metadata: { public_signal_observation: {
      ...observation, confidence: 'pending_human_source_review', official_packet_id: official.id,
    } } })
    const first = await response.json()
    mocks.readRows.push({ id: 'source-packet-1', status: 'review_ready', source_url: observation.source_url,
      actor_metadata: { public_signal_observation: { observation_identity: first.observation_identity } } })
    const again = await (await POST(request('POST', { action: 'intake_observation', observation }))).json()
    expect(again).toMatchObject({ unchanged: true, packet_id: 'source-packet-1' })
    expect(mocks.inserted).toHaveLength(1)
  })

  it('fails closed on partial official public collection', async () => {
    mocks.collect.mockResolvedValue({ packets: [official], blockers: ['Meta unavailable'], excluded: [] })
    const response = await POST(request('POST', { action: 'collect_official' }))
    expect(response.status).toBe(422)
    expect(mocks.persistOfficial).not.toHaveBeenCalled()
  })

  it('persists a clean official scan and refuses an oversized one', async () => {
    mocks.collect.mockResolvedValue({ packets: [{ source_url: 'https://example.org/official' }], blockers: [],
      excluded: [{ source_url: 'https://example.org/skip', reason: 'nonqualifying_topic' }] })
    mocks.persistOfficial.mockResolvedValue(1)
    const saved = await POST(request('POST', { action: 'collect_official' }))
    expect(saved.status).toBe(200)
    expect(await saved.json()).toMatchObject({ discovered: 1, inserted: 1, review_only: true, release_ready: false,
      excluded: [{ reason: 'nonqualifying_topic' }] })
    expect(mocks.persistOfficial).toHaveBeenCalledWith([{ source_url: 'https://example.org/official' }])
    mocks.collect.mockResolvedValue({ packets: Array.from({ length: 26 }, () => ({ source_url: 'https://example.org/official' })),
      blockers: [], excluded: [] })
    const limited = await POST(request('POST', { action: 'collect_official' }))
    expect(limited.status).toBe(422)
    expect(mocks.persistOfficial).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed measure requests and unmatched, stale, or conflicting observation intake', async () => {
    expect((await POST(request('POST', { action: 'measure', packet_id: 'not-a-uuid' }))).status).toBe(400)
    expect((await POST(request('POST', { action: 'publish' }))).status).toBe(400)
    expect(mocks.measure).not.toHaveBeenCalled()
    const now = new Date()
    const observation = { coverage_identity: 'openai_agents_api', source_url: 'https://example.org/agents',
      observed_at: new Date(now.getTime() - 3600000).toISOString(), expires_at: new Date(now.getTime() + 86400000).toISOString(),
      public_attention: { observed: 80, required: 100 }, relevance: { observed: 9, required: 10 },
      evidence_note: 'Exact public figures and denominator recorded from this page.' }
    const unmatched = await POST(request('POST', { action: 'intake_observation', observation: {
      ...observation, coverage_identity: 'not_the_official_packet' } }))
    expect(unmatched.status).toBe(422)
    expect(mocks.inserted).toHaveLength(0)
    mocks.readRows = [{ ...official, actor_metadata: { official_signal: {
      ...(official.actor_metadata.official_signal as object), expires_at: '2020-01-01T00:00:00.000Z' } } }]
    const stale = await POST(request('POST', { action: 'intake_observation', observation }))
    expect(stale.status).toBe(422)
    mocks.readRows = [official]
    mocks.insertError = { code: '23505', message: 'duplicate key value' }
    const conflict = await POST(request('POST', { action: 'intake_observation', observation }))
    expect(conflict.status).toBe(409)
    expect(await conflict.json()).toEqual({ error: 'Concurrent observation intake. Refresh the evidence list.' })
    mocks.insertError = { code: '42501', message: 'permission denied for table social_content_research_packets' }
    const failed = await POST(request('POST', { action: 'intake_observation', observation }))
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'observation_intake_write_failed' })
  })

  it('stops the operator read when the bounded packet window is full', async () => {
    mocks.readRows = Array.from({ length: 100 }, (_, index) => ({ ...official, id: `packet-${index}` }))
    const response = await GET(request('GET'))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'official_signal_result_limit_reached' })
  })
})
