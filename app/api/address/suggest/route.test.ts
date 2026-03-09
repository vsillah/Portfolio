import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const { uspsCityStateLookupMock, uspsZipCodeLookupMock } = vi.hoisted(() => ({
  uspsCityStateLookupMock: vi.fn(),
  uspsZipCodeLookupMock: vi.fn(),
}))

vi.mock('@/lib/usps', () => ({
  uspsCityStateLookup: uspsCityStateLookupMock,
  uspsZipCodeLookup: uspsZipCodeLookupMock,
}))

import { GET } from './route'

function makeRequest(url: string): NextRequest {
  return new Request(url, { method: 'GET' }) as NextRequest
}

describe('GET /api/address/suggest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.USPS_CLIENT_ID = 'test-client-id'
    process.env.USPS_CLIENT_SECRET = 'test-client-secret'
  })

  it('returns 503 when USPS credentials are missing', async () => {
    delete process.env.USPS_CLIENT_ID
    delete process.env.USPS_CLIENT_SECRET

    const response = await GET(makeRequest('http://localhost/api/address/suggest?zip=78701'))
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload).toEqual({ error: 'Address suggestions are not configured.' })
    expect(uspsCityStateLookupMock).not.toHaveBeenCalled()
    expect(uspsZipCodeLookupMock).not.toHaveBeenCalled()
  })

  it('returns city/state for ZIP query', async () => {
    uspsCityStateLookupMock.mockResolvedValueOnce({
      city: 'Austin',
      state: 'TX',
      ZIPCode: '78701',
    })

    const response = await GET(makeRequest('http://localhost/api/address/suggest?zip=78701-1234'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ city: 'Austin', state: 'TX', ZIPCode: '78701' })
    expect(uspsCityStateLookupMock).toHaveBeenCalledWith('78701')
  })

  it('returns zip info for city/state query and trims optional fields', async () => {
    uspsZipCodeLookupMock.mockResolvedValueOnce({
      address: {
        ZIPCode: '78701',
        ZIPPlus4: '1234',
        city: 'AUSTIN',
        state: 'TX',
      },
    })

    const response = await GET(
      makeRequest(
        'http://localhost/api/address/suggest?city=Austin&state=tx&streetAddress=123%20Main%20St&address2=%20Apt%202%20'
      )
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      zip: '78701',
      zip4: '1234',
      city: 'AUSTIN',
      state: 'TX',
    })
    expect(uspsZipCodeLookupMock).toHaveBeenCalledWith('Austin', 'TX', '123 Main St', 'Apt 2')
  })

  it('returns 400 when query params are missing required lookup keys', async () => {
    const response = await GET(makeRequest('http://localhost/api/address/suggest?state=TX'))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({
      error: 'Provide either zip=12345 or city=...&state=...',
    })
  })

  it('maps outage errors to 503 temporary message', async () => {
    uspsCityStateLookupMock.mockRejectedValueOnce(new Error('502 bad gateway'))

    const response = await GET(makeRequest('http://localhost/api/address/suggest?zip=78701'))
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload).toEqual({
      error: 'Address lookup is temporarily unavailable. Please try again in a moment.',
    })
  })
})
