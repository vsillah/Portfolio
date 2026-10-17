import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (value: { error?: unknown; status?: unknown } | null | undefined) =>
    Boolean(value?.error && value?.status),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/value-evidence/extract-leads/cancel', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/value-evidence/extract-leads/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await POST(request({ contact_submission_ids: [1] }))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a missing or empty id list', async () => {
    for (const body of [{}, { contact_submission_ids: [] }]) {
      const response = await POST(request(body))
      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: 'contact_submission_ids is required and must be a non-empty array',
      })
    }
  })

  it('rejects ids that are not positive integers', async () => {
    const response = await POST(request({ contact_submission_ids: ['1', 0, 1.2] }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Each contact_submission_id must be a positive integer',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('marks only pending rows failed and reports the cancelled count', async () => {
    const select = vi.fn().mockResolvedValue({ data: [{ id: 3 }, { id: 4 }], error: null })
    const inIds = vi.fn(() => ({ select }))
    const eq = vi.fn(() => ({ in: inIds }))
    const update = vi.fn(() => ({ eq }))
    mocks.from.mockImplementation((table: string) => {
      expect(table).toBe('contact_submissions')
      return { update }
    })

    const response = await POST(request({ contact_submission_ids: [3, 3, 4] }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      cancelled: 2,
      message: 'Cancelled extraction for 2 contact(s).',
    })
    expect(update).toHaveBeenCalledWith({ last_vep_status: 'failed' })
    expect(eq).toHaveBeenCalledWith('last_vep_status', 'pending')
    expect(inIds).toHaveBeenCalledWith('id', [3, 4])
  })

  it('reports zero when no pending rows match', async () => {
    mocks.from.mockReturnValue({
      update: () => ({
        eq: () => ({
          in: () => ({
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    })

    const response = await POST(request({ contact_submission_ids: [8] }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      cancelled: 0,
      message: 'No pending extractions found for the given contact(s).',
    })
  })
})
