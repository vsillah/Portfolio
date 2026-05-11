import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  createAgentWorkItem: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-work-items', () => ({
  createAgentWorkItem: mocks.createAgentWorkItem,
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
    mocks.createAgentWorkItem.mockResolvedValue({
      id: 'work-item-1',
      title: 'Review AI risk signal: AI agent prompt injection vulnerability affects browser automation',
      status: 'proposed',
    })
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
      source_feeds: expect.arrayContaining([
        expect.objectContaining({ key: 'owasp-agent-security-initiative', enabled: true }),
        expect.objectContaining({ key: 'ftc-ai-guidance', enabled: true }),
      ]),
    })
  })

  it('filters source feeds by category and priority', async () => {
    const response = await GET(
      new Request('http://localhost/api/admin/agents/risk-compliance/monitor?category=prompt_injection&priority=standards') as never,
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.source_feeds.map((feed: { key: string }) => feed.key)).toEqual([
      'owasp-agent-security-initiative',
      'owasp-aivss',
    ])
  })

  it('rejects invalid source feed filters', async () => {
    const response = await GET(
      new Request('http://localhost/api/admin/agents/risk-compliance/monitor?category=unknown') as never,
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid category' })
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
      work_item_requests: [
        expect.objectContaining({
          status: 'proposed',
          ownerAgentKey: 'risk-compliance-intelligence',
          ownerRuntime: 'manual',
          overlapGroup: 'ai-risk-compliance',
          idempotencyKey: expect.stringMatching(/^ai-risk-signal:security-advisory-ai-agent-prompt-injection-vulnerability/),
        }),
      ],
      work_items: [],
      side_effects: {
        work_items_created: false,
        work_item_count: 0,
        production_mutation_allowed: false,
      },
    })
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
  })

  it('requires confirmation before creating work items', async () => {
    const response = await POST(request({
      create_work_items: true,
      signals: [
        {
          id: 'security-advisory-1',
          title: 'AI agent prompt injection vulnerability affects browser automation',
          summary: 'Security researchers report indirect prompt injection that can trigger unsafe tool calls.',
          sourceName: 'Security advisory',
        },
      ],
    }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'confirmation must be create_ai_risk_work_items to create work items',
    })
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
  })

  it('creates proposed work items when explicitly confirmed', async () => {
    const response = await POST(request({
      create_work_items: true,
      confirmation: 'create_ai_risk_work_items',
      signals: [
        {
          id: 'security-advisory-1',
          title: 'AI agent prompt injection vulnerability affects browser automation',
          summary: 'Security researchers report indirect prompt injection that can trigger unsafe tool calls.',
          sourceName: 'Security advisory',
        },
      ],
    }) as never)

    expect(response.status).toBe(200)
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Review AI risk signal: AI agent prompt injection vulnerability affects browser automation',
      status: 'proposed',
      ownerAgentKey: 'risk-compliance-intelligence',
      ownerRuntime: 'manual',
      overlapGroup: 'ai-risk-compliance',
      idempotencyKey: 'ai-risk-signal:security-advisory-1:approval_required',
      metadata: expect.objectContaining({
        conversion_requires_review: true,
        exposure_surfaces: expect.arrayContaining(['agent-tool-use', 'runtime-security']),
      }),
    }))
    expect(await response.json()).toMatchObject({
      ok: true,
      work_items: [
        {
          id: 'work-item-1',
          status: 'proposed',
        },
      ],
      side_effects: {
        work_items_created: true,
        work_item_count: 1,
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
