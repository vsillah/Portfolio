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

import { GET } from './route'

function makeRequest(id: string) {
  return new NextRequest(`http://localhost/api/admin/contacts/${id}/name`)
}

describe('GET /api/admin/contacts/[id]/name', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated callers before querying', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest('12'), { params: { id: '12' } })

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric contact id', async () => {
    const response = await GET(makeRequest('abc'), { params: { id: 'abc' } })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid contact ID' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the contact does not exist', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeRequest('12'), { params: { id: '12' } })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Contact not found' })
    expect(select).toHaveBeenCalledWith('id, name, email, company')
    expect(eq).toHaveBeenCalledWith('id', 12)
  })

  it('returns the toolbar fields for an existing contact', async () => {
    const contact = { id: 12, name: 'Ada', email: 'ada@example.com', company: 'Acme' }
    const single = vi.fn().mockResolvedValue({ data: contact, error: null })
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeRequest('12'), { params: { id: '12' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ contact })
  })
})
