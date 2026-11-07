import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  from: vi.fn(),
  results: [] as Array<{ data: unknown; error?: unknown }>,
  chains: [] as Array<{ table: string; calls: Array<{ method: string; args: unknown[] }> }>,
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (result: { error?: string }) => Boolean(result && 'error' in result),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { GET } from './route'

function resetDb() {
  mocks.results = []
  mocks.chains = []
  mocks.from.mockImplementation((table: string) => {
    const result = mocks.results.shift() ?? { data: [], error: null }
    const trace = { table, calls: [] as Array<{ method: string; args: unknown[] }> }
    mocks.chains.push(trace)
    const chain: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'in', 'order', 'limit']) {
      chain[method] = vi.fn((...args: unknown[]) => {
        trace.calls.push({ method, args })
        return chain
      })
    }
    chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject)
    return chain
  })
}

function meeting(overrides: Record<string, unknown>) {
  return {
    id: 'm-1',
    meeting_type: 'sales',
    meeting_date: '2026-09-02T00:00:00.000Z',
    duration_minutes: 30,
    transcript: null,
    structured_notes: null,
    key_decisions: null,
    action_items: null,
    open_questions: null,
    recording_url: null,
    contact_submission_id: 12,
    client_project_id: null,
    created_at: '2026-09-02T00:00:00.000Z',
    ...overrides,
  }
}

describe('GET /api/admin/sales/contact-meetings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDb()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
  })

  it('rejects non-admins and invalid contact ids before querying', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    const unauthorized = await GET(new NextRequest('http://localhost/api/admin/sales/contact-meetings?contact_submission_id=12'))
    expect(unauthorized.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()

    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    const missing = await GET(new NextRequest('http://localhost/api/admin/sales/contact-meetings'))
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({ error: 'contact_submission_id is required' })

    const nan = await GET(new NextRequest('http://localhost/api/admin/sales/contact-meetings?contact_submission_id=abc'))
    expect(nan.status).toBe(400)
    expect(await nan.json()).toEqual({ error: 'contact_submission_id must be a number' })
  })

  it('parses a numeric prefix and skips the project meeting query when the contact has no projects', async () => {
    mocks.results.push({ data: [] }, { data: [] })

    const response = await GET(new NextRequest(
      'http://localhost/api/admin/sales/contact-meetings?contact_submission_id=12abc',
    ))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ meetings: [], tasks: [] })
    expect(mocks.chains.map((chain) => chain.table)).toEqual(['client_projects', 'meeting_records'])
    expect(mocks.chains[0].calls.find((call) => call.method === 'eq')?.args).toEqual(['contact_submission_id', 12])
  })

  it('merges project meetings, drops invalid rows, and dedupes by type, date, and contact', async () => {
    const direct = [
      meeting({ id: 'older', meeting_date: '2026-09-01T00:00:00.000Z', duration_minutes: 10 }),
      meeting({ id: 'duplicate', meeting_date: '2026-09-03T00:00:00.000Z' }),
      meeting({ id: 'zero', duration_minutes: 0 }),
      meeting({ id: 'blank-date', meeting_date: '   ' }),
      meeting({ id: 'no-duration', duration_minutes: null }),
    ]
    const viaProject = [
      meeting({ id: 'duplicate', meeting_date: '2026-09-03T00:00:00.000Z' }),
      meeting({
        id: 'project-only',
        meeting_date: '2026-09-04T00:00:00.000Z',
        contact_submission_id: null,
        client_project_id: 'project-1',
        duration_minutes: '15',
      }),
    ]
    mocks.results.push(
      { data: [{ id: 'project-1' }] },
      { data: direct },
      { data: viaProject },
      { data: [{ id: 'task-1', meeting_record_id: 'project-only', display_order: 1 }] },
    )

    const response = await GET(new NextRequest(
      'http://localhost/api/admin/sales/contact-meetings?contact_submission_id=12',
    ))
    const body = await response.json()

    expect(body.meetings.map((row: { id: string }) => row.id)).toEqual(['project-only', 'duplicate', 'older'])
    expect(body.tasks).toEqual([{ id: 'task-1', meeting_record_id: 'project-only', display_order: 1 }])
    expect(mocks.chains[2].calls.find((call) => call.method === 'in')?.args).toEqual([
      'client_project_id',
      ['project-1'],
    ])
    expect(mocks.chains[3].calls.find((call) => call.method === 'in')?.args).toEqual([
      'meeting_record_id',
      ['project-only', 'duplicate', 'older'],
    ])
  })

  it('returns a meetings error before loading tasks', async () => {
    mocks.results.push(
      { data: [] },
      { data: [meeting({ id: 'kept' })], error: { message: 'meetings down' } },
    )

    const response = await GET(new NextRequest(
      'http://localhost/api/admin/sales/contact-meetings?contact_submission_id=12',
    ))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to fetch meetings' })
    expect(mocks.chains.map((chain) => chain.table)).not.toContain('meeting_action_tasks')
  })

  it('returns a task error and hides unexpected exceptions', async () => {
    mocks.results.push(
      { data: [] },
      { data: [meeting({ id: 'kept' })] },
      { data: null, error: { message: 'tasks down' } },
    )
    const tasks = await GET(new NextRequest(
      'http://localhost/api/admin/sales/contact-meetings?contact_submission_id=12',
    ))
    expect(tasks.status).toBe(500)
    expect(await tasks.json()).toEqual({ error: 'Failed to fetch tasks' })

    mocks.from.mockImplementation(() => {
      throw new Error('query exploded')
    })
    const thrown = await GET(new NextRequest(
      'http://localhost/api/admin/sales/contact-meetings?contact_submission_id=12',
    ))
    expect(thrown.status).toBe(500)
    expect(await thrown.json()).toEqual({ error: 'Internal server error' })
  })
})
