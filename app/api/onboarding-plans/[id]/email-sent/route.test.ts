import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { PATCH } from './route'

const BASE_ENV = { ...process.env }

function makeRequest(secret?: string) {
  const headers: Record<string, string> = {}
  if (secret !== undefined) headers['X-N8N-Secret'] = secret
  return new NextRequest('http://localhost/api/onboarding-plans/plan-1/email-sent', {
    method: 'PATCH',
    headers,
  })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('PATCH /api/onboarding-plans/[id]/email-sent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env = { ...BASE_ENV, N8N_WEBHOOK_SECRET: 'n8n-webhook-secret' }
  })

  afterEach(() => {
    process.env = { ...BASE_ENV }
  })

  it('rejects a mismatched n8n secret', async () => {
    const response = await PATCH(makeRequest('wrong-secret'), params('plan-1'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a missing secret when N8N_WEBHOOK_SECRET is configured', async () => {
    const response = await PATCH(makeRequest(), params('plan-1'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the onboarding plan is missing', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    mocks.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single }),
        }),
      }),
    })

    const response = await PATCH(makeRequest('n8n-webhook-secret'), params('missing'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Onboarding plan not found' })
  })

  it('marks the plan sent when the n8n secret matches', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'plan-1', status: 'sent', email_sent_at: '2026-09-01T10:00:00.000Z' },
      error: null,
    })
    const eq = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single }),
    })
    const update = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ update })

    const response = await PATCH(makeRequest('n8n-webhook-secret'), params('plan-1'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      plan_id: 'plan-1',
      email_sent_at: '2026-09-01T10:00:00.000Z',
    })
    expect(mocks.from).toHaveBeenCalledWith('onboarding_plans')
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'sent',
    }))
    expect(eq).toHaveBeenCalledWith('id', 'plan-1')
  })
})
