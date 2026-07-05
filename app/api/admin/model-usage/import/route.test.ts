import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  fromMock: vi.fn(),
  insertMock: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.fromMock,
  },
}))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/admin/model-usage/import', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const packet = {
  events: [{
    occurredAt: '2026-06-06T12:00:00.000Z',
    provider: 'codex',
    runtime: 'codex',
    model: 'gpt-5-codex',
    taskCategory: 'coding',
    inputTokens: 1000,
    outputTokens: 200,
    sourceTrace: { type: 'codex_session_import', id: 'session-1' },
  }],
  subscriptionAllocations: [{
    provider: 'codex',
    runtime: 'any',
    accountLabel: 'Codex subscription',
    monthlyCostUsd: 20,
    periodStart: '2026-06-01T00:00:00.000Z',
    periodEnd: '2026-06-30T23:59:59.999Z',
  }],
}

describe('POST /api/admin/model-usage/import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.fromMock.mockReturnValue({ insert: mocks.insertMock })
    mocks.insertMock.mockResolvedValue({ error: null })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request(packet) as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.fromMock).not.toHaveBeenCalled()
  })

  it('dry-runs import packets without database writes', async () => {
    const response = await POST(request({ ...packet, dryRun: true }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      dryRun: true,
      eventCount: 1,
      subscriptionAllocationCount: 1,
    })
    expect(mocks.fromMock).not.toHaveBeenCalled()
  })

  it('inserts reviewed event and allocation rows', async () => {
    const response = await POST(request(packet) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      dryRun: false,
      insertedEvents: 1,
      insertedSubscriptionAllocations: 1,
    })
    expect(mocks.fromMock).toHaveBeenCalledWith('model_usage_events')
    expect(mocks.fromMock).toHaveBeenCalledWith('model_usage_subscription_allocations')
    expect(mocks.insertMock).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({
        provider: 'codex',
        model: 'gpt-5-codex',
        total_tokens: 1200,
        scrubbed: true,
      }),
    ])
  })

  it('dry-runs source-specific packets without provider side effects', async () => {
    const response = await POST(request({
      dryRun: true,
      sourcePackets: [{
        kind: 'gemini_usage_export',
        sourceId: 'gemini-row-1',
        model: 'gemini-2.5-flash',
        taskCategory: 'research',
        inputTokens: 1000,
        outputTokens: 200,
        costUsd: 0.01,
      }],
    }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      dryRun: true,
      eventCount: 1,
      subscriptionAllocationCount: 0,
    })
    expect(mocks.fromMock).not.toHaveBeenCalled()
  })

  it('inserts source-specific packets when reviewed without events arrays', async () => {
    const response = await POST(request({
      sourcePackets: [{
        kind: 'openai_usage_export',
        sourceId: 'openai-row-1',
        taskCategory: 'automation',
        inputTokens: 1_000_000,
        outputTokens: 100_000,
      }],
    }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      dryRun: false,
      insertedEvents: 1,
      insertedSubscriptionAllocations: 0,
      warnings: [],
    })
    expect(mocks.fromMock).toHaveBeenCalledTimes(1)
    expect(mocks.fromMock).toHaveBeenCalledWith('model_usage_events')
    expect(mocks.insertMock).toHaveBeenCalledTimes(1)
    expect(mocks.insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        provider: 'openai',
        runtime: 'api',
        model: 'gpt-4o-mini',
        task_category: 'automation',
        source_type: 'openai_usage_export',
        source_id: 'openai-row-1',
        cost_basis: 'metered',
        scrubbed: true,
      }),
    ])
  })

  it('rejects packets that include raw prompt-like metadata', async () => {
    const response = await POST(request({
      events: [{
        provider: 'codex',
        model: 'gpt-5-codex',
        sourceMetadata: { transcript: 'private meeting text' },
      }],
    }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining('not allowed'),
    })
    expect(mocks.fromMock).not.toHaveBeenCalled()
  })
})
