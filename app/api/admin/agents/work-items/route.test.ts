import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  listAgentWorkItems: vi.fn(),
  createAgentWorkItem: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-work-items', () => ({
  AGENT_WORK_ITEM_PRIORITIES: ['low', 'medium', 'high', 'urgent'],
  AGENT_WORK_ITEM_STATUSES: [
    'proposed',
    'queued',
    'assigned',
    'in_progress',
    'blocked',
    'ready_for_review',
    'ready_for_merge',
    'merged',
    'deployed',
    'cancelled',
  ],
  listAgentWorkItems: mocks.listAgentWorkItems,
  createAgentWorkItem: mocks.createAgentWorkItem,
}))

vi.mock('@/lib/agent-run', () => ({
  AGENT_RUNTIMES: ['codex', 'n8n', 'hermes', 'opencode', 'manual'],
}))

import { GET, POST } from './route'

function request(url = 'http://localhost/api/admin/agents/work-items', body?: unknown) {
  return new Request(url, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('/api/admin/agents/work-items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.listAgentWorkItems.mockResolvedValue([{ id: 'work-1', title: 'Coordinate' }])
    mocks.createAgentWorkItem.mockResolvedValue({ id: 'work-1', title: 'Coordinate' })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.listAgentWorkItems).not.toHaveBeenCalled()
  })

  it('lists work items and validates status filters', async () => {
    const response = await GET(request('http://localhost/api/admin/agents/work-items?status=queued') as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ work_items: [{ id: 'work-1', title: 'Coordinate' }] })
    expect(mocks.listAgentWorkItems).toHaveBeenCalledWith(expect.objectContaining({ status: 'queued' }))

    const bad = await GET(request('http://localhost/api/admin/agents/work-items?status=bogus') as never)
    expect(bad.status).toBe(400)
  })

  it('passes source filters and supports social channel backlog filtering', async () => {
    mocks.listAgentWorkItems.mockResolvedValue([
      {
        id: 'work-social-1',
        source_type: 'social_topic_trigger',
        metadata: {
          social_topic_trigger: true,
          channel_lanes: {
            linkedin: { status: 'not_started' },
          },
        },
      },
      {
        id: 'work-other-1',
        source_type: 'agent_run',
        metadata: {},
      },
    ])

    const response = await GET(request('http://localhost/api/admin/agents/work-items?source_type=social_topic_trigger&social_channel=linkedin') as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      work_items: [
        {
          id: 'work-social-1',
          source_type: 'social_topic_trigger',
          metadata: {
            social_topic_trigger: true,
            channel_lanes: {
              linkedin: { status: 'not_started' },
            },
          },
        },
      ],
    })
    expect(mocks.listAgentWorkItems).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: 'social_topic_trigger',
    }))

    const bad = await GET(request('http://localhost/api/admin/agents/work-items?social_channel=threads') as never)
    expect(bad.status).toBe(400)
  })

  it('creates a work item with scoped fields', async () => {
    const response = await POST(request('http://localhost/api/admin/agents/work-items', {
      title: 'Coordinate feature',
      objective: 'Build shared assignment bus',
      owner_agent_key: 'chief-of-staff',
      owner_runtime: 'codex',
      expected_files: ['lib/agent-work-items.ts'],
    }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, work_item: { id: 'work-1' } })
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Coordinate feature',
      objective: 'Build shared assignment bus',
      ownerAgentKey: 'chief-of-staff',
      ownerRuntime: 'codex',
      expectedFiles: ['lib/agent-work-items.ts'],
    }))
  })

  it('rejects malformed create payloads', async () => {
    const missing = await POST(request('http://localhost/api/admin/agents/work-items', { title: 'Missing objective' }) as never)
    expect(missing.status).toBe(400)

    const badRuntime = await POST(request('http://localhost/api/admin/agents/work-items', {
      title: 'Bad runtime',
      objective: 'Bad runtime',
      owner_runtime: 'bogus',
    }) as never)
    expect(badRuntime.status).toBe(400)
  })
})
