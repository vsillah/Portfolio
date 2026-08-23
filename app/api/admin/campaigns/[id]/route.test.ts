import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { PUT } from './route'

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/campaigns/camp-1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const params = { params: { id: 'camp-1' } }

describe('PUT /api/admin/campaigns/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PUT(request({ name: 'Updated' }), params)

    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an invalid slug before writing', async () => {
    const response = await PUT(request({ slug: 'Win Money' }), params)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid slug format' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an invalid campaign type and status', async () => {
    const typeResponse = await PUT(request({ campaign_type: 'cash_back' }), params)
    expect(typeResponse.status).toBe(400)
    expect(await typeResponse.json()).toEqual({ error: 'Invalid campaign type' })

    const statusResponse = await PUT(request({ status: 'all' }), params)
    expect(statusResponse.status).toBe(400)
    expect(await statusResponse.json()).toEqual({ error: 'Invalid status' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects unknown-only payloads so stray fields cannot write', async () => {
    const response = await PUT(request({ unexpected: 'value' }), params)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'No fields to update' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 409 when the slug is already taken', async () => {
    mocks.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: '23505', message: 'duplicate slug' },
            }),
          }),
        }),
      }),
    })

    const response = await PUT(request({ slug: 'spring-launch' }), params)

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'A campaign with this slug already exists' })
  })
})
