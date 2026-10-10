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
  supabaseAdmin: { from: mocks.from },
}))

import { GET, PATCH } from './route'

const NOW = '2026-09-24T12:00:00.000Z'
const STALE_MS = 15 * 60 * 1000

function request(url: string, method = 'GET', body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function isoOffset(ms: number) {
  return new Date(Date.now() + ms).toISOString()
}

function listChain(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    eq: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  return query
}

describe('value-evidence workflow-status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(NOW))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockImplementation(
      (result: { error?: string } | null) => Boolean(result) && typeof result === 'object' && 'error' in result
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('GET', () => {
    it('rejects non-admins', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

      const response = await GET(request('http://localhost/api/admin/value-evidence/workflow-status'))

      expect(response.status).toBe(401)
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('caps the limit at 50 and applies workflow and active filters', async () => {
      const query = listChain({ data: [], error: null })
      mocks.from.mockReturnValue({ select: vi.fn(() => query), update: vi.fn() })

      const response = await GET(
        request('http://localhost/api/admin/value-evidence/workflow-status?workflow_id=vep001&active=true&limit=999')
      )

      expect(response.status).toBe(200)
      expect(query.limit).toHaveBeenCalledWith(50)
      expect(query.eq).toHaveBeenCalledWith('workflow_id', 'vep001')
      expect(query.eq).toHaveBeenCalledWith('status', 'running')
      expect(await response.json()).toEqual({ runs: [] })
    })

    it('defaults the limit to 10 and skips filters that are empty', async () => {
      const query = listChain({ data: [], error: null })
      mocks.from.mockReturnValue({ select: vi.fn(() => query) })

      await GET(request('http://localhost/api/admin/value-evidence/workflow-status?workflow_id=&active=false'))

      expect(query.limit).toHaveBeenCalledWith(10)
      expect(query.eq).not.toHaveBeenCalled()
    })

    it('marks only running rows older than 15 minutes as stale and fails them', async () => {
      const runs = [
        { id: 'stale', status: 'running', triggered_at: isoOffset(-(STALE_MS + 1)), workflow_id: 'vep001' },
        { id: 'boundary', status: 'running', triggered_at: isoOffset(-STALE_MS), workflow_id: 'vep001' },
        { id: 'fresh', status: 'running', triggered_at: isoOffset(-(STALE_MS - 1)), workflow_id: 'vep001' },
        { id: 'done', status: 'success', triggered_at: isoOffset(-(STALE_MS + 60_000)), workflow_id: 'vep001' },
        { id: 'bad-date', status: 'running', triggered_at: 'not-a-date', workflow_id: 'vep001' },
      ]
      const query = listChain({ data: runs, error: null })
      const updateIn = vi.fn().mockResolvedValue({ error: null })
      const update = vi.fn(() => ({ in: updateIn }))
      mocks.from.mockReturnValue({ select: vi.fn(() => query), update })

      const response = await GET(request('http://localhost/api/admin/value-evidence/workflow-status'))
      const body = await response.json()

      expect(body.runs.map((run: { id: string; stale: boolean }) => [run.id, run.stale])).toEqual([
        ['stale', true],
        ['boundary', false],
        ['fresh', false],
        ['done', false],
        ['bad-date', false],
      ])
      expect(update).toHaveBeenCalledWith({
        status: 'failed',
        completed_at: NOW,
        error_message: 'Auto-resolved: workflow exceeded maximum expected duration',
      })
      expect(updateIn).toHaveBeenCalledWith('id', ['stale'])
    })

    it('still returns the runs when the stale-run update fails', async () => {
      const query = listChain({
        data: [{ id: 'stale', status: 'running', triggered_at: isoOffset(-(STALE_MS + 1)) }],
        error: null,
      })
      const updateIn = vi.fn().mockResolvedValue({ error: { message: 'lock timeout' } })
      mocks.from.mockReturnValue({
        select: vi.fn(() => query),
        update: vi.fn(() => ({ in: updateIn })),
      })

      const response = await GET(request('http://localhost/api/admin/value-evidence/workflow-status'))

      expect(response.status).toBe(200)
      expect((await response.json()).runs[0].stale).toBe(true)
      await new Promise((resolve) => setImmediate(resolve))
      expect(console.warn).toHaveBeenCalledWith('Auto-resolve stale runs failed:', 'lock timeout')
    })

    it('returns a generic error when the list query fails', async () => {
      const query = listChain({ data: null, error: { message: 'db down' } })
      mocks.from.mockReturnValue({ select: vi.fn(() => query) })

      const response = await GET(request('http://localhost/api/admin/value-evidence/workflow-status'))

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Failed to fetch runs' })
    })
  })

  describe('PATCH', () => {
    it('requires a running run and records the supplied reason', async () => {
      const missing = await PATCH(request('http://localhost/api/admin/value-evidence/workflow-status', 'PATCH', 'not-json'))
      expect(missing.status).toBe(400)
      expect(await missing.json()).toEqual({ error: 'run_id is required' })

      const single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
      mocks.from.mockReturnValue({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single })) })),
      })
      const notFound = await PATCH(
        request('http://localhost/api/admin/value-evidence/workflow-status', 'PATCH', { run_id: 'missing' })
      )
      expect(notFound.status).toBe(404)

      single.mockResolvedValue({ data: { id: 'run-1', status: 'success' }, error: null })
      const notRunning = await PATCH(
        request('http://localhost/api/admin/value-evidence/workflow-status', 'PATCH', { run_id: 'run-1' })
      )
      expect(notRunning.status).toBe(400)
      expect(await notRunning.json()).toEqual({ error: 'Run is not in running state' })

      single.mockResolvedValue({ data: { id: 'run-1', status: 'running' }, error: null })
      const updateEq = vi.fn().mockResolvedValue({ error: null })
      const update = vi.fn(() => ({ eq: updateEq }))
      mocks.from.mockReturnValue({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single })) })),
        update,
      })

      const response = await PATCH(
        request('http://localhost/api/admin/value-evidence/workflow-status', 'PATCH', {
          run_id: 'run-1',
          reason: 'Operator stopped it',
        })
      )

      expect(update).toHaveBeenCalledWith({
        status: 'failed',
        completed_at: NOW,
        error_message: 'Operator stopped it',
      })
      expect(updateEq).toHaveBeenCalledWith('id', 'run-1')
      expect(await response.json()).toEqual({ ok: true, run_id: 'run-1' })
    })

    it('uses the default failure reason and returns the database message on update errors', async () => {
      const single = vi.fn().mockResolvedValue({ data: { id: 'run-1', status: 'running' }, error: null })
      const updateEq = vi.fn().mockResolvedValue({ error: { message: 'write failed' } })
      mocks.from.mockReturnValue({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single })) })),
        update: vi.fn(() => ({ eq: updateEq })),
      })

      const response = await PATCH(
        request('http://localhost/api/admin/value-evidence/workflow-status', 'PATCH', { run_id: 'run-1' })
      )

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'write failed' })
    })
  })
})
