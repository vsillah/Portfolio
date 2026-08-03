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

function makeGet(query = '') {
  return new NextRequest(`http://localhost/api/admin/guarantees${query}`)
}

describe('GET /api/admin/guarantees', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects unauthenticated requests before listing guarantees', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGet())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('applies no status/email/template filters when those params are omitted', async () => {
    // omitted filters → no restriction on status / client_email / template
    const range = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 })
    const order = vi.fn().mockReturnValue({ range })
    const select = vi.fn().mockReturnValue({ order })
    const eq = vi.fn()
    const ilike = vi.fn()
    mocks.from.mockReturnValue({ select, eq, ilike })

    // Chain ends at range(); eq/ilike are only attached when filters are present
    const response = await GET(makeGet('?limit=10&offset=0'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: [], total: 0 })
    expect(mocks.from).toHaveBeenCalledWith('guarantee_instances')
    expect(range).toHaveBeenCalledWith(0, 9)
    expect(eq).not.toHaveBeenCalled()
    expect(ilike).not.toHaveBeenCalled()
  })

  it('applies status, email, and template filters when provided', async () => {
    const rows = [{ id: 'gi-1', status: 'active', client_email: 'client@example.com' }]
    const terminal = {
      data: rows,
      error: null,
      count: 1,
      eq: vi.fn(),
      ilike: vi.fn(),
    }
    // Each filter returns the same chainable object so subsequent filters can attach
    terminal.eq.mockReturnValue(terminal)
    terminal.ilike.mockReturnValue(terminal)

    const range = vi.fn().mockReturnValue(terminal)
    const order = vi.fn().mockReturnValue({ range })
    const select = vi.fn().mockReturnValue({ order })
    mocks.from.mockReturnValue({ select })

    const response = await GET(
      makeGet('?status=active&email=client@example.com&template_id=tpl-1&limit=25&offset=50'),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: rows, total: 1 })
    expect(range).toHaveBeenCalledWith(50, 74)
    expect(terminal.eq).toHaveBeenCalledWith('status', 'active')
    expect(terminal.ilike).toHaveBeenCalledWith('client_email', '%client@example.com%')
    expect(terminal.eq).toHaveBeenCalledWith('guarantee_template_id', 'tpl-1')
  })

  it('returns an empty list when the guarantees table is missing', async () => {
    const range = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '42P01', message: 'undefined_table' },
      count: null,
    })
    const order = vi.fn().mockReturnValue({ range })
    const select = vi.fn().mockReturnValue({ order })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeGet())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: [], total: 0 })
  })
})
