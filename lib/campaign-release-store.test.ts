import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))
let adminClient: { from: typeof mocks.from } | null = null
vi.mock('@/lib/supabase', () => ({
  get supabaseAdmin() {
    return adminClient
  },
}))

import { CAMPAIGN_RELEASE_KIND, createCampaignRelease, decideStoredCampaignRelease, getCampaignRelease } from './campaign-release-store'
import { campaignSourceFingerprint, parseCampaignManifest, releaseHash, type CampaignReleaseManifest, type ReleaseRecord } from './campaign-release-manifest'
import { fixture } from './campaign-release-test-fixture'

const NOW = new Date('2026-10-03T18:00:00.000Z')
const LEAK = 'postgres-detail-must-not-leak'
const ACTOR = 'portfolio:admin-1'

type Terminal = { data: unknown; error: { code?: string; message?: string } | null }

let source: { id: string; post_text: string }
let manifest: CampaignReleaseManifest
let record: ReleaseRecord
const runs: Terminal[] = []
const inserts: unknown[] = []
const updates: unknown[] = []
const readEqs: Array<[string, unknown]> = []
const decisionEqs: Array<[string, unknown]> = []

function stored(next: ReleaseRecord = record): Terminal {
  return { data: { id: next.manifest.releaseId, metadata: next }, error: null }
}

