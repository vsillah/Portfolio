import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  classifyMarketIntel: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/market-intel-classifier', () => ({
  classifyMarketIntel: mocks.classifyMarketIntel,
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/value-evidence/classify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/value-evidence/classify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.classifyMarketIntel.mockResolvedValue({ processed: 3, classified: 2 })
  })

  it('requires admin authentication before classifying', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)
    const request = makeRequest({ limit: 10 })
    const jsonSpy = vi.spyOn(request, 'json')

    const response = await POST(request)

    expect(response.status).toBe(401)
    expect(jsonSpy).not.toHaveBeenCalled()
    expect(mocks.classifyMarketIntel).not.toHaveBeenCalled()
  })

  it('defaults the batch size to 500 and caps it at 1000', async () => {
    const defaulted = await POST(makeRequest({}))
    expect(defaulted.status).toBe(200)
    expect(mocks.classifyMarketIntel).toHaveBeenCalledWith(500)

    const invalid = await POST(makeRequest({ limit: 'nope' }))
    expect(invalid.status).toBe(200)
    expect(mocks.classifyMarketIntel).toHaveBeenCalledWith(500)

    const capped = await POST(makeRequest({ limit: 5000 }))
    expect(capped.status).toBe(200)
    expect(mocks.classifyMarketIntel).toHaveBeenCalledWith(1000)
  })

  it('returns a generic classification failure without running a second batch', async () => {
    mocks.classifyMarketIntel.mockRejectedValue(new Error('keyword table missing'))

    const response = await POST(makeRequest({ limit: 10 }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Classification failed',
      details: 'keyword table missing',
    })
  })
})
