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

  it('requires a target agent for ask_agent', async () => {
    const response = await POST(request({ command: 'ask_agent', message: 'Status?' }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'target_agent_key is required for ask_agent' })
    expect(mocks.runAgentWarRoom).not.toHaveBeenCalled()
  })

  it('requires a goal for draft_goal', async () => {
    const response = await POST(request({ command: 'draft_goal', goal: ' ' }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Goal is required for draft_goal' })
    expect(mocks.runAgentWarRoom).not.toHaveBeenCalled()
  })

  it('requires a draft payload for approve_goal', async () => {
    const response = await POST(request({ command: 'approve_goal' }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'draft is required for approve_goal' })
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

  it('passes ask_agent payloads to the war room', async () => {
    mocks.runAgentWarRoom.mockResolvedValue({
      runId: 'ask-run',
      command: 'ask_agent',
      synthesis: 'Agent responded.',
      updates: [],
      messages: [],
    })

    const response = await POST(request({ command: 'ask_agent', message: 'What is blocked?', target_agent_key: 'chief-of-staff' }) as never)

    expect(response.status).toBe(200)
    expect(mocks.runAgentWarRoom).toHaveBeenCalledWith(expect.objectContaining({
      command: 'ask_agent',
      message: 'What is blocked?',
      targetAgentKey: 'chief-of-staff',
    }))
  })

  it('passes draft_goal without creating work items in the route layer', async () => {
    mocks.runAgentWarRoom.mockResolvedValue({
      runId: 'goal-run',
      command: 'draft_goal',
      synthesis: 'Goal draft ready.',
      updates: [],
      messages: [],
      goalDraft: { goal_id: 'goal-1', title: 'Ship standup room', objective: 'Ship', recommendation: 'Approve', risk_notes: 'Low', tasks: [] },
    })

    const response = await POST(request({ command: 'draft_goal', goal: 'Ship standup room' }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.goal_draft.goal_id).toBe('goal-1')
    expect(mocks.runAgentWarRoom).toHaveBeenCalledWith(expect.objectContaining({
      command: 'draft_goal',
      goal: 'Ship standup room',
    }))
  })
})
