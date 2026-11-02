import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  getSubscriptionStatusRegistry: vi.fn(),
  answerSubscriptionBudgetQuery: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/subscription-status', () => ({
  getSubscriptionStatusRegistry: mocks.getSubscriptionStatusRegistry,
  answerSubscriptionBudgetQuery: mocks.answerSubscriptionBudgetQuery,
}))

import { GET } from './route'

function request(query = '') {
  return new NextRequest(`http://localhost/api/admin/subscriptions/status${query}`)
}

const registry = {
  generatedAt: '2026-09-01',
  summary: { headline: 'Watch spend' },
}

describe('GET /api/admin/subscriptions/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getSubscriptionStatusRegistry.mockReturnValue(registry)
    mocks.answerSubscriptionBudgetQuery.mockReturnValue({
      query: 'budget',
      answer: 'Over target',
    })
  })

  it('rejects non-admin callers', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request('?q=budget'))

    expect(response.status).toBe(401)
    expect(mocks.getSubscriptionStatusRegistry).not.toHaveBeenCalled()
    expect(mocks.answerSubscriptionBudgetQuery).not.toHaveBeenCalled()
  })

  it('returns the registry without a queryResult when q is omitted', async () => {
    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(registry)
    expect(mocks.answerSubscriptionBudgetQuery).not.toHaveBeenCalled()
  })

  it('ignores whitespace-only q and does not run a budget query', async () => {
    const response = await GET(request('?q=%20%20'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(registry)
    expect(mocks.answerSubscriptionBudgetQuery).not.toHaveBeenCalled()
  })

  it('attaches a trimmed queryResult when q is present', async () => {
    const response = await GET(request('?q=%20Are%20we%20over%20budget%20'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.answerSubscriptionBudgetQuery).toHaveBeenCalledWith('Are we over budget')
    expect(body).toEqual({
      ...registry,
      queryResult: { query: 'budget', answer: 'Over target' },
    })
  })
})
