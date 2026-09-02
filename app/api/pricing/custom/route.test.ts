import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { PRICING_TIERS } from '@/lib/pricing-model'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { GET } from './route'

function makeRequest(url: string) {
  return new NextRequest(url)
}

describe('GET /api/pricing/custom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('requires a sessionId', async () => {
    const response = await GET(makeRequest('http://localhost/api/pricing/custom'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'sessionId is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the sales session is missing', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle }),
      }),
    })

    const response = await GET(makeRequest('http://localhost/api/pricing/custom?sessionId=missing'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Session not found' })
  })

  it('returns a recommended tier and all public tiers for a session without contact data', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'sess-1',
        funnel_stage: 'discovery',
        contact_submissions: null,
        diagnostic_audits: null,
      },
      error: null,
    })
    const neq = vi.fn().mockResolvedValue({ data: [] })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'sales_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ maybeSingle }),
          }),
        }
      }
      if (table === 'industry_benchmarks') {
        return {
          select: vi.fn().mockReturnValue({ neq }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeRequest('http://localhost/api/pricing/custom?sessionId=sess-1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.session).toEqual({ id: 'sess-1', funnelStage: 'discovery' })
    expect(body.client).toEqual({
      name: 'Prospect',
      company: 'Your Business',
      industry: 'General',
      companySize: '11-50',
      email: undefined,
    })
    expect(body.painPoints).toEqual([])
    expect(body.totalAnnualWaste).toBe(0)
    expect(body.allTiers).toEqual(PRICING_TIERS)
    expect(body.recommendedTier).toEqual(expect.objectContaining({
      id: 'accelerator',
      roi: expect.objectContaining({
        investmentRecovery: null,
      }),
    }))
    expect(neq).toHaveBeenCalledWith('validation_status', 'rejected')
  })
})
