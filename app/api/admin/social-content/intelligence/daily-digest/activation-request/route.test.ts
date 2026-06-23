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

import { POST } from './route'

function request(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/admin/social-content/intelligence/daily-digest/activation-request', {
    method: 'POST',
    headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/admin/social-content/intelligence/daily-digest/activation-request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user', email: 'admin@example.com' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.createAgentWorkItem.mockResolvedValue({
      id: 'work-digest-activation',
      title: 'Approve daily Social Content Intelligence digest activation',
      status: 'queued',
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
  })

  it('rejects unsupported cadence before creating a work item', async () => {
    const response = await POST(request({ cadence: 'hourly' }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Only daily cadence is supported for this activation request',
    })
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
  })

  it('creates an approval-gated Agentic Dashboard work item without activating the schedule', async () => {
    const response = await POST(request({
      cadence: 'daily',
      lookback_days: 7,
      scope_note: 'Start with public YouTube and internal Shaka triggers.',
    }) as never)

    expect(response.status).toBe(200)
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Approve daily Social Content Intelligence digest activation',
      priority: 'high',
      status: 'queued',
      ownerAgentKey: 'chief-of-staff',
      ownerRuntime: 'codex',
      source: {
        type: 'social_intelligence_daily_digest_activation',
        id: 'daily-social-content-intelligence',
        label: 'Content Intelligence daily digest activation review',
      },
      metadata: expect.objectContaining({
        requested_by_user_id: 'admin-user',
        requested_by_email: 'admin@example.com',
        cadence: 'daily',
        lookback_days: 7,
        scope_note: 'Start with public YouTube and internal Shaka triggers.',
        activation_boundary: expect.objectContaining({
          schedule_activation: 'approval_required',
          apify_collection: 'approval_required',
          publishing: 'approval_required',
        }),
        side_effects: {
          cron_activated: false,
          apify_run: false,
          provider_generation: false,
          upload: false,
          schedule: false,
          publish: false,
          external_post: false,
        },
      }),
      idempotencyKey: 'social-intelligence-daily-digest-activation:daily:7',
    }))
    expect(await response.json()).toMatchObject({
      ok: true,
      work_item: { id: 'work-digest-activation' },
      activation_requested: true,
      activation_executed: false,
      side_effects: {
        cron_activated: false,
        apify_run: false,
        provider_generation: false,
        upload: false,
        schedule: false,
        publish: false,
        external_post: false,
      },
    })
  })
})
