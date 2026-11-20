import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET, PATCH } from './route'

function makeGet(query = '') {
  return new NextRequest(`http://localhost/api/admin/social-content/runs${query}`)
}

function makePatch(body?: string) {
  return new NextRequest('http://localhost/api/admin/social-content/runs', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body,
  })
}

function mockRunsQuery(result: { data: unknown; error: { message: string } | null }) {
  const promise = Promise.resolve(result)
  const builder = {
    select: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    eq: vi.fn(),
    then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      promise.then(onFulfilled, onRejected),
  }
  builder.select.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  builder.limit.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  return builder
}

function mockMeetings(data: unknown) {
  const inn = vi.fn().mockResolvedValue({ data, error: null })
  const select = vi.fn(() => ({ in: inn }))
  return { select, in: inn }
}

function mockRunFetch(data: unknown) {
  const single = vi.fn().mockResolvedValue({ data, error: null })
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq }))
  return { select, eq, single }
}

function mockRunUpdate(error: { message: string } | null = null) {
  const eq = vi.fn().mockResolvedValue({ error })
  const update = vi.fn(() => ({ eq }))
  return { update, eq }
}

describe('/api/admin/social-content/runs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-28T10:00:00.000Z'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requires admin auth before listing runs', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGet('?active=true'))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('caps the limit at 50 and leaves inactive filters off', async () => {
    const query = mockRunsQuery({ data: [], error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(makeGet('?limit=80&active=false'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ runs: [], running_count: 0 })
    expect(query.limit).toHaveBeenCalledWith(50)
    expect(query.eq).not.toHaveBeenCalled()
    expect(query.order).toHaveBeenCalledWith('triggered_at', { ascending: false })
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('marks a running row stale only after eight minutes and attaches the meeting title', async () => {
    const query = mockRunsQuery({
      data: [
        {
          id: 'run-stale',
          triggered_at: '2026-09-28T09:51:59.000Z',
          completed_at: null,
          status: 'running',
          items_inserted: null,
          error_message: null,
          meeting_record_id: 'meet-1',
        },
        {
          id: 'run-fresh',
          triggered_at: '2026-09-28T09:52:00.000Z',
          completed_at: null,
          status: 'running',
          items_inserted: 1,
          error_message: null,
          meeting_record_id: 'meet-1',
        },
        {
          id: 'run-done',
          triggered_at: '2026-09-28T08:00:00.000Z',
          completed_at: '2026-09-28T08:05:00.000Z',
          status: 'completed',
          items_inserted: 2,
          error_message: null,
          meeting_record_id: null,
        },
      ],
      error: null,
    })
    const meetings = mockMeetings([
      { id: 'meet-1', raw_notes: null, structured_notes: { title: '  Kickoff  ' } },
    ])
    mocks.from.mockImplementation((table: string) => (table === 'meeting_records' ? meetings : query))

    const response = await GET(makeGet('?active=true'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(query.eq).toHaveBeenCalledWith('status', 'running')
    expect(query.limit).toHaveBeenCalledWith(20)
    expect(meetings.in).toHaveBeenCalledWith('id', ['meet-1'])
    expect(body.running_count).toBe(2)
    expect(body.runs).toEqual([
      expect.objectContaining({
        id: 'run-stale',
        workflow_id: 'soc001',
        meeting_title: 'Kickoff',
        stale: true,
      }),
      expect.objectContaining({
        id: 'run-fresh',
        meeting_title: 'Kickoff',
        stale: false,
      }),
      expect.objectContaining({
        id: 'run-done',
        meeting_title: null,
        stale: false,
      }),
    ])
  })

  it('returns a generic list error and a generic thrown error', async () => {
    mocks.from.mockReturnValueOnce(mockRunsQuery({ data: null, error: { message: 'db down' } }))
    const failed = await GET(makeGet())
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'Failed to fetch runs' })

    mocks.from.mockImplementation(() => {
      throw new Error('boom')
    })
    const thrown = await GET(makeGet())
    expect(thrown.status).toBe(500)
    expect(await thrown.json()).toEqual({ error: 'Internal server error' })
  })

  it('requires admin auth before marking a run failed', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PATCH(makePatch(JSON.stringify({ run_id: 'run-1' })))

    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a missing run id, including invalid JSON and an empty reason fallback', async () => {
    const missing = await PATCH(makePatch(JSON.stringify({})))
    const invalid = await PATCH(makePatch('not-json'))

    expect(missing.status).toBe(400)
    expect(invalid.status).toBe(400)
    expect(await missing.json()).toEqual({ error: 'run_id is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a missing run and a run that is not running', async () => {
    mocks.from.mockReturnValueOnce(mockRunFetch(null))
    const missing = await PATCH(makePatch(JSON.stringify({ run_id: 'run-1' })))
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: 'Run not found' })

    mocks.from.mockReturnValueOnce(mockRunFetch({ id: 'run-1', status: 'completed' }))
    const completed = await PATCH(makePatch(JSON.stringify({ run_id: 'run-1' })))
    expect(completed.status).toBe(400)
    expect(await completed.json()).toEqual({ error: 'Run is not in running state' })
  })

  it('marks a running row failed and stores a blank reason as the default', async () => {
    const update = mockRunUpdate()
    mocks.from
      .mockReturnValueOnce(mockRunFetch({ id: 'run-1', status: 'running' }))
      .mockReturnValueOnce(update)

    const response = await PATCH(makePatch(JSON.stringify({ run_id: 'run-1', reason: '' })))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, run_id: 'run-1' })
    expect(update.update).toHaveBeenCalledWith({
      status: 'failed',
      completed_at: '2026-09-28T10:00:00.000Z',
      error_message: 'Manually marked as failed (stale run)',
    })
    expect(update.eq).toHaveBeenCalledWith('id', 'run-1')
  })

  it('stores a provided reason and returns the raw update error', async () => {
    const update = mockRunUpdate({ message: 'check constraint failed' })
    mocks.from
      .mockReturnValueOnce(mockRunFetch({ id: 'run-1', status: 'running' }))
      .mockReturnValueOnce(update)

    const response = await PATCH(makePatch(JSON.stringify({ run_id: 'run-1', reason: 'operator stopped it' })))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'check constraint failed' })
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      error_message: 'operator stopped it',
    }))
  })
})