describe('campaign release persistence gates', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    manifest = fixture()
    source = { id: manifest.actions[0].source.id, post_text: 'Exact copy' }
    manifest.actions[0].source.fingerprint = campaignSourceFingerprint(source)
    const parsed = parseCampaignManifest(manifest)
    record = { manifest: parsed, hash: releaseHash(parsed), state: 'pending', version: 1, audit: [] }
    runs.length = 0
    inserts.length = 0
    updates.length = 0
    readEqs.length = 0
    decisionEqs.length = 0
    mocks.from.mockClear()
    adminClient = { from: mocks.from }
    mocks.from.mockImplementation((table: string) => {
      const terminal = table === 'agent_runs' ? runs.shift() : { data: source, error: null }
      if (!terminal) throw new Error(`Unexpected ${table} query`)
      let writing = false
      const api = {
        select: vi.fn(() => api),
        eq: vi.fn((column: string, value: unknown) => {
          const target = writing ? decisionEqs : readEqs
          target.push([column, value])
          return api
        }),
        insert: vi.fn((payload: unknown) => {
          inserts.push(payload)
          return Promise.resolve(terminal)
        }),
        update: vi.fn((payload: unknown) => {
          writing = true
          updates.push(payload)
          return api
        }),
        single: vi.fn(async () => terminal),
        maybeSingle: vi.fn(async () => terminal),
      }
      return api
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fails closed when the release database is unavailable', async () => {
    adminClient = null
    await expect(getCampaignRelease(record.manifest.releaseId)).rejects.toThrow('Release database unavailable.')
    await expect(createCampaignRelease(manifest, ACTOR)).rejects.toThrow('Release database unavailable.')
    await expect(decideStoredCampaignRelease(record.manifest.releaseId, record.hash, 'stop', ACTOR)).rejects.toThrow('Release database unavailable.')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an authorization-window boundary before reading sources', async () => {
    vi.setSystemTime(new Date(manifest.expiresAt))
    await expect(createCampaignRelease(manifest, ACTOR)).rejects.toThrow('outside its authorization window')
    vi.setSystemTime(new Date(Date.parse(manifest.createdAt) - 1))
    await expect(createCampaignRelease(manifest, ACTOR)).rejects.toThrow('outside its authorization window')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('saves a pending release with provider execution disabled', async () => {
    runs.push({ data: null, error: null })
    const saved = await createCampaignRelease(manifest, ACTOR)
    expect(saved).toEqual(record)
    expect(mocks.from).toHaveBeenCalledWith('social_content_queue')
    expect(inserts).toEqual([{
      id: record.manifest.releaseId,
      kind: CAMPAIGN_RELEASE_KIND,
      runtime: 'manual',
      title: 'Campaign release review',
      status: 'waiting_for_approval',
      subject_type: 'campaign',
      subject_id: record.manifest.campaignId,
      trigger_source: 'portfolio',
      current_step: 'Review exact manifest; provider execution unavailable',
      idempotency_key: `campaign-release:${record.manifest.releaseId}`,
      metadata: record,
      outcome: { createdBy: ACTOR, providerExecutionEnabled: false },
    }])
  })

  it('does not save when a canonical source changed', async () => {
    source.post_text = 'Changed copy'
    await expect(createCampaignRelease(manifest, ACTOR)).rejects.toThrow('Source changed')
    expect(inserts).toHaveLength(0)
  })

  it('returns the same content when a release id is replayed and rejects a different manifest', async () => {
    runs.push({ data: null, error: { code: '23505', message: LEAK } }, stored())
    await expect(createCampaignRelease(manifest, ACTOR)).resolves.toEqual(record)

    const other = fixture()
    other.actions[0].source.fingerprint = manifest.actions[0].source.fingerprint
    other.objective = 'Different reviewed objective'
    const parsed = parseCampaignManifest(other)
    const conflicting: ReleaseRecord = { manifest: parsed, hash: releaseHash(parsed), state: 'pending', version: 1, audit: [] }
    runs.push({ data: null, error: { code: '23505', message: LEAK } }, stored(conflicting))
    await expect(createCampaignRelease(manifest, ACTOR)).rejects.toThrow('Release ID already belongs to different content')
    expect(inserts).toHaveLength(2)
  })

  it('hides database details when a release cannot be read or saved', async () => {
    runs.push({ data: null, error: { message: LEAK } })
    await expect(getCampaignRelease(record.manifest.releaseId)).rejects.toThrow(/^Release unavailable\.$/)
    expect(readEqs).toEqual([['kind', CAMPAIGN_RELEASE_KIND], ['id', record.manifest.releaseId]])

    runs.push({ data: { id: record.manifest.releaseId, metadata: { ...record, hash: 'b'.repeat(64) } }, error: null })
    await expect(getCampaignRelease(record.manifest.releaseId)).rejects.toThrow(/^Release integrity check failed\.$/)

    runs.push({ data: null, error: { code: 'XX000', message: LEAK } })
    await expect(createCampaignRelease(manifest, ACTOR)).rejects.toThrow(/^Release save unconfirmed\.$/)
    expect(runs).toHaveLength(0)
  })

  it('stops without rereading sources and keeps provider execution unavailable', async () => {
    runs.push(stored(), { data: { id: record.manifest.releaseId }, error: null })
    const stopped = await decideStoredCampaignRelease(record.manifest.releaseId, record.hash, 'stop', ACTOR)
    expect(stopped.state).toBe('stopped')
    expect(stopped.version).toBe(2)
    expect(stopped.audit).toEqual([{ decision: 'stop', actor: ACTOR, at: NOW.toISOString(), hash: record.hash }])
    expect(mocks.from.mock.calls.map(call => call[0])).toEqual(['agent_runs', 'agent_runs'])
    expect(updates[0]).toMatchObject({
      status: 'cancelled',
      current_step: 'stopped; provider execution unavailable',
      metadata: stopped,
    })
    expect(decisionEqs).toEqual([
      ['id', record.manifest.releaseId],
      ['kind', CAMPAIGN_RELEASE_KIND],
      ['metadata->>hash', record.hash],
      ['metadata->>version', '1'],
    ])
  })

  it('does not write an already applied stop or an unauthenticated decision', async () => {
    const applied: ReleaseRecord = { ...record, state: 'stopped', version: 2, audit: [{ decision: 'stop', actor: ACTOR, at: NOW.toISOString(), hash: record.hash }] }
    runs.push(stored(applied))
    await expect(decideStoredCampaignRelease(record.manifest.releaseId, record.hash, 'stop', ACTOR)).resolves.toEqual(applied)
    runs.push(stored())
    await expect(decideStoredCampaignRelease(record.manifest.releaseId, record.hash, 'stop', '   ')).rejects.toThrow('authenticated actor')
    expect(updates).toHaveLength(0)
  })

  it('rechecks sources before approval and does not resume a stopped release', async () => {
    runs.push(stored(), { data: { id: record.manifest.releaseId }, error: null })
    const approved = await decideStoredCampaignRelease(record.manifest.releaseId, record.hash, 'approve', ACTOR)
    expect(approved.state).toBe('approved')
    expect(mocks.from).toHaveBeenCalledWith('social_content_queue')
    expect(updates[0]).toMatchObject({ status: 'waiting_for_approval', current_step: 'approved; provider execution unavailable' })

    updates.length = 0
    const applied: ReleaseRecord = { ...record, state: 'stopped', version: 2, audit: [{ decision: 'stop', actor: ACTOR, at: NOW.toISOString(), hash: record.hash }] }
    runs.push(stored(applied))
    await expect(decideStoredCampaignRelease(record.manifest.releaseId, record.hash, 'approve', ACTOR)).rejects.toThrow('Stopped releases cannot resume')
    expect(updates).toHaveLength(0)

    source.post_text = 'Changed copy'
    runs.push(stored())
    await expect(decideStoredCampaignRelease(record.manifest.releaseId, record.hash, 'approve', ACTOR)).rejects.toThrow('Source changed')
    expect(updates).toHaveLength(0)
  })

  it('retries a lost compare-and-swap and refuses an unconfirmed write', async () => {
    runs.push(stored(), { data: null, error: null }, stored(), { data: { id: record.manifest.releaseId }, error: null })
    await expect(decideStoredCampaignRelease(record.manifest.releaseId, record.hash, 'hold', ACTOR)).resolves.toMatchObject({ state: 'held', version: 2 })
    expect(updates).toHaveLength(2)

    updates.length = 0
    runs.push(stored(), { data: null, error: { message: LEAK } })
    await expect(decideStoredCampaignRelease(record.manifest.releaseId, record.hash, 'hold', ACTOR)).rejects.toThrow(/^Release decision unconfirmed\. Reload before retrying\.$/)
    expect(updates).toHaveLength(1)

    updates.length = 0
    runs.push(stored(), { data: null, error: null }, stored(), { data: null, error: null }, stored(), { data: null, error: null })
    await expect(decideStoredCampaignRelease(record.manifest.releaseId, record.hash, 'hold', ACTOR)).rejects.toThrow('Release changed concurrently. Reload the current decision.')
    expect(updates).toHaveLength(3)
  })
})
