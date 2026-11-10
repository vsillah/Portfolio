import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  OFFICIAL_CAMPAIGN_CANDIDATE_KEY,
  OFFICIAL_CAMPAIGN_HANDOFF_VERSION,
  OFFICIAL_CAMPAIGN_PACKET_IDS,
  type OfficialCampaignProjection,
} from './social-official-campaign-handoff'

const NOW = '2026-10-21T16:00:00.000Z'
const CLOSED = { approval: false, provider_call: false, render: false, upload: false, platform_draft: false, external_schedule: false, publish: false, external_send: false } as const

type DbResult = { data: unknown; error: { message: string; code?: string } | null }
type QueryFilters = Record<string, unknown>

const db = vi.hoisted(() => {
  const state = {
    packet: { data: [] as unknown, error: null } as DbResult,
    product: { data: [] as unknown, error: null } as DbResult,
    calendar: { data: [] as unknown, error: null } as DbResult,
    backlog: { data: null as unknown, error: null } as DbResult,
    gates: {} as Record<string, DbResult>,
    contentById: {} as Record<string, DbResult>,
    inserts: [] as Array<{ table: string; row: unknown }>,
    updates: [] as Array<{ table: string; value: unknown; filters: QueryFilters }>,
    insertErrorByTable: {} as Record<string, { message: string; code?: string } | null>,
    updateResults: [] as DbResult[],
    projectedWith: null as { now?: string } | null,
    projection: null as OfficialCampaignProjection | null,
  }
  function selectResult(table: string, filters: QueryFilters): DbResult {
    if (table === 'social_content_research_packets') return state.packet
    if (table === 'social_content_calendar_items') return state.calendar
    if (table === 'social_topic_backlog') return state.backlog
    if (table === 'social_content_queue') return state.contentById[String(filters.id ?? '')] ?? { data: null, error: null }
    if (table === 'social_topic_source_receipts') {
      if (filters['in:source_id']) return state.product
      const gate = (filters['contains:metadata'] as { official_campaign_gate?: string } | undefined)?.official_campaign_gate
      if (gate && state.gates[gate]) return state.gates[gate]
      return { data: [], error: null }
    }
    return { data: null, error: { message: `unexpected table ${table}` } }
  }
  function createQuery(table: string) {
    const filters: QueryFilters = {}
    let mode: 'select' | 'update' = 'select'
    let payload: unknown
    function finish(): Promise<DbResult> {
      if (mode === 'update') {
        state.updates.push({ table, value: payload, filters: { ...filters } })
        return Promise.resolve(state.updateResults.shift() ?? { data: { id: 'updated' }, error: null })
      }
      return Promise.resolve(selectResult(table, filters))
    }
    const query = {
      select: () => query,
      insert: (row: unknown) => {
        state.inserts.push({ table, row })
        return Promise.resolve({ data: state.insertErrorByTable[table] ? null : { id: 'inserted' }, error: state.insertErrorByTable[table] ?? null })
      },
      update: (value: unknown) => { mode = 'update'; payload = value; return query },
      in: (field: string, values: unknown) => { filters[`in:${field}`] = values; return query },
      eq: (field: string, value: unknown) => { filters[field] = value; return query },
      contains: (field: string, value: unknown) => { filters[`contains:${field}`] = value; return query },
      is: (field: string, value: unknown) => { filters[`is:${field}`] = value; return query },
      limit: () => finish(),
      maybeSingle: () => finish(),
      then: (resolve: (value: DbResult) => unknown, reject?: (reason: unknown) => unknown) => finish().then(resolve, reject),
    }
    return query
  }
  return { state, createQuery }
})

vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: (table: string) => db.createQuery(table) } }))
vi.mock('@/lib/social-official-campaign-handoff', async () => {
  const actual = await vi.importActual<typeof import('@/lib/social-official-campaign-handoff')>('@/lib/social-official-campaign-handoff')
  return {
    ...actual,
    projectOfficialCampaignHandoff: (input: { now: string }) => {
      db.state.projectedWith = input
      return db.state.projection
    },
  }
})

