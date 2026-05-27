import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  sendAgentSlackNotification: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-slack-notifications', () => ({
  sendAgentSlackNotification: mocks.sendAgentSlackNotification,
}))

import { POST } from './route'

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/agents/slack-notifications', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/slack-notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user', email: 'admin@example.com' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.sendAgentSlackNotification.mockResolvedValue({
      ok: true,
      runId: 'run-1',
      sent: true,
      skipped: false,
      deduped: false,
      itemCount: 2,
      text: 'Sent packet',
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ kind: 'blockers' }) as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.sendAgentSlackNotification).not.toHaveBeenCalled()
  })

  it('rejects unknown notification kinds', async () => {
    const response = await POST(request({ kind: 'publish_everything' }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid Slack notification kind' })
  })

  it('requires a message for selected-agent question packets', async () => {
    const response = await POST(request({ kind: 'selected_agent_question' }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'message is required for selected_agent_question' })
  })

  it('sends a governed Slack mobile packet', async () => {
    const response = await POST(request({
      kind: 'selected_agent_question',
      message: 'What is blocked?',
      target_agent_keys: ['chief-of-staff'],
      goal_id: 'goal-1',
    }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ ok: true, runId: 'run-1', sent: true })
    expect(mocks.sendAgentSlackNotification).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'selected_agent_question',
      message: 'What is blocked?',
      targetAgentKeys: ['chief-of-staff'],
      goalId: 'goal-1',
      actorLabel: 'admin@example.com',
      triggerSource: 'admin_agent_slack_notification',
    }))
  })

  it('accepts stale-run mobile packets', async () => {
    const response = await POST(request({ kind: 'stale_runs' }) as never)

    expect(response.status).toBe(200)
    expect(mocks.sendAgentSlackNotification).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'stale_runs',
      actorLabel: 'admin@example.com',
      triggerSource: 'admin_agent_slack_notification',
    }))
  })
})
