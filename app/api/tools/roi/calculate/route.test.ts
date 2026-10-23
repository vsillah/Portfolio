import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/tools/roi/calculate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/tools/roi/calculate', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('defaults weeksPerYear to 52 and omits ROI when offerPrice is missing', async () => {
    const response = await POST(
      request({ hoursPerWeek: 10, hourlyRate: 50 }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      annualValue: 26000,
      formulaReadable: '10 hrs/week × $50/hr × 52 weeks',
    })
  })

  it('omits ROI when offerPrice is 0', async () => {
    const response = await POST(
      request({ hoursPerWeek: 10, hourlyRate: 50, offerPrice: 0 }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.annualValue).toBe(26000)
    expect(body.roi).toBeUndefined()
    expect(body.netFirstYearValue).toBeUndefined()
  })

  it('includes ROI fields when offerPrice is positive', async () => {
    const response = await POST(
      request({
        hoursPerWeek: 10,
        hourlyRate: 50,
        weeksPerYear: 48,
        offerPrice: 5000,
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      annualValue: 24000,
      formulaReadable: '10 hrs/week × $50/hr × 48 weeks',
      roi: 380,
      roiFormatted: '380%',
      paybackFormatted: '2.5 months',
      netFirstYearValue: 19000,
    })
  })

  it('coerces non-numeric inputs to zero rather than throwing', async () => {
    const response = await POST(
      request({ hoursPerWeek: 'n/a', hourlyRate: null }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      annualValue: 0,
      formulaReadable: '0 hrs/week × $0/hr × 52 weeks',
    })
  })

  it('returns a generic 500 for invalid JSON', async () => {
    const response = await POST(request('{'))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Something went wrong' })
  })
})
