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
      model: 'gpt-4o-mini',
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
      model: 'gpt-4o-mini',
    })
    expect(mocks.runChiefOfStaffChat).toHaveBeenCalledWith(expect.objectContaining({
      message: 'What needs attention?',
      userId: 'admin-user',
      history: [{ role: 'user', content: 'Earlier question' }],
    }))
  })
})
