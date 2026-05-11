import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  runAgentWarRoom: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-war-room', () => ({
  runAgentWarRoom: mocks.runAgentWarRoom,
}))

import { POST } from './route'

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/agents/war-room', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/war-room', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.runAgentWarRoom.mockResolvedValue({
      runId: 'war-room-run',
      command: 'standup',
      synthesis: 'Standup complete.',
      updates: [
        {
          agent_key: 'chief-of-staff',
          agent_name: 'Shaka (Zulu) - Chief of Staff',
          pod: 'Chief of Staff',
          runtime: 'mixed',
          status: 'partial',
          update: 'Current posture: partial.',
          next_action: 'Ready for routing.',
          approval_gate: 'Read-only status by default.',
        },
      ],
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ command: 'standup' }) as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.runAgentWarRoom).not.toHaveBeenCalled()
  })

  it('rejects malformed commands', async () => {
    const response = await POST(request({ command: 'launch' }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid command' })
    expect(mocks.runAgentWarRoom).not.toHaveBeenCalled()
  })

  it('requires a message for discuss', async () => {
    const response = await POST(request({ command: 'discuss', message: ' ' }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Message is required for discuss' })
    expect(mocks.runAgentWarRoom).not.toHaveBeenCalled()
  })

  it('runs a traced standup', async () => {
    const response = await POST(request({ command: 'standup' }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      run_id: 'war-room-run',
      command: 'standup',
      synthesis: 'Standup complete.',
    })
    expect(mocks.runAgentWarRoom).toHaveBeenCalledWith(expect.objectContaining({
      command: 'standup',
      triggerSource: 'admin_agent_war_room',
      actor: expect.objectContaining({ id: 'admin-user' }),
    }))
  })
})
