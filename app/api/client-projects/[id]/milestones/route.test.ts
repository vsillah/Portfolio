import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  triggerProgressUpdate: vi.fn(),
  getUpsellPathsForOffer: vi.fn(),
  scheduleUpsellFollowUp: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/progress-update-templates', () => ({
  triggerProgressUpdate: mocks.triggerProgressUpdate,
}))

vi.mock('@/lib/upsell-paths', () => ({
  getUpsellPathsForOffer: mocks.getUpsellPathsForOffer,
  scheduleUpsellFollowUp: mocks.scheduleUpsellFollowUp,
}))

import { DELETE, PATCH, POST } from './route'

const PROJECT_ID = 'proj-1'
const PLAN_ID = 'plan-1'

function request(method: string, body?: unknown, headers?: Record<string, string>) {
  return new NextRequest(`http://localhost/api/client-projects/${PROJECT_ID}/milestones`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

function params(id = PROJECT_ID) {
  return { params: Promise.resolve({ id }) }
}

function chain(result: { data?: unknown; error?: unknown } = {}) {
  const query: Record<string, unknown> = {}
  const self = () => query
  query.select = vi.fn(self)
  query.update = vi.fn(self)
  query.eq = vi.fn(self)
  query.in = vi.fn(self)
  query.single = vi.fn(async () => ({
    data: result.data ?? null,
    error: result.error ?? null,
  }))
  query.then = (
    onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) =>
    Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(
      onFulfilled,
      onRejected,
    )
  return query
}

describe('/api/client-projects/[id]/milestones', () => {
  const milestones = [
    {
      id: 'm-0',
      week: 1,
      title: 'Kickoff',
      description: '',
      deliverables: [],
      phase: 1,
      status: 'pending',
    },
    {
      id: 'm-1',
      week: 2,
      title: 'Build',
      description: '',
      deliverables: [],
      phase: 2,
      status: 'pending',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.triggerProgressUpdate.mockResolvedValue({
      logId: 'log-1',
      channel: 'email',
      updateType: 'milestone_complete',
    })
    mocks.from.mockImplementation(() =>
      chain({ data: { id: PLAN_ID, milestones: structuredClone(milestones) } }),
    )
  })

  it('requires admin on PATCH unless the Slack command header is present', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const denied = await PATCH(request('PATCH', { milestone_index: 0, new_status: 'in_progress' }), params())
    expect(denied.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()

    mocks.from.mockImplementation(() =>
      chain({ data: { id: PLAN_ID, milestones: structuredClone(milestones) } }),
    )
    const slack = await PATCH(
      request(
        'PATCH',
        { milestone_index: 0, new_status: 'in_progress' },
        { 'x-trigger-source': 'slack_cmd' },
      ),
      params(),
    )
    expect(slack.status).toBe(200)
    expect(mocks.from).toHaveBeenCalled()
  })

  it('does not let the Slack header bypass admin on POST or DELETE', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const created = await POST(
      request(
        'POST',
        { title: 'Extra', week: 3, phase: 3 },
        { 'x-trigger-source': 'slack_cmd' },
      ),
      params(),
    )
    const removed = await DELETE(
      request('DELETE', { milestone_index: 0 }, { 'x-trigger-source': 'slack_cmd' }),
      params(),
    )

    expect(created.status).toBe(401)
    expect(removed.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects missing plans and out-of-range milestone indexes', async () => {
    mocks.from.mockImplementation(() => chain({ data: null, error: { message: 'missing' } }))

    const missing = await PATCH(request('PATCH', { milestone_index: 0, new_status: 'complete' }), params())
    expect(missing.status).toBe(404)
    await expect(missing.json()).resolves.toEqual({
      error: 'No onboarding plan found for this project',
    })

    mocks.from.mockImplementation(() =>
      chain({ data: { id: PLAN_ID, milestones: structuredClone(milestones) } }),
    )
    const required = await PATCH(request('PATCH', { milestone_index: '0', new_status: 'complete' }), params())
    expect(required.status).toBe(400)
    await expect(required.json()).resolves.toEqual({ error: 'milestone_index is required' })

    const range = await PATCH(request('PATCH', { milestone_index: 2, new_status: 'complete' }), params())
    expect(range.status).toBe(400)
    await expect(range.json()).resolves.toEqual({
      error: 'milestone_index out of range (0-1)',
    })
  })

  it('rejects invalid statuses and empty PATCH bodies', async () => {
    const invalid = await PATCH(request('PATCH', { milestone_index: 0, new_status: 'done' }), params())
    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toEqual({
      error: 'new_status must be one of: pending, in_progress, complete, skipped',
    })

    const empty = await PATCH(request('PATCH', { milestone_index: 0 }), params())
    expect(empty.status).toBe(400)
    await expect(empty.json()).resolves.toEqual({
      error: 'Provide new_status, milestone, or updates',
    })
    expect(mocks.triggerProgressUpdate).not.toHaveBeenCalled()
  })

  it('updates an in-progress milestone without firing completion side effects', async () => {
    const response = await PATCH(
      request('PATCH', { milestone_index: 1, new_status: 'in_progress' }),
      params(),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.old_status).toBe('pending')
    expect(body.new_status).toBe('in_progress')
    expect(body.milestone.status).toBe('in_progress')
    expect(body.progress_update).toBeNull()
    expect(body.upsell_follow_ups).toBeNull()
    expect(mocks.triggerProgressUpdate).not.toHaveBeenCalled()
    expect(mocks.getUpsellPathsForOffer).not.toHaveBeenCalled()
  })

  it('requires title, week, and phase when creating a milestone', async () => {
    const missingTitle = await POST(request('POST', { week: 3, phase: 3 }), params())
    expect(missingTitle.status).toBe(400)
    await expect(missingTitle.json()).resolves.toEqual({ error: 'title is required' })

    const missingWeek = await POST(request('POST', { title: 'Extra', phase: 3 }), params())
    expect(missingWeek.status).toBe(400)
    await expect(missingWeek.json()).resolves.toEqual({ error: 'week is required' })

    const missingPhase = await POST(request('POST', { title: 'Extra', week: 3 }), params())
    expect(missingPhase.status).toBe(400)
    await expect(missingPhase.json()).resolves.toEqual({ error: 'phase is required' })
  })

  it('inserts a sanitized milestone at the requested position', async () => {
    const response = await POST(
      request('POST', {
        position: 1,
        title: '  Midpoint  ',
        week: 2,
        phase: 2,
        deliverables: ['ship', 12, ''],
        status: 'bogus',
      }),
      params(),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.milestone_index).toBe(1)
    expect(body.milestones_total).toBe(3)
    expect(body.milestone).toMatchObject({
      title: 'Midpoint',
      week: 2,
      phase: 2,
      deliverables: ['ship'],
      status: 'pending',
    })
  })

  it('removes a milestone by index after admin auth', async () => {
    const response = await DELETE(request('DELETE', { milestone_index: 0 }), params())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.removed_milestone.id).toBe('m-0')
    expect(body.milestones_total).toBe(1)
  })
})
