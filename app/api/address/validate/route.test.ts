import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const { uspsStandardizeAddressMock } = vi.hoisted(() => ({
  uspsStandardizeAddressMock: vi.fn(),
}))

vi.mock('@/lib/usps', () => ({
  uspsStandardizeAddress: uspsStandardizeAddressMock,
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new Request('http://localhost/api/address/validate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as NextRequest
}

describe('POST /api/address/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.USPS_CLIENT_ID = 'test-client-id'
    process.env.USPS_CLIENT_SECRET = 'test-client-secret'
  })

  it('returns 503 when USPS credentials are missing', async () => {
    delete process.env.USPS_CLIENT_ID
    delete process.env.USPS_CLIENT_SECRET

    const response = await POST(
      makeRequest({
        address1: '123 Main St',
        city: 'Austin',
        state_code: 'TX',
        zip: '78701',
        country_code: 'US',
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload).toEqual({
      valid: false,
      message: 'Address validation is not configured.',
    })
    expect(uspsStandardizeAddressMock).not.toHaveBeenCalled()
  })

  it('returns validation error when required street/state are missing', async () => {
    const response = await POST(
      makeRequest({
        address1: '',
        city: 'Austin',
        state_code: '',
        zip: '',
        country_code: 'US',
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      valid: false,
      message: 'Street address and state are required.',
    })
    expect(uspsStandardizeAddressMock).not.toHaveBeenCalled()
  })

  it('returns "invalid" response when USPS cannot validate address', async () => {
    uspsStandardizeAddressMock.mockResolvedValueOnce(null)

    const response = await POST(
      makeRequest({
        address1: '123 Main St',
        city: 'Austin',
        state_code: 'TX',
        zip: '78701',
        country_code: 'US',
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      valid: false,
      message: 'Address could not be validated. Please check the address and try again.',
    })
  })

  it('maps USPS standardized address back to checkout form fields', async () => {
    uspsStandardizeAddressMock.mockResolvedValueOnce({
      address: {
        streetAddress: '123 MAIN ST',
        secondaryAddress: 'APT 2',
        city: 'AUSTIN',
        state: 'tx',
        ZIPCode: '78701',
        ZIPPlus4: '1234',
      },
      corrections: [{ code: 'A1', text: 'Normalized street case' }],
      warnings: ['Apartment inferred'],
    })

    const response = await POST(
      makeRequest({
        address1: '123 Main St',
        address2: ' Apt 2 ',
        city: 'Austin',
        state_code: 'tx',
        zip: '78701-9999',
        country_code: 'US',
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      valid: true,
      standardized: {
        address1: '123 MAIN ST',
        address2: 'APT 2',
        city: 'AUSTIN',
        state_code: 'TX',
        zip: '78701-1234',
        zip4: '1234',
      },
      corrections: [{ code: 'A1', text: 'Normalized street case' }],
      warnings: ['Apartment inferred'],
    })
    expect(uspsStandardizeAddressMock).toHaveBeenCalledWith({
      streetAddress: '123 Main St',
      secondaryAddress: 'Apt 2',
      city: 'Austin',
      state: 'TX',
      ZIPCode: '78701',
    })
  })

  it('returns temporary-unavailable message for USPS outage errors', async () => {
    uspsStandardizeAddressMock.mockRejectedValueOnce(new Error('503 Service Unavailable'))

    const response = await POST(
      makeRequest({
        address1: '123 Main St',
        city: 'Austin',
        state_code: 'TX',
        zip: '78701',
        country_code: 'US',
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload).toEqual({
      valid: false,
      message: 'Address validation is temporarily unavailable. Please try again in a moment.',
    })
  })

  it('returns generic error for unexpected failures', async () => {
    uspsStandardizeAddressMock.mockRejectedValueOnce(new Error('socket hang up'))

    const response = await POST(
      makeRequest({
        address1: '123 Main St',
        city: 'Austin',
        state_code: 'TX',
        zip: '78701',
        country_code: 'US',
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toEqual({
      valid: false,
      message: 'Something went wrong. Please try again.',
    })
  })
})
