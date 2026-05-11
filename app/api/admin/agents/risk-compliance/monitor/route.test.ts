import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

import { GET, POST } from './route'

function request(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/admin/agents/risk-compliance/monitor', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/admin/agents/risk-compliance/monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(new Request('http://localhost/api/admin/agents/risk-compliance/monitor') as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns the read-only monitor summary', async () => {
    const response = await GET(new Request('http://localhost/api/admin/agents/risk-compliance/monitor') as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      monitor: {
        ownerAgentKey: 'risk-compliance-intelligence',
        ownerAgentName: 'Moremi (Ife) - Risk & Compliance',
      },
    })
  })

  it('assesses supplied signals without creating work items', async () => {
    const response = await POST(request({
      signals: [
        {
          title: 'AI agent prompt injection vulnerability affects browser automation',
          summary: 'Security researchers report indirect prompt injection that can trigger unsafe tool calls.',
          sourceName: 'Security advisory',
        },
      ],
    }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      assessments: [
        {
          classification: 'approval_required',
          ownerAgentKey: 'risk-compliance-intelligence',
          upgradeRequest: expect.objectContaining({
            priority: 'urgent',
            metadata: expect.objectContaining({
              approval_required: true,
              exposure_surfaces: expect.arrayContaining(['agent-tool-use', 'runtime-security']),
            }),
          }),
        },
      ],
      side_effects: {
        work_items_created: false,
        production_mutation_allowed: false,
      },
    })
  })

  it('rejects malformed signal payloads', async () => {
    const response = await POST(request({ signals: [{ title: 'Missing summary' }] }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'signals array with title and summary is required' })
  })
})
