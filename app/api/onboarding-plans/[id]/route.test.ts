import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET, PATCH } from './route'

function makeGetRequest(id: string) {
  return new NextRequest(`http://localhost/api/onboarding-plans/${id}`)
}

function makePatchRequest(id: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/onboarding-plans/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/onboarding-plans/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns 404 when the plan does not exist', async () => {
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({ data: null, error: { message: 'not found' } }),
        }),
      }),
    })

    const response = await GET(makeGetRequest('plan-missing'), {
      params: Promise.resolve({ id: 'plan-missing' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'Onboarding plan not found',
    })
  })

  it('marks a sent plan as acknowledged on first view', async () => {
    const plan = {
      id: 'plan-1',
      status: 'sent',
      acknowledged_at: null,
    }
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq: updateEq })

    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: plan, error: null }),
        }),
      }),
      update,
    })

    const response = await GET(makeGetRequest('plan-1'), {
      params: Promise.resolve({ id: 'plan-1' }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.plan.status).toBe('acknowledged')
    expect(body.plan.acknowledged_at).toEqual(expect.any(String))
    expect(update).toHaveBeenCalledWith({
      status: 'acknowledged',
      acknowledged_at: expect.any(String),
    })
    expect(updateEq).toHaveBeenCalledWith('id', 'plan-1')
  })

  it('does not rewrite an already acknowledged plan', async () => {
    const plan = {
      id: 'plan-1',
      status: 'acknowledged',
      acknowledged_at: '2026-08-01T00:00:00.000Z',
    }
    const update = vi.fn()
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: plan, error: null }),
        }),
      }),
      update,
    })

    const response = await GET(makeGetRequest('plan-1'), {
      params: Promise.resolve({ id: 'plan-1' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ plan })
    expect(update).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/onboarding-plans/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects bodies with no allowed fields', async () => {
    const response = await PATCH(makePatchRequest('plan-1', { secret: 'nope' }), {
      params: Promise.resolve({ id: 'plan-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'No valid fields to update',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('marks content-section edits as customized', async () => {
    const update = vi.fn((payload: Record<string, unknown>) => ({
      eq: () => ({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: { id: 'plan-1', ...payload },
              error: null,
            }),
        }),
      }),
    }))
    mocks.from.mockReturnValue({ update })

    const response = await PATCH(
      makePatchRequest('plan-1', {
        milestones: [{ title: 'Kickoff' }],
        ignored: true,
      }),
      { params: Promise.resolve({ id: 'plan-1' }) },
    )

    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith({
      milestones: [{ title: 'Kickoff' }],
      is_customized: true,
    })
  })

  it('sets sent_at when transitioning status to sent without an explicit timestamp', async () => {
    const update = vi.fn((payload: Record<string, unknown>) => ({
      eq: () => ({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: { id: 'plan-1', ...payload },
              error: null,
            }),
        }),
      }),
    }))
    mocks.from.mockReturnValue({ update })

    const response = await PATCH(makePatchRequest('plan-1', { status: 'sent' }), {
      params: Promise.resolve({ id: 'plan-1' }),
    })

    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith({
      status: 'sent',
      sent_at: expect.any(String),
    })
    expect(update.mock.calls[0][0]).not.toHaveProperty('is_customized')
  })

  it('returns 404 when the update matches no plan', async () => {
    mocks.from.mockReturnValue({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    })

    const response = await PATCH(makePatchRequest('plan-1', { admin_notes: 'x' }), {
      params: Promise.resolve({ id: 'plan-1' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to update onboarding plan',
    })
  })
})
