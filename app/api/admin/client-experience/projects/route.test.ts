// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (value: unknown) => Boolean(value && typeof value === 'object' && 'error' in value),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { GET } from './route'

const terminals: Record<string, string> = {
  client_projects: 'order',
  client_dashboard_access: 'eq',
  proposals: 'in',
}

function installTables(results: Record<string, { data: unknown; error: unknown }>) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = []
  mocks.from.mockImplementation((table: string) => {
    const builder: Record<string, unknown> = {}
    for (const method of ['select', 'order', 'in', 'eq']) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ table, method, args })
        return method === terminals[table] ? Promise.resolve(results[table]) : builder
      }
    }
    return builder
  })
  return calls
}

const projects = [
  {
    id: 'project-1',
    project_name: 'Atlas',
    client_name: 'Ada',
    client_email: 'ada@example.com',
    project_status: 'active',
    created_at: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'project-2',
    project_name: 'Boreal',
    client_name: 'Ada',
    client_email: 'ada@example.com',
    project_status: 'paused',
    created_at: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'project-3',
    project_name: 'Cedar',
    client_name: 'Bea',
    client_email: '',
    project_status: 'active',
    created_at: '2026-08-01T00:00:00.000Z',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
})

describe('GET /api/admin/client-experience/projects', () => {
  it('requires admin before reading projects', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Admin access required', status: 403 })
    const response = await GET(new NextRequest('http://localhost/api/admin/client-experience/projects'))
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Admin access required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('keeps the last proposal row for an email and only marks returned dashboard tokens', async () => {
    const calls = installTables({
      client_projects: { data: projects, error: null },
      client_dashboard_access: {
        data: [{ client_project_id: 'project-1' }, { client_project_id: 'project-1' }],
        error: { message: 'dashboard lookup failed' },
      },
      proposals: {
        data: [
          { id: 'proposal-old', client_email: 'ada@example.com', status: 'accepted' },
          { id: 'proposal-new', client_email: 'ada@example.com', status: 'draft' },
          { id: 'proposal-blank', client_email: '', status: 'sent' },
        ],
        error: null,
      },
    })
    const response = await GET(new NextRequest('http://localhost/api/admin/client-experience/projects'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      projects: [
        {
          ...projects[0],
          has_proposal: true,
          proposal_status: 'draft',
          has_dashboard_token: true,
        },
        {
          ...projects[1],
          has_proposal: true,
          proposal_status: 'draft',
          has_dashboard_token: false,
        },
        {
          ...projects[2],
          has_proposal: true,
          proposal_status: 'sent',
          has_dashboard_token: false,
        },
      ],
    })
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'client_projects',
        method: 'order',
        args: ['created_at', { ascending: false }],
      }),
      expect.objectContaining({
        table: 'client_dashboard_access',
        method: 'eq',
        args: ['is_active', true],
      }),
      expect.objectContaining({
        table: 'proposals',
        method: 'in',
        args: ['client_email', ['ada@example.com', '']],
      }),
    ]))
  })

  it('returns an empty list before related lookups when there are no projects', async () => {
    installTables({
      client_projects: { data: null, error: null },
      client_dashboard_access: { data: [], error: null },
      proposals: { data: [], error: null },
    })
    const response = await GET(new NextRequest('http://localhost/api/admin/client-experience/projects'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ projects: [] })
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.from).toHaveBeenCalledWith('client_projects')
  })

  it('returns the project query message and a generic message for unexpected failures', async () => {
    installTables({
      client_projects: { data: null, error: { message: 'relation client_projects is missing' } },
      client_dashboard_access: { data: [], error: null },
      proposals: { data: [], error: null },
    })
    const failed = await GET(new NextRequest('http://localhost/api/admin/client-experience/projects'))
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'relation client_projects is missing' })
    expect(mocks.from).toHaveBeenCalledTimes(1)

    mocks.from.mockImplementation(() => { throw new Error('private stack') })
    const thrown = await GET(new NextRequest('http://localhost/api/admin/client-experience/projects'))
    expect(thrown.status).toBe(500)
    expect(await thrown.json()).toEqual({ error: 'Something went wrong.' })
  })
})