import { prepareOfficialCampaignHandoff, readOfficialCampaignHandoff } from './social-official-campaign-store'

function blockedProjection(): OfficialCampaignProjection {
  return {
    version: OFFICIAL_CAMPAIGN_HANDOFF_VERSION,
    candidate_key: OFFICIAL_CAMPAIGN_CANDIDATE_KEY,
    status: 'blocked',
    review_only: true,
    input_version: 'sha256:blocked',
    packet_ids: [...OFFICIAL_CAMPAIGN_PACKET_IDS],
    product_receipt_ids: [],
    gate_receipts: [],
    blockers: [{ code: 'official_review_pending', observed: 'review_ready/pending', required: 'approved/approved, public safe', owner: 'content_reviewer', next_action: 'Review the packet.', href: '/admin/agents/content-intelligence?section=research' }],
    channel_reviews: [],
    source_lineage: [],
    side_effects: CLOSED,
  }
}
function readyProjection(): OfficialCampaignProjection {
  return {
    ...blockedProjection(),
    status: 'review_ready',
    input_version: 'sha256:ready',
    blockers: [],
    channel_reviews: [
      { channel: 'linkedin', title: 'Who decides when an AI agent can act?', thumbnail_teaser: null, copy: 'Review copy.', content_id: 'content-li', calendar_item_id: 'cal-li' },
      { channel: 'youtube', title: 'Who Gives an AI Agent Permission to Act?', thumbnail_teaser: 'WHO DECIDES?', copy: 'Review script.', content_id: 'content-yt', calendar_item_id: 'cal-yt' },
    ],
  }
}
function openCalendar() {
  return [
    { id: 'cal-li', channel: 'linkedin', authorization_status: 'pending', social_content_id: null, updated_at: NOW, metadata: {} },
    { id: 'cal-yt', channel: 'youtube', authorization_status: 'pending', social_content_id: null, updated_at: NOW, metadata: {} },
  ]
}
function draft(id: string, version: string) {
  return { id, status: 'draft', rag_context: { official_campaign_input_version: version }, scheduled_for: null, published_at: null, platform_post_id: null }
}

