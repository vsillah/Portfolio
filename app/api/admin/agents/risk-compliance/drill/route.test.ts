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
  return new Request('http://localhost/api/admin/agents/risk-compliance/drill', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/admin/agents/risk-compliance/drill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.createAgentWorkItem.mockResolvedValue({
      id: 'work-moremi-drill',
      title: 'Review AI risk signal: Synthetic Moremi drill: prompt injection risk in browser automation',
      status: 'proposed',
      owner_agent_key: 'risk-compliance-intelligence',
      owner_runtime: 'manual',
      active_run_id: 'run-moremi-drill',
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(new Request('http://localhost/api/admin/agents/risk-compliance/drill') as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })

  it('previews the synthetic drill without creating work items', async () => {
    const response = await GET(new Request('http://localhost/api/admin/agents/risk-compliance/drill') as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      signal: {
        id: 'moremi-operational-drill-prompt-injection-browser-automation',
        sourceName: 'Synthetic Agent Ops drill',
      },
      assessment: {
        classification: 'approval_required',
        ownerAgentKey: 'risk-compliance-intelligence',
      },
      work_item_request: {
        status: 'proposed',
        ownerAgentKey: 'risk-compliance-intelligence',
        ownerRuntime: 'manual',
        overlapGroup: 'ai-risk-compliance',
        idempotencyKey: 'ai-risk-drill:moremi-operational-drill:v1',
        metadata: expect.objectContaining({
          synthetic_drill: true,
          non_production_data: true,
          production_mutation_allowed: false,
          slack_verification_command: '/agent work',
        }),
      },
      side_effects: {
        work_items_created: false,
        production_mutation_allowed: false,
      },
    })
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
  })

  it('requires explicit confirmation before creating the synthetic work item', async () => {
    const response = await POST(request() as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'confirmation must be run_moremi_operational_drill to create the synthetic drill work item',
    })
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
  })

  it('creates an idempotent proposed work item for the operational drill', async () => {
    const response = await POST(request({ confirmation: 'run_moremi_operational_drill' }) as never)

    expect(response.status).toBe(200)
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Review AI risk signal: Synthetic Moremi drill: prompt injection risk in browser automation',
      status: 'proposed',
      ownerAgentKey: 'risk-compliance-intelligence',
      ownerRuntime: 'manual',
      overlapGroup: 'ai-risk-compliance',
      idempotencyKey: 'ai-risk-drill:moremi-operational-drill:v1',
      metadata: expect.objectContaining({
        synthetic_drill: true,
        approval_required_before_remediation: true,
      }),
    }))
    expect(await response.json()).toMatchObject({
      ok: true,
      work_item: {
        id: 'work-moremi-drill',
        status: 'proposed',
      },
      verification: {
        admin_path: '/admin/agents/coordination',
        slack_command: '/agent work',
        expected_status: 'proposed',
      },
      side_effects: {
        work_items_created: true,
        work_item_count: 1,
        production_mutation_allowed: false,
      },
    })
  })
})
