import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  runChiefOfStaffChat: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/chief-of-staff-chat', () => {
  function normalizeChiefOfStaffHistory(history: Array<{ role: string; content: string }> | undefined) {
    return (history ?? [])
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({ role: message.role, content: message.content.trim() }))
      .filter((message) => message.content.length > 0)
  }

  return {
    normalizeChiefOfStaffHistory,
    normalizeChiefOfStaffContextRef: (value: unknown) => {
      if (!value || typeof value !== 'object') return null
      const record = value as Record<string, unknown>
      return (record.type === 'run' || record.type === 'work_item' || record.type === 'approval') && typeof record.id === 'string' && record.id.trim()
        ? { type: record.type, id: record.id.trim() }
        : null
    },
    runChiefOfStaffChat: mocks.runChiefOfStaffChat,
  }
})

import { POST } from './route'

function makeRequest(body: Record<string, unknown> = { message: 'What needs attention?' }) {
  return new Request('http://localhost/api/admin/agents/chief-of-staff/chat', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/chief-of-staff/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.runChiefOfStaffChat.mockResolvedValue({
      runId: 'chief-run-1',
      reply: 'The morning review is clean. Watch one pending approval.',
      suggestedActions: ['Open Agent Operations'],
      actionProposals: [
        {
          label: 'Approve outbound update',
          description: 'Create an approval checkpoint before sending a client update.',
          action: 'send_email',
          approvalType: 'send_email',
          requiresApproval: true,
          riskLevel: 'high',
        },
      ],
      agentEngagements: [
        {
          agentKey: 'research-source-register',
          agentName: 'Askia Muhammad (Songhai) - Research Source Register',
          label: 'Run research agent',
          rationale: 'Collect source-backed context for the next decision.',
          status: 'partial',
          executionMode: 'read_only',
        },
      ],
      model: 'gpt-4o-mini',
      budgetDecision: {
        status: 'allowed',
        estimatedCostUsd: 0.001,
        warningUsd: 0.25,
        limitUsd: 1,
        rule: { key: 'llm_codex_per_call' },
      },
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.runChiefOfStaffChat).not.toHaveBeenCalled()
  })

  it('rejects empty messages', async () => {
    const response = await POST(makeRequest({ message: '   ' }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Message is required' })
    expect(mocks.runChiefOfStaffChat).not.toHaveBeenCalled()
  })

  it('rejects invalid scoped context references', async () => {
    const response = await POST(makeRequest({
      message: 'What should I do here?',
      context_ref: { type: 'lane', id: 'integration-captain' },
    }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid context_ref' })
    expect(mocks.runChiefOfStaffChat).not.toHaveBeenCalled()
  })

  it('runs an observable Chief of Staff chat', async () => {
    const response = await POST(makeRequest({
      message: 'What needs attention?',
      history: [{ role: 'user', content: 'Earlier question' }],
    }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      run_id: 'chief-run-1',
      reply: 'The morning review is clean. Watch one pending approval.',
      suggested_actions: ['Open Agent Operations'],
      action_proposals: [
        {
          label: 'Approve outbound update',
          description: 'Create an approval checkpoint before sending a client update.',
          action: 'send_email',
          approvalType: 'send_email',
          requiresApproval: true,
          riskLevel: 'high',
        },
      ],
      agent_engagements: [
        {
          agentKey: 'research-source-register',
          agentName: 'Askia Muhammad (Songhai) - Research Source Register',
          label: 'Run research agent',
          rationale: 'Collect source-backed context for the next decision.',
          status: 'partial',
          executionMode: 'read_only',
        },
      ],
      model: 'gpt-4o-mini',
      budget_decision: {
        status: 'allowed',
        estimated_cost_usd: 0.001,
        warning_usd: 0.25,
        limit_usd: 1,
        rule_key: 'llm_codex_per_call',
      },
    })
    expect(mocks.runChiefOfStaffChat).toHaveBeenCalledWith(expect.objectContaining({
      message: 'What needs attention?',
      userId: 'admin-user',
      history: [{ role: 'user', content: 'Earlier question' }],
      contextRef: null,
    }))
  })

  it('passes scoped context references to Shaka', async () => {
    const response = await POST(makeRequest({
      message: 'Should I approve this?',
      context_ref: { type: 'approval', id: 'approval-1' },
    }) as never)

    expect(response.status).toBe(200)
    expect(mocks.runChiefOfStaffChat).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Should I approve this?',
      contextRef: { type: 'approval', id: 'approval-1' },
    }))
  })
})
