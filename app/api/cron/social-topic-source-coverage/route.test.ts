import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  collectLiveSocialTopicCoverage: vi.fn(),
}))

vi.mock('@/lib/social-topic-source-coverage', () => ({
  collectLiveSocialTopicCoverage: mocks.collectLiveSocialTopicCoverage,
}))

import { GET } from './route'

const coverage = {
  generated_at: '2026-10-11T10:00:00.000Z',
  status: 'blocked',
  receipts: [{ receipt_id: 'receipt-1' }, { receipt_id: 'receipt-2' }],
  products: [{ product_identity: 'dark_castle_chess' }],
  blockers: ['No approved source receipts are available. Candidate creation remains blocked.'],
}

function cronRequest(authorization?: string) {
  return new NextRequest('http://localhost/api/cron/social-topic-source-coverage', {
    headers: authorization ? { authorization } : undefined,
  })
}

describe('GET /api/cron/social-topic-source-coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    mocks.collectLiveSocialTopicCoverage.mockResolvedValue(coverage)
  })

  it('rejects a refresh with no bearer secret', async () => {
    const response = await GET(cronRequest())

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.collectLiveSocialTopicCoverage).not.toHaveBeenCalled()
  })

  it('rejects a refresh when the cron secret is unset', async () => {
    delete process.env.CRON_SECRET

    const response = await GET(cronRequest('Bearer cron-secret'))

    expect(response.status).toBe(401)
    expect(mocks.collectLiveSocialTopicCoverage).not.toHaveBeenCalled()
  })

  it('rejects a bearer token that does not match the cron secret', async () => {
    const response = await GET(cronRequest('Bearer other-secret'))

    expect(response.status).toBe(401)
    expect(mocks.collectLiveSocialTopicCoverage).not.toHaveBeenCalled()
  })

  it('persists a review-only reconciliation for an authorized cron', async () => {
    const response = await GET(cronRequest('Bearer cron-secret'))

    expect(response.status).toBe(200)
    expect(mocks.collectLiveSocialTopicCoverage).toHaveBeenCalledWith({ persist: true })
    expect(await response.json()).toEqual({
      success: true,
      generated_at: coverage.generated_at,
      status: 'blocked',
      receipt_count: 2,
      product_count: 1,
      blockers: coverage.blockers,
      review_only: true,
    })
  })

  it('returns a closed message when reconciliation fails without an Error', async () => {
    mocks.collectLiveSocialTopicCoverage.mockRejectedValue('database unavailable')

    const response = await GET(cronRequest('Bearer cron-secret'))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Source coverage reconciliation failed' })
  })
})
