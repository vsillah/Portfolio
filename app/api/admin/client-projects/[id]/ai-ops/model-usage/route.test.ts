import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  buildModelUsageSnapshot: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/model-usage', () => ({
  buildModelUsageSnapshot: mocks.buildModelUsageSnapshot,
}))

import { GET } from './route'

function request(url = 'http://localhost/api/admin/client-projects/client-1/ai-ops/model-usage?from=2026-06-01&to=2026-06-30') {
  return new Request(url, { headers: { authorization: 'Bearer token' } })
}

describe('GET /api/admin/client-projects/[id]/ai-ops/model-usage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.buildModelUsageSnapshot.mockResolvedValue({
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
      events: [{ id: 'private-event', actionLabel: 'Private action' }],
      clientSafeEvents: [{ id: 'safe-event', actionLabel: 'Research transaction', scrubbed: true }],
    })
  })

  it('returns a scrubbed client-scoped projection', async () => {
    const response = await GET(request() as never, { params: Promise.resolve({ id: 'client-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.clientProjectId).toBe('client-1')
    expect(body.events).toEqual([{ id: 'safe-event', actionLabel: 'Research transaction', scrubbed: true }])
    expect(mocks.buildModelUsageSnapshot).toHaveBeenCalledWith({
      from: '2026-06-01',
      to: '2026-06-30',
      clientProjectId: 'client-1',
    })
  })
})
