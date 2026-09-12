import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getSiteSetting: vi.fn(),
}))

vi.mock('@/lib/site-settings', () => ({
  getSiteSetting: mocks.getSiteSetting,
}))

import { GET } from './route'

function request() {
  return new NextRequest('http://localhost/api/site-settings/ignored')
}

describe('GET /api/site-settings/[key]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 for keys outside the public allowlist without reading the database', async () => {
    const response = await GET(request(), { params: Promise.resolve({ key: 'installment_fee_percent' }) })
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Setting not found' })
    expect(mocks.getSiteSetting).not.toHaveBeenCalled()
  })

  it('returns 404 when the allowlisted setting is not configured', async () => {
    mocks.getSiteSetting.mockResolvedValueOnce(null)

    const response = await GET(request(), { params: Promise.resolve({ key: 'business_owner_email' }) })
    expect(response.status).toBe(404)
    expect(mocks.getSiteSetting).toHaveBeenCalledWith('business_owner_email')
  })

  it('returns the public business owner email when present', async () => {
    mocks.getSiteSetting.mockResolvedValueOnce('ops@example.com')

    const response = await GET(request(), { params: Promise.resolve({ key: 'business_owner_email' }) })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      key: 'business_owner_email',
      value: 'ops@example.com',
    })
  })
})
