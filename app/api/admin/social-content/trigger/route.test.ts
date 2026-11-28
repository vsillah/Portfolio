import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  triggerSocialContentExtraction: vi.fn(),
  getSocialContentPrompts: vi.fn(),
  startAgentRun: vi.fn(),
  recordAgentStep: vi.fn(),
  markAgentRunFailed: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  results: [] as Array<{ data: unknown; error?: unknown }>,
  inserts: [] as Array<{ table: string; payload: unknown }>,
  updates: [] as Array<{ table: string; payload: unknown }>,
  chains: [] as Array<{ table: string; calls: Array<{ method: string; args: unknown[] }> }>,
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (result: { error?: string }) => Boolean(result && 'error' in result),
}))

vi.mock('@/lib/n8n', () => ({
  triggerSocialContentExtraction: mocks.triggerSocialContentExtraction,
}))

vi.mock('@/lib/system-prompts', () => ({
  getSocialContentPrompts: mocks.getSocialContentPrompts,
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  recordAgentStep: mocks.recordAgentStep,
  markAgentRunFailed: mocks.markAgentRunFailed,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
    rpc: mocks.rpc,
  },
}))

import { GET, POST } from './route'

const prompts = { extract: 'prompt' }

function asAdmin() {
  mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
}

function asGuest() {
  mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
}

function resetDb() {
  mocks.results = []
  mocks.inserts = []
  mocks.updates = []
  mocks.chains = []
  mocks.from.mockImplementation((table: string) => {
    const result = mocks.results.shift() ?? { data: null, error: { message: `unexpected ${table}` } }
    const trace = { table, calls: [] as Array<{ method: string; args: unknown[] }> }
    mocks.chains.push(trace)
    const chain: Record<string, unknown> = {}
    const record = (method: string) => vi.fn((...args: unknown[]) => {
      trace.calls.push({ method, args })
      if (method === 'insert') mocks.inserts.push({ table, payload: args[0] })
      if (method === 'update') mocks.updates.push({ table, payload: args[0] })
      return chain
    })
    for (const method of ['select', 'not', 'gte', 'order', 'limit', 'in', 'eq', 'insert', 'update']) {
      chain[method] = record(method)
    }
    chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject)
    return chain
  })
}

