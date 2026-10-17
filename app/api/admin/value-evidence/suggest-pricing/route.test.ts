import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  getSuggestedPricing: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/value-report-generator', () => ({
  getSuggestedPricing: mocks.getSuggestedPricing,
}))

import { POST } from './route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/value-evidence/suggest-pricing', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/admin/value-evidence/suggest-pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication before pricing lookup', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ content_type: 'service', content_id: 'svc-1' }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.getSuggestedPricing).not.toHaveBeenCalled()
  })

  it('requires a truthy content type and content id', async () => {
    for (const body of [
      {},
      { content_type: 'service' },
      { content_id: 'svc-1' },
      { content_type: '', content_id: 'svc-1' },
      { content_type: 'service', content_id: 0 },
    ]) {
      const response = await POST(request(body))
      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: 'content_type and content_id are required',
      })
    }
    expect(mocks.getSuggestedPricing).not.toHaveBeenCalled()
  })

  it('returns 422 when the content has no mapped pain points', async () => {
    mocks.getSuggestedPricing.mockResolvedValue(null)

    const response = await POST(request({
      content_type: ' service ',
      content_id: 'svc-1',
      industry: 'retail',
      company_size: '11-50',
      contact_submission_id: 9,
    }))

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      error: 'No pricing suggestions available',
      detail: 'This content has no pain points mapped. Map pain points in the Value Evidence admin page first.',
    })
    expect(mocks.getSuggestedPricing).toHaveBeenCalledWith({
      contentType: ' service ',
      contentId: 'svc-1',
      industry: 'retail',
      companySize: '11-50',
      contactSubmissionId: 9,
    })
  })

  it('returns the pricing suggestion', async () => {
    const pricing = { retail_price: 2500, perceived_value: 8000 }
    mocks.getSuggestedPricing.mockResolvedValue(pricing)

    const response = await POST(request({ content_type: 'product', content_id: 'prod-1' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ pricing })
  })

  it('exposes the thrown message and drops a non-Error throw', async () => {
    mocks.getSuggestedPricing.mockRejectedValueOnce(new Error('benchmark missing'))
    const failed = await POST(request({ content_type: 'product', content_id: 'prod-1' }))
    expect(failed.status).toBe(500)
    await expect(failed.json()).resolves.toEqual({
      error: 'Failed to generate pricing suggestion',
      details: 'benchmark missing',
    })

    mocks.getSuggestedPricing.mockRejectedValueOnce('nope')
    const stringThrow = await POST(request({ content_type: 'product', content_id: 'prod-1' }))
    expect(stringThrow.status).toBe(500)
    await expect(stringThrow.json()).resolves.toEqual({
      error: 'Failed to generate pricing suggestion',
    })
  })
})
