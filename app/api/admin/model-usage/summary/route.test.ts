import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  buildModelUsageSnapshot: vi.fn(),
  clientSafeModelUsageSnapshot: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/model-usage', () => ({
  buildModelUsageSnapshot: mocks.buildModelUsageSnapshot,
  clientSafeModelUsageSnapshot: mocks.clientSafeModelUsageSnapshot,
}))

import { GET } from './route'

function request(url = 'http://localhost/api/admin/model-usage/summary?from=2026-06-01&to=2026-06-30&clientProjectId=client-1') {
  return new Request(url, { headers: { authorization: 'Bearer token' } })
}

describe('GET /api/admin/model-usage/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    const snapshot = {
      generatedAt: '2026-06-06T12:00:00.000Z',
      window: { from: '2026-06-01T00:00:00.000Z', to: '2026-06-30T23:59:59.999Z' },
      totals: { eventCount: 1, totalTokens: 1000, inputTokens: 800, outputTokens: 200, costUsd: 0.1 },
      byProvider: [],
      byModel: [],
      byRuntime: [],
      byTaskCategory: [],
      byClientProject: [],
      heatmap: [],
      trend: [],
      topDays: [],
      topTransactions: [],
      recommendations: [],
      events: [{ id: 'private-event', actionLabel: 'Private work' }],
      clientSafeEvents: [{ id: 'safe-event', actionLabel: 'Research transaction' }],
    }
    mocks.buildModelUsageSnapshot.mockResolvedValue(snapshot)
    mocks.clientSafeModelUsageSnapshot.mockImplementation((value) => ({
      ...value,
      events: value.clientSafeEvents,
      topTransactions: value.clientSafeEvents,
    }))
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.buildModelUsageSnapshot).not.toHaveBeenCalled()
  })

  it('passes filters to the model usage snapshot builder', async () => {
    const response = await GET(request() as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.totals.totalTokens).toBe(1000)
    expect(mocks.buildModelUsageSnapshot).toHaveBeenCalledWith({
      from: '2026-06-01',
      to: '2026-06-30',
      clientProjectId: 'client-1',
    })
  })

  it('returns scrubbed event projection when clientSafe is requested', async () => {
    const response = await GET(request('http://localhost/api/admin/model-usage/summary?clientSafe=true') as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.clientSafe).toBe(true)
    expect(body.events).toEqual([{ id: 'safe-event', actionLabel: 'Research transaction' }])
    expect(mocks.clientSafeModelUsageSnapshot).toHaveBeenCalled()
  })

  it('returns a server error when the read model fails', async () => {
    mocks.buildModelUsageSnapshot.mockRejectedValue(new Error('Database not available'))

    const response = await GET(request() as never)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Database not available' })
  })
})
