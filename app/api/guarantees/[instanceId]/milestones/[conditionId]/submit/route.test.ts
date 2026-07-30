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

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(
    'http://localhost/api/guarantees/gi-1/milestones/cond-1/submit',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

function params(instanceId = 'gi-1', conditionId = 'cond-1') {
  return { params: { instanceId, conditionId } }
}

describe('POST /api/guarantees/[instanceId]/milestones/[conditionId]/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requires non-empty evidence', async () => {
    const response = await POST(
      makeRequest({ client_evidence: '   ', client_email: 'client@example.com' }),
      params(),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Evidence is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires client email for ownership verification', async () => {
    const response = await POST(
      makeRequest({ client_evidence: 'Screenshot attached', client_email: '  ' }),
      params(),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Client email is required for verification',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the guarantee instance is missing', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'missing' } }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({
        client_evidence: 'Screenshot attached',
        client_email: 'client@example.com',
      }),
      params(),
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'Guarantee instance not found',
    })
  })

  it('rejects submissions when the email does not match the guarantee owner', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'gi-1',
                  status: 'active',
                  client_email: 'owner@example.com',
                },
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({
        client_evidence: 'Screenshot attached',
        client_email: 'intruder@example.com',
      }),
      params(),
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('blocks evidence submission when the guarantee is not active', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'gi-1',
                  status: 'expired',
                  client_email: 'Client@Example.com',
                },
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({
        client_evidence: 'Screenshot attached',
        client_email: 'client@example.com',
      }),
      params(),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Cannot submit evidence for a guarantee with status: expired',
    })
  })

  it('persists trimmed evidence for an active matching client', async () => {
    const updatePayloads: Record<string, unknown>[] = []
    const milestone = {
      id: 'ms-1',
      condition_id: 'cond-1',
      client_evidence: 'Screenshot attached',
    }
    const updateSingle = vi.fn().mockResolvedValue({ data: milestone, error: null })
    const updateSelect = vi.fn().mockReturnValue({ single: updateSingle })
    const updateEqCondition = vi.fn().mockReturnValue({ select: updateSelect })
    const updateEqInstance = vi.fn().mockReturnValue({ eq: updateEqCondition })
    const update = vi.fn((payload: Record<string, unknown>) => {
      updatePayloads.push(payload)
      return { eq: updateEqInstance }
    })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'gi-1',
                  status: 'active',
                  client_email: 'Client@Example.com',
                },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'guarantee_milestones') {
        return { update }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({
        client_evidence: '  Screenshot attached  ',
        client_email: 'client@example.com',
      }),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      milestone,
      message: 'Evidence submitted. An admin will review your submission.',
    })
    expect(updatePayloads[0]).toEqual(
      expect.objectContaining({
        client_evidence: 'Screenshot attached',
        client_submitted_at: expect.any(String),
      }),
    )
    expect(updateEqInstance).toHaveBeenCalledWith('guarantee_instance_id', 'gi-1')
    expect(updateEqCondition).toHaveBeenCalledWith('condition_id', 'cond-1')
  })

  it('returns 404 when the milestone row is missing', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'gi-1',
                  status: 'active',
                  client_email: 'client@example.com',
                },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'guarantee_milestones') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'PGRST116', message: 'no rows' },
                  }),
                }),
              }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({
        client_evidence: 'Screenshot attached',
        client_email: 'client@example.com',
      }),
      params(),
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Milestone not found' })
  })
})