describe('official campaign handoff persistence', () => {
  beforeEach(() => {
    db.state.packet = { data: [], error: null }
    db.state.product = { data: [], error: null }
    db.state.calendar = { data: [], error: null }
    db.state.backlog = { data: null, error: null }
    db.state.gates = {}
    db.state.contentById = {}
    db.state.inserts = []
    db.state.updates = []
    db.state.insertErrorByTable = {}
    db.state.updateResults = []
    db.state.projectedWith = null
    db.state.projection = blockedProjection()
  })

  it('closes evidence reads and refuses ambiguous calendar or gate rows before projecting', async () => {
    db.state.packet = { data: null, error: { message: 'password=hunter2' } }
    await expect(readOfficialCampaignHandoff(NOW)).rejects.toThrow(/^official_campaign_evidence_read_failed$/)
    expect(db.state.projectedWith).toBeNull()

    db.state.packet = { data: [], error: null }
    db.state.calendar = { data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], error: null }
    await expect(readOfficialCampaignHandoff(NOW)).rejects.toThrow(/^official_campaign_evidence_ambiguous$/)
    expect(db.state.projectedWith).toBeNull()

    db.state.calendar = { data: [], error: null }
    db.state.gates.product_visual = { data: [{ receipt_id: 'one' }, { receipt_id: 'two' }], error: null }
    await expect(readOfficialCampaignHandoff(NOW)).rejects.toThrow(/^official_campaign_evidence_ambiguous$/)
    expect(db.state.inserts).toEqual([])
    expect(db.state.updates).toEqual([])
  })

  it('does not write when the backlog is sealed or the saved handoff is unchanged', async () => {
    db.state.projection = readyProjection()
    db.state.backlog = { data: { id: 'backlog-1', status: 'completed', updated_at: NOW, metadata: {} }, error: null }
    await expect(prepareOfficialCampaignHandoff(NOW)).rejects.toThrow(/^official_campaign_backlog_sealed$/)
    expect(db.state.inserts).toEqual([])
    expect(db.state.updates).toEqual([])

    const projection = readyProjection()
    db.state.projection = projection
    db.state.backlog = { data: { id: 'backlog-1', status: 'available', updated_at: NOW, metadata: { official_campaign_handoff: {
      input_version: projection.input_version, status: projection.status, blockers: projection.blockers, channel_reviews: projection.channel_reviews,
    } } }, error: null }
    db.state.contentById['content-li'] = { data: draft('content-li', projection.input_version), error: null }
    db.state.contentById['content-yt'] = { data: draft('content-yt', projection.input_version), error: null }
    db.state.calendar = { data: [
      { id: 'cal-li', channel: 'linkedin', authorization_status: 'pending', social_content_id: 'content-li', updated_at: NOW, metadata: { official_campaign_handoff: { input_version: projection.input_version } } },
      { id: 'cal-yt', channel: 'youtube', authorization_status: 'pending', social_content_id: 'content-yt', updated_at: NOW, metadata: { official_campaign_handoff: { input_version: projection.input_version } } },
    ], error: null }
    const unchanged = await prepareOfficialCampaignHandoff(NOW)
    expect(unchanged).toMatchObject({ persistence: 'unchanged', projection: { status: 'review_ready' } })
    expect(db.state.inserts).toEqual([])
    expect(db.state.updates).toEqual([])
  })

  it('preserves operator metadata and fails closed on backlog conflicts without returning database text', async () => {
    db.state.backlog = { data: { id: 'backlog-1', status: 'available', updated_at: NOW, metadata: {
      operator_note: 'keep', official_campaign_handoff: { input_version: 'sha256:old', status: 'blocked', blockers: [], channel_reviews: [] },
    } }, error: null }
    const saved = await prepareOfficialCampaignHandoff(NOW)
    expect(saved.persistence).toBe('saved')
    expect(db.state.updates).toHaveLength(1)
    expect(db.state.updates[0].filters).toMatchObject({ id: 'backlog-1', updated_at: NOW })
    expect(db.state.updates[0].value).toMatchObject({ metadata: {
      operator_note: 'keep', external_execution_enabled: false, review_state: 'blocked',
      official_campaign_handoff: { input_version: 'sha256:blocked', status: 'blocked' },
    } })

    db.state.updates = []
    db.state.updateResults = [{ data: null, error: null }]
    await expect(prepareOfficialCampaignHandoff(NOW)).rejects.toThrow(/^official_campaign_backlog_conflict$/)

    db.state.backlog = { data: null, error: null }
    db.state.insertErrorByTable.social_topic_backlog = { message: 'duplicate key value violates social_topic_backlog_candidate_key', code: '23505' }
    await expect(prepareOfficialCampaignHandoff(NOW)).rejects.toThrow(/^official_campaign_backlog_conflict$/)

    db.state.insertErrorByTable.social_topic_backlog = { message: 'timeout talking to db.internal', code: 'XX000' }
    await expect(prepareOfficialCampaignHandoff(NOW)).rejects.toThrow(/^official_campaign_backlog_write_failed$/)
    expect(db.state.inserts.some((entry) => JSON.stringify(entry.row).includes('db.internal'))).toBe(false)
  })

  it('creates unscheduled review drafts and binds only an empty pending calendar slot', async () => {
    const projection = readyProjection()
    db.state.projection = projection
    db.state.calendar = { data: openCalendar(), error: null }
    const created = await prepareOfficialCampaignHandoff(NOW)
    expect(created).toMatchObject({ persistence: 'saved', projection: { status: 'review_ready', channel_reviews: projection.channel_reviews } })
    expect(db.state.projectedWith?.now).toBe(NOW)
    expect(db.state.inserts.map((entry) => entry.table)).toEqual(['social_content_queue', 'social_content_queue', 'social_topic_backlog'])
    expect(db.state.inserts[0].row).toMatchObject({ id: 'content-li', platform: 'linkedin', status: 'draft', is_test_data: false, rag_context: { external_execution_enabled: false, copy_approved: false, approval_status: 'in_review', source: 'official_signal_campaign_handoff' } })
    expect(db.state.inserts[0].row).not.toHaveProperty('scheduled_for')
    expect(db.state.inserts[0].row).not.toHaveProperty('youtube_title')
    expect(db.state.inserts[1].row).toMatchObject({ id: 'content-yt', platform: 'youtube', status: 'draft', youtube_title: projection.channel_reviews[1].title, rag_context: { external_execution_enabled: false, asset_approved: false } })
    expect(db.state.updates.map((entry) => entry.filters)).toEqual([
      { id: 'cal-li', updated_at: NOW, 'is:social_content_id': null },
      { id: 'cal-yt', updated_at: NOW, 'is:social_content_id': null },
    ])
    expect(db.state.updates[0].value).toMatchObject({ social_content_id: 'content-li', metadata: { official_campaign_handoff: { review_only: true, external_execution_enabled: false, input_version: 'sha256:ready' } } })
  })

  it('turns review and calendar binding failures into a blocked handoff without leaking database text', async () => {
    const projection = readyProjection()
    db.state.projection = projection
    db.state.calendar = { data: openCalendar(), error: null }
    db.state.contentById['content-li'] = { data: null, error: { message: 'jwt leaked' } }
    const readFailed = await prepareOfficialCampaignHandoff(NOW)
    expect(readFailed.persistence).toBe('saved')
    expect(readFailed.projection.status).toBe('blocked')
    expect(readFailed.projection.channel_reviews).toEqual([])
    expect(readFailed.projection.blockers.at(-1)).toMatchObject({ code: 'review_binding_incomplete', observed: 'official_campaign_review_read_failed' })
    expect(JSON.stringify(readFailed)).not.toContain('jwt leaked')
    expect(db.state.updates.filter((entry) => entry.table === 'social_content_calendar_items')).toEqual([])

    db.state.inserts = []
    db.state.updates = []
    db.state.contentById = { 'content-li': { data: { ...draft('content-li', projection.input_version), scheduled_for: '2026-11-01T12:00:00.000Z' }, error: null } }
    const scheduled = await prepareOfficialCampaignHandoff(NOW)
    expect(scheduled.projection.blockers.at(-1)).toMatchObject({ code: 'review_binding_incomplete', observed: 'official_campaign_review_conflict' })
    expect(scheduled.projection.status).toBe('blocked')

    db.state.inserts = []
    db.state.updates = []
    db.state.contentById = {}
    db.state.insertErrorByTable.social_content_queue = { message: 'timeout talking to db.internal', code: 'XX000' }
    const writeFailed = await prepareOfficialCampaignHandoff(NOW)
    expect(writeFailed.projection.blockers.at(-1)).toMatchObject({ code: 'review_binding_incomplete', observed: 'official_campaign_review_write_failed' })
    expect(JSON.stringify(writeFailed)).not.toContain('db.internal')

    db.state.inserts = []
    db.state.updates = []
    db.state.insertErrorByTable = {}
    db.state.contentById = {
      'content-li': { data: draft('content-li', projection.input_version), error: null },
      'content-yt': { data: draft('content-yt', projection.input_version), error: null },
    }
    db.state.updateResults = [{ data: null, error: null }]
    const calendarMiss = await prepareOfficialCampaignHandoff(NOW)
    expect(calendarMiss.projection.status).toBe('blocked')
    expect(calendarMiss.projection.blockers.at(-1)).toMatchObject({ code: 'review_binding_incomplete', observed: 'official_campaign_calendar_conflict' })
    expect(db.state.inserts.map((entry) => entry.table)).toEqual(['social_topic_backlog'])
  })
})