function post(body: unknown) {
  return new NextRequest('http://localhost/api/admin/social-content/trigger', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function calls(table: string, method: string) {
  return mocks.chains
    .filter((chain) => chain.table === table)
    .flatMap((chain) => chain.calls.filter((call) => call.method === method))
}

describe('POST /api/admin/social-content/trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDb()
    asAdmin()
    mocks.getSocialContentPrompts.mockResolvedValue(prompts)
    mocks.startAgentRun.mockImplementation(async () => ({ id: `agent-${mocks.startAgentRun.mock.calls.length}` }))
    mocks.recordAgentStep.mockResolvedValue(undefined)
    mocks.markAgentRunFailed.mockResolvedValue(undefined)
    mocks.triggerSocialContentExtraction.mockResolvedValue({ triggered: true, message: 'ok' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects non-admins before reading meetings', async () => {
    asGuest()

    const response = await POST(post({}))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.triggerSocialContentExtraction).not.toHaveBeenCalled()
  })

  it('resolves unprocessed meetings from the last 7 days, skips queued ids, and caps at 10', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date('2026-09-29T10:00:00.000Z'))
    const recent = Array.from({ length: 12 }, (_, index) => ({ id: `m-${index}` }))
    mocks.results.push(
      { data: [{ meeting_record_id: 'queued-1' }, { meeting_record_id: null }] },
      { data: [{ id: 'queued-1' }, ...recent] },
      { data: recent.slice(0, 10).map((row) => ({ id: row.id })), error: null },
      { data: [] },
      {
        data: recent.slice(0, 10).map((row) => ({ id: `run-${row.id}`, meeting_record_id: row.id })),
        error: null,
      },
    )

    const pending = POST(post({}))
    await vi.runAllTimersAsync()
    const response = await pending
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.triggered).toBe(10)
    expect(calls('meeting_records', 'gte')[0].args).toEqual(['created_at', '2026-09-22T10:00:00.000Z'])
    expect(calls('meeting_records', 'limit')[0].args).toEqual([11])
    expect(calls('meeting_records', 'in')[0].args[1]).toEqual(recent.slice(0, 10).map((row) => row.id))
    expect(mocks.triggerSocialContentExtraction).toHaveBeenCalledTimes(10)
    expect(mocks.triggerSocialContentExtraction).toHaveBeenNthCalledWith(1, {
      meetingRecordId: 'm-0',
      runId: 'run-m-0',
      agentRunId: 'agent-1',
      prompts,
    })
  })

  it('returns an empty success when every recent meeting is already queued', async () => {
    mocks.results.push(
      { data: [{ meeting_record_id: 'queued-1' }] },
      { data: [{ id: 'queued-1' }] },
    )

    const response = await POST(post({ meeting_record_ids: [] }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      message: 'No unprocessed meetings found.',
      runs: [],
    })
    expect(mocks.triggerSocialContentExtraction).not.toHaveBeenCalled()
  })

  it('caps an explicit id list at 10 and keeps a single-id request', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const ids = Array.from({ length: 12 }, (_, index) => `id-${index}`)
    mocks.results.push(
      { data: ids.slice(0, 10).map((id) => ({ id })), error: null },
      { data: [] },
      { data: ids.slice(0, 10).map((id) => ({ id: `run-${id}`, meeting_record_id: id })), error: null },
    )

    const pending = POST(post({ meeting_record_ids: ids }))
    await vi.runAllTimersAsync()
    const capped = await pending
    expect((await capped.json()).triggered).toBe(10)
    expect(calls('meeting_records', 'in')[0].args[1]).toEqual(ids.slice(0, 10))

    resetDb()
    mocks.results.push(
      { data: [{ id: 'only-one' }], error: null },
      { data: [] },
      { data: [{ id: 'run-one', meeting_record_id: 'only-one' }], error: null },
    )
    const single = await POST(post({ meeting_record_id: 'only-one' }))
    expect((await single.json()).runs).toEqual([
      expect.objectContaining({ meeting_record_id: 'only-one', status: 'running' }),
    ])
  })

  it('returns 500 when meeting validation fails and 404 when none of the ids exist', async () => {
    mocks.results.push({ data: null, error: { message: 'db down' } })
    const invalid = await POST(post({ meeting_record_id: 'missing' }))
    expect(invalid.status).toBe(500)
    expect(await invalid.json()).toEqual({ error: 'Failed to validate meetings' })

    resetDb()
    mocks.results.push({ data: [], error: null })
    const missing = await POST(post({ meeting_record_id: 'missing' }))
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: 'No valid meeting records found' })
    expect(mocks.triggerSocialContentExtraction).not.toHaveBeenCalled()
  })

  it('skips meetings that already have a running extraction and only inserts the rest', async () => {
    mocks.results.push(
      { data: [{ id: 'new-1' }, { id: 'running-1' }], error: null },
      { data: [{ id: 'existing-run', meeting_record_id: 'running-1' }] },
      { data: [{ id: 'run-new', meeting_record_id: 'new-1' }], error: null },
    )

    const response = await POST(post({ meeting_record_ids: ['new-1', 'running-1'] }))
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(body.message).toBe('1 extraction(s) triggered, 1 already running')
    expect(body.skipped).toBe(1)
    expect(body.runs.map((run: { meeting_record_id: string }) => run.meeting_record_id)).toEqual([
      'running-1',
      'new-1',
    ])
    expect(mocks.inserts).toEqual([
      {
        table: 'social_content_extraction_runs',
        payload: [expect.objectContaining({ meeting_record_id: 'new-1', status: 'running' })],
      },
    ])
    expect(mocks.triggerSocialContentExtraction).toHaveBeenCalledTimes(1)
    expect(mocks.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      triggeredByUserId: 'admin-1',
      idempotencyKey: 'n8n:social-content:run-new',
      subject: { type: 'meeting_record', id: 'new-1', label: 'Meeting new-1' },
    }))
  })

  it('does not fire webhooks when run rows fail to insert', async () => {
    mocks.results.push(
      { data: [{ id: 'm-1' }], error: null },
      { data: [] },
      { data: null, error: { message: 'insert failed' } },
    )

    const response = await POST(post({ meeting_record_id: 'm-1' }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to create run records' })
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
    expect(mocks.triggerSocialContentExtraction).not.toHaveBeenCalled()
  })

  it('continues after a non-gateway webhook failure and reports the last error', async () => {
    mocks.results.push(
      { data: [{ id: 'm-1' }, { id: 'm-2' }], error: null },
      { data: [] },
      {
        data: [
          { id: 'run-1', meeting_record_id: 'm-1' },
          { id: 'run-2', meeting_record_id: 'm-2' },
        ],
        error: null,
      },
      { data: null, error: null },
      { data: null, error: null },
    )
    mocks.triggerSocialContentExtraction
      .mockResolvedValueOnce({ triggered: false, message: 'timeout' })
      .mockResolvedValueOnce({ triggered: false, message: 'rejected' })

    const response = await POST(post({ meeting_record_ids: ['m-1', 'm-2'] }))
    const body = await response.json()

    expect(body.success).toBe(false)
    expect(body.message).toBe('rejected')
    expect(body.failed).toBe(2)
    expect(mocks.triggerSocialContentExtraction).toHaveBeenCalledTimes(2)
    expect(mocks.updates.map((update) => update.payload)).toEqual([
      expect.objectContaining({ status: 'failed', error_message: 'timeout' }),
      expect.objectContaining({ status: 'failed', error_message: 'rejected' }),
    ])
    expect(mocks.markAgentRunFailed).toHaveBeenCalledTimes(2)
  })

  it('stops the rest of the batch when n8n returns 502', async () => {
    mocks.results.push(
      { data: [{ id: 'm-1' }, { id: 'm-2' }], error: null },
      { data: [] },
      {
        data: [
          { id: 'run-1', meeting_record_id: 'm-1' },
          { id: 'run-2', meeting_record_id: 'm-2' },
        ],
        error: null,
      },
      { data: null, error: null },
      { data: null, error: null },
    )
    mocks.triggerSocialContentExtraction.mockResolvedValue({
      triggered: false,
      message: 'Webhook returned 502',
    })

    const response = await POST(post({ meeting_record_ids: ['m-1', 'm-2'] }))
    const body = await response.json()

    expect(body.success).toBe(false)
    expect(body.message).toBe('Webhook returned 502')
    expect(body.runs.map((run: { status: string }) => run.status)).toEqual(['failed', 'failed'])
    expect(mocks.triggerSocialContentExtraction).toHaveBeenCalledTimes(1)
    expect(mocks.updates.map((update) => (update.payload as { error_message: string }).error_message)).toEqual([
      'Webhook returned 502',
      'Skipped — n8n unavailable',
    ])
    expect(mocks.markAgentRunFailed).toHaveBeenNthCalledWith(
      2,
      'agent-2',
      'Skipped - n8n unavailable',
      { workflow: 'WF-SOC-001', legacy_run_id: 'run-2' },
    )
  })

  it('still returns success when the dispatch step record fails', async () => {
    mocks.results.push(
      { data: [{ id: 'm-1' }], error: null },
      { data: [] },
      { data: [{ id: 'run-1', meeting_record_id: 'm-1' }], error: null },
    )
    mocks.recordAgentStep.mockRejectedValue(new Error('step down'))

    const response = await POST(post({ meeting_record_id: 'm-1' }))

    expect(response.status).toBe(200)
    expect((await response.json()).success).toBe(true)
  })

  it('hides unexpected exceptions', async () => {
    mocks.verifyAdmin.mockRejectedValue(new Error('auth exploded'))

    const response = await POST(post({}))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Internal server error' })
  })
})

