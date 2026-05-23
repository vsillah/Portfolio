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

  it('requires a draft payload for approve_readiness', async () => {
    const response = await POST(request({ command: 'approve_readiness' }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'draft is required for approve_readiness' })
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

  it('passes selected standup participants to the war room', async () => {
    const response = await POST(request({
      command: 'standup',
      target_agent_keys: ['chief-of-staff', 'engineering-copilot'],
    }) as never)

    expect(response.status).toBe(200)
    expect(mocks.runAgentWarRoom).toHaveBeenCalledWith(expect.objectContaining({
      command: 'standup',
      targetAgentKeys: ['chief-of-staff', 'engineering-copilot'],
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

    const response = await POST(request({ command: 'ask_agent', message: 'What is blocked?', target_agent_key: 'chief-of-staff', goal_id: 'goal-1' }) as never)

    expect(response.status).toBe(200)
    expect(mocks.runAgentWarRoom).toHaveBeenCalledWith(expect.objectContaining({
      command: 'ask_agent',
      message: 'What is blocked?',
      targetAgentKey: 'chief-of-staff',
      goalId: 'goal-1',
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

  it('passes social outreach goal type to the war room executor', async () => {
    mocks.runAgentWarRoom.mockResolvedValue({
      runId: 'goal-run',
      command: 'draft_goal',
      synthesis: 'Goal draft ready.',
      updates: [],
      messages: [],
      goalDraft: {
        goal_id: 'goal-social',
        goal_type: 'social_outreach_linkedin_post',
        title: 'Create LinkedIn post',
        objective: 'Draft only',
        recommendation: 'Approve draft-only pilot.',
        risk_notes: 'No publishing.',
        publish_gate: 'draft_only',
        tasks: [],
      },
    })

    const response = await POST(request({
      command: 'draft_goal',
      goal: 'Create LinkedIn post',
      goal_type: 'social_outreach_linkedin_post',
    }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.goal_draft.goal_type).toBe('social_outreach_linkedin_post')
    expect(mocks.runAgentWarRoom).toHaveBeenCalledWith(expect.objectContaining({
      command: 'draft_goal',
      goal: 'Create LinkedIn post',
      goalType: 'social_outreach_linkedin_post',
    }))
  })

  it('passes approved goal drafts to the war room executor', async () => {
    const draft = {
      goal_id: 'goal-1',
      title: 'Ship standup room',
      objective: 'Ship the reviewed room',
      recommendation: 'Approve',
      risk_notes: 'Low',
      tasks: [{
        id: 'goal-1-task-1',
        title: 'Implement',
        objective: 'Build it',
        owner_agent_key: 'engineering-copilot',
        priority: 'high',
        dependencies: [],
        expected_files: ['app/admin/agents/standup/page.tsx'],
        acceptance_criteria: ['Works'],
        risk_notes: 'Low',
        goal_progress_weight: 1,
      }],
    }
    mocks.runAgentWarRoom.mockResolvedValue({
      runId: 'approval-run',
      command: 'approve_goal',
      synthesis: 'Goal approved and converted into traceable Agent Ops work items.',
      updates: [],
      messages: [],
      createdWorkItems: {
        parent: { id: 'parent', title: 'Goal: Ship standup room' },
        children: [{ id: 'child', title: 'Implement' }],
      },
    })

    const response = await POST(request({ command: 'approve_goal', draft }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.created_work_items.children).toHaveLength(1)
    expect(mocks.runAgentWarRoom).toHaveBeenCalledWith(expect.objectContaining({
      command: 'approve_goal',
      draft,
      goalId: '',
    }))
  })

  it('passes readiness approvals to the war room executor', async () => {
    const draft = {
      goal_id: 'goal-1',
      title: 'Ship standup room',
      objective: 'Ship the reviewed room',
      recommendation: 'Approve',
      risk_notes: 'Low',
      readiness_status: 'ready_for_delegation',
      readiness_checklist: [{ key: 'outcome_clear', label: 'Outcome is clear', status: 'ready', required: true }],
      acceptance_criteria: ['Works'],
      stage_gates: [{ key: 'ready_to_delegate', label: 'Ready to delegate', owner_agent_key: 'chief-of-staff', required_before: 'work_item_creation', status: 'pending', approval_required: true }],
      authority_boundary: { publish: 'manual_approval_required', send: 'manual_approval_required', deploy: 'manual_approval_required', merge: 'manual_approval_required', notes: 'Work items only.' },
      tasks: [],
    }
    mocks.runAgentWarRoom.mockResolvedValue({
      runId: 'approval-run',
      command: 'approve_readiness',
      synthesis: 'Goal readiness approved and delegated.',
      updates: [],
      messages: [],
      createdWorkItems: {
        parent: { id: 'parent', title: 'Goal: Ship standup room', metadata: {} },
        children: [],
      },
    })

    const response = await POST(request({ command: 'approve_readiness', draft }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.command).toBe('approve_readiness')
    expect(mocks.runAgentWarRoom).toHaveBeenCalledWith(expect.objectContaining({
      command: 'approve_readiness',
      draft,
      goalId: '',
    }))
  })
})
