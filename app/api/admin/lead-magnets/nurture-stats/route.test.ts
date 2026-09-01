import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    rpc: mocks.rpc,
    from: mocks.from,
  },
}))

import { GET } from './route'

function request() {
  return new NextRequest('http://localhost/api/admin/lead-magnets/nurture-stats')
}

describe('GET /api/admin/lead-magnets/nurture-stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request())

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden' })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('returns the RPC payload when the aggregate function exists', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ lead_magnet_id: 'lm-1', total_sent: 4, unique_users: 2, max_email: 3 }],
      error: null,
    })

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('get_nurture_stats_by_lead_magnet')
    expect(await response.json()).toEqual([
      { lead_magnet_id: 'lm-1', total_sent: 4, unique_users: 2, max_email: 3 },
    ])
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('aggregates unique users and max email number when the RPC is missing', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'function does not exist' } })
    const select = vi.fn().mockResolvedValue({
      data: [
        { lead_magnet_id: 'lm-1', email_number: 1, user_id: 'u-1' },
        { lead_magnet_id: 'lm-1', email_number: 3, user_id: 'u-1' },
        { lead_magnet_id: 'lm-1', email_number: 2, user_id: 'u-2' },
        { lead_magnet_id: 'lm-2', email_number: 1, user_id: 'u-3' },
      ],
      error: null,
    })
    mocks.from.mockReturnValue({ select })

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(mocks.from).toHaveBeenCalledWith('lead_magnet_nurture_emails')
    expect(select).toHaveBeenCalledWith('lead_magnet_id, email_number, user_id')
    expect(await response.json()).toEqual([
      { lead_magnet_id: 'lm-1', total_sent: 3, unique_users: 2, max_email: 3 },
      { lead_magnet_id: 'lm-2', total_sent: 1, unique_users: 1, max_email: 1 },
    ])
  })

  it('returns an empty list when both the RPC and fallback query fail', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'missing rpc' } })
    mocks.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: null, error: { message: 'missing table' } }),
    })

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
  })
})
