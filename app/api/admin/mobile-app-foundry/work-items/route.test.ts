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

const backlogRecord = {
  id: 'speech-practice-coach',
  title: 'Speech Practice Coach',
  audience: 'People preparing for public speaking moments',
  job_to_be_done: 'Practice a speech, get structured feedback, and track improvement.',
  trend_sources: ['App Store public speaking category'],
  competitors: ['Orai'],
  popularity_score: 88,
  score_breakdown: {
    demand_signal: 25,
    monetization_path: 13,
    builder_fit: 20,
    build_velocity: 10,
    differentiation: 10,
    release_readiness: 10,
  },
  vambah_fit_summary: 'AI workbench utility with a coaching and access lens.',
  prototype_scope: ['speech prompt intake', 'practice scoring'],
  commercialization_path: ['paid coaching companion'],
  risks: ['Avoid employment-outcome claims.'],
  human_gate: 'review_required',
}

function request(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/admin/mobile-app-foundry/work-items', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/admin/mobile-app-foundry/work-items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.createAgentWorkItem.mockResolvedValue({
      id: 'work-item-1',
      title: 'Prototype mobile app opportunity: Speech Practice Coach',
      status: 'proposed',
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ backlog_record: backlogRecord }) as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })

  it('previews the Agent Ops work item request without creating it', async () => {
    const response = await POST(request({ backlog_record: backlogRecord }) as never)

    expect(response.status).toBe(200)
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
    expect(await response.json()).toMatchObject({
      ok: true,
      mode: 'preview',
      work_item_request: {
        status: 'proposed',
        ownerAgentKey: 'engineering-copilot',
        ownerRuntime: 'manual',
        idempotencyKey: 'mobile-foundry:speech-practice-coach:prototype-work-item:v1',
      },
      work_items: [],
      side_effects: {
        work_items_created: false,
        work_item_count: 0,
        repositories_created: false,
        github_accounts_created: false,
        outbound_messages_sent: false,
        app_store_submissions: false,
        pricing_changed: false,
      },
    })
  })

  it('requires confirmation before creating a proposed work item', async () => {
    const response = await POST(request({
      action: 'create_work_item',
      backlog_record: backlogRecord,
    }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'confirmation must be create_mobile_foundry_work_items to create Mobile App Foundry work items',
    })
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
  })

  it('creates a proposed work item when explicitly confirmed', async () => {
    const response = await POST(request({
      action: 'create_work_item',
      confirmation: 'create_mobile_foundry_work_items',
      source_run_id: 'run-123',
      backlog_record: backlogRecord,
    }) as never)

    expect(response.status).toBe(200)
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Prototype mobile app opportunity: Speech Practice Coach',
      priority: 'high',
      status: 'proposed',
      ownerAgentKey: 'engineering-copilot',
      ownerRuntime: 'manual',
      sourceRunId: 'run-123',
      overlapGroup: 'mobile-app-foundry',
      metadata: expect.objectContaining({
        foundry_agent_role: 'Imhotep (Kemet) - Prototype Architect',
        human_gate: 'review_required',
      }),
    }))
    expect(await response.json()).toMatchObject({
      ok: true,
      mode: 'confirmed_create',
      work_items: [{ id: 'work-item-1', status: 'proposed' }],
      side_effects: {
        work_items_created: true,
        work_item_count: 1,
        repositories_created: false,
        github_accounts_created: false,
        outbound_messages_sent: false,
        app_store_submissions: false,
        pricing_changed: false,
      },
    })
  })

  it('rejects incomplete backlog records', async () => {
    const response = await POST(request({ backlog_record: { id: 'missing-fields' } }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'backlog_record with id, title, audience, job_to_be_done, and vambah_fit_summary is required',
    })
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
  })
})
