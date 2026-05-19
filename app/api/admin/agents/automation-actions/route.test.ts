import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  listAutomationActionTracker: vi.fn(),
  updateAutomationActionState: vi.fn(),
  createAgentWorkItem: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/codex-automation-action-tracker', () => ({
  listAutomationActionTracker: mocks.listAutomationActionTracker,
  updateAutomationActionState: mocks.updateAutomationActionState,
}))

vi.mock('@/lib/agent-work-items', () => ({
  createAgentWorkItem: mocks.createAgentWorkItem,
}))

import { GET, PATCH, POST } from './route'

function request(method: 'GET' | 'PATCH' | 'POST', body?: unknown) {
  return new Request('http://localhost/api/admin/agents/automation-actions', {
    method,
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function action(overrides: Record<string, unknown> = {}) {
  return {
    id: 'automation-1:blocker_or_approval:abc123',
    automationId: 'automation-1',
    automationName: 'Daily regression coverage',
    statusColor: 'red',
    headline: 'Needs coverage',
    summary: 'The latest run found untested production changes.',
    kind: 'blocker_or_approval',
    text: 'Approval needed before the next deployment',
    priority: 'urgent',
    actionStatus: 'open',
    owner: null,
    note: null,
    linkedWorkItemId: null,
    firstSeenAt: '2026-05-19T09:00:00.000Z',
    lastSeenAt: '2026-05-19T10:00:00.000Z',
    occurrenceCount: 2,
    sourceFiles: ['/tmp/automation-1.json'],
    latestSourceFile: '/tmp/automation-1.json',
    codexThreadHint: 'Continue from the failed cron run.',
    ...overrides,
  }
}

describe('/api/admin/agents/automation-actions', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.listAutomationActionTracker.mockResolvedValue({
      available: true,
      actions: [action()],
      summary: { total: 1, open: 1 },
    })
    mocks.updateAutomationActionState.mockResolvedValue({ status: 'in_progress', linkedWorkItemId: 'work-1' })
    mocks.createAgentWorkItem.mockResolvedValue({ id: 'work-1', title: 'Daily regression coverage: Approval needed before the next deployment' })
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it.each([
    ['GET', () => GET(request('GET') as never)],
    ['PATCH', () => PATCH(request('PATCH', { action_id: 'action-1', status: 'done' }) as never)],
    ['POST', () => POST(request('POST', { action_id: 'action-1' }) as never)],
  ])('requires admin auth for %s', async (_method, callRoute) => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await callRoute()

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.listAutomationActionTracker).not.toHaveBeenCalled()
    expect(mocks.updateAutomationActionState).not.toHaveBeenCalled()
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
  })

  it('returns the tracker payload for admins', async () => {
    const response = await GET(request('GET') as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      available: true,
      actions: [action()],
      summary: { total: 1, open: 1 },
    })
  })

  it('validates patch payloads before updating tracker state', async () => {
    const missingAction = await PATCH(request('PATCH', { status: 'done' }) as never)
    expect(missingAction.status).toBe(400)
    expect(await missingAction.json()).toEqual({ error: 'action_id is required' })

    const invalidStatus = await PATCH(request('PATCH', { action_id: 'action-1', status: 'archived' }) as never)
    expect(invalidStatus.status).toBe(400)
    expect(await invalidStatus.json()).toEqual({ error: 'Invalid status' })
    expect(mocks.updateAutomationActionState).not.toHaveBeenCalled()
  })

  it('patches tracker state with supported status and optional owner fields', async () => {
    const response = await PATCH(request('PATCH', {
      action_id: ' action-1 ',
      status: 'blocked',
      owner: 'Agent Ops',
      note: null,
    }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      action_state: { status: 'in_progress', linkedWorkItemId: 'work-1' },
    })
    expect(mocks.updateAutomationActionState).toHaveBeenCalledWith('action-1', {
      status: 'blocked',
      owner: 'Agent Ops',
      note: null,
    })
  })

  it('returns 404 when promoting an action that is not in the tracker', async () => {
    mocks.listAutomationActionTracker.mockResolvedValue({ available: true, actions: [] })

    const response = await POST(request('POST', { action_id: 'missing-action' }) as never)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Automation action not found' })
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
    expect(mocks.updateAutomationActionState).not.toHaveBeenCalled()
  })

  it('promotes a tracker action into an idempotent Agent Ops work item', async () => {
    const response = await POST(request('POST', { action_id: ' automation-1:blocker_or_approval:abc123 ' }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      work_item: { id: 'work-1', title: 'Daily regression coverage: Approval needed before the next deployment' },
    })
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Daily regression coverage: Approval needed before the next deployment',
      objective: [
        'Approval needed before the next deployment',
        'Context: The latest run found untested production changes.',
        'Thread hint: Continue from the failed cron run.',
      ].join('\n'),
      priority: 'urgent',
      status: 'queued',
      ownerAgentKey: 'chief-of-staff',
      ownerRuntime: 'codex',
      source: {
        type: 'codex_automation_action',
        id: 'automation-1:blocker_or_approval:abc123',
        label: 'Daily regression coverage',
      },
      expectedFiles: ['/tmp/automation-1.json'],
      metadata: expect.objectContaining({
        automation_id: 'automation-1',
        automation_name: 'Daily regression coverage',
        action_kind: 'blocker_or_approval',
        occurrence_count: 2,
      }),
      idempotencyKey: 'automation-1:blocker_or_approval:abc123',
    }))
    expect(mocks.updateAutomationActionState).toHaveBeenCalledWith('automation-1:blocker_or_approval:abc123', {
      status: 'in_progress',
      linkedWorkItemId: 'work-1',
      note: 'Promoted into Agent Ops work item.',
    })
  })

  it('maps non-urgent action priorities to safe work-item priorities', async () => {
    mocks.listAutomationActionTracker.mockResolvedValue({
      available: true,
      actions: [action({
        id: 'automation-1:next_run_focus:def456',
        kind: 'next_run_focus',
        text: 'Refresh the follow-up notes',
        priority: 'low',
      })],
    })

    const response = await POST(request('POST', { action_id: 'automation-1:next_run_focus:def456' }) as never)

    expect(response.status).toBe(200)
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      priority: 'medium',
      idempotencyKey: 'automation-1:next_run_focus:def456',
    }))
  })

  it('logs promotion failures without exposing the thrown error message', async () => {
    mocks.createAgentWorkItem.mockRejectedValue(new Error('duplicate key violates agent_work_items_idempotency_key_idx'))

    const response = await POST(request('POST', { action_id: 'automation-1:blocker_or_approval:abc123' }) as never)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to promote automation action' })
    expect(mocks.updateAutomationActionState).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(
      '[automation-actions] promote action failed:',
      expect.any(Error),
    )
  })

  it('handles tracker linkage failures after the work item is created without leaking details', async () => {
    mocks.updateAutomationActionState.mockRejectedValue(new Error('tracker state file is locked'))

    const response = await POST(request('POST', { action_id: 'automation-1:blocker_or_approval:abc123' }) as never)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to promote automation action' })
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'automation-1:blocker_or_approval:abc123',
    }))
    expect(mocks.updateAutomationActionState).toHaveBeenCalledWith('automation-1:blocker_or_approval:abc123', {
      status: 'in_progress',
      linkedWorkItemId: 'work-1',
      note: 'Promoted into Agent Ops work item.',
    })
    expect(consoleError).toHaveBeenCalledWith(
      '[automation-actions] promote action failed:',
      expect.any(Error),
    )
  })
})