describe('GET /api/admin/social-content/trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDb()
    asAdmin()
  })

  it('rejects non-admins before searching meetings', async () => {
    asGuest()

    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/trigger'))

    expect(response.status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('caps pagination, blanks empty filters, and appends an end-of-day bound', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })

    const response = await GET(new NextRequest(
      'http://localhost/api/admin/social-content/trigger?limit=80&offset=-4&q=%20%20&from=&to=2026-09-01',
    ))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ meetings: [], total: 0 })
    expect(mocks.rpc).toHaveBeenCalledWith('search_meeting_records', {
      search_term: null,
      date_from: null,
      date_to: '2026-09-01T23:59:59',
      result_limit: 50,
      result_offset: 0,
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns a generic error when the meeting search fails', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'rpc down' } })

    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/trigger'))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to fetch meeting records' })
  })

  it('enriches titles, participants, snippets, and queued counts', async () => {
    const longSummary = 'A'.repeat(160)
    mocks.rpc.mockResolvedValue({
      data: [
        {
          id: 'm1',
          meeting_type: 'sales',
          meeting_date: '2026-09-01',
          created_at: '2026-09-01T00:00:00.000Z',
          transcript: 'kept',
          structured_notes: { title: 'Kickoff', summary: longSummary },
          duration_minutes: 30,
          raw_notes: '<https://app.read.ai/a?x=1&amp;y=2|Ignored Title>',
          meeting_data: { decision_makers: ['Ada Lovelace', 'Vambah Sillah'] },
          attendees: null,
          total_count: 9,
        },
        {
          id: 'm2',
          meeting_type: 'internal',
          meeting_date: '2026-09-02',
          created_at: '2026-09-02T00:00:00.000Z',
          transcript: '<b>The meeting focused on billing delays</b>, and the rest',
          structured_notes: null,
          duration_minutes: null,
          raw_notes: null,
          meeting_data: null,
          attendees: null,
          total_count: 9,
        },
      ],
      error: null,
    })
    mocks.results.push({
      data: [
        { meeting_record_id: 'm1' },
        { meeting_record_id: 'm1' },
        { meeting_record_id: null },
      ],
    })

    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/trigger?q=billing'))
    const body = await response.json()

    expect(body.total).toBe(9)
    expect(body.meetings[0]).toMatchObject({
      id: 'm1',
      meeting_title: 'Kickoff',
      participants: ['Ada Lovelace'],
      source_url: 'https://app.read.ai/a?x=1&y=2',
      snippet: `${'A'.repeat(147)}...`,
      queued_count: 2,
      has_transcript: true,
    })
    expect(body.meetings[1]).toMatchObject({
      id: 'm2',
      meeting_title: 'Billing delays',
      participants: [],
      source_url: null,
      snippet: 'The meeting focused on billing delays, and the rest',
      queued_count: 0,
      has_transcript: true,
    })
  })

  it('hides unexpected search exceptions', async () => {
    mocks.rpc.mockRejectedValue('search exploded')

    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/trigger'))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Internal server error' })
  })
})
