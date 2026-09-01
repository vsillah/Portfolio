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

import { POST } from './route'

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/outreach/leads/42/n8n-outreach-pending-cancel', {
    method: 'POST',
  })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function mockPendingUpdate(error: unknown = null) {
  const statusEq = vi.fn().mockResolvedValue({ error })
  const idEq = vi.fn().mockReturnValue({ eq: statusEq })
  const update = vi.fn().mockReturnValue({ eq: idEq })
  mocks.from.mockReturnValue({ update })
  return { update, idEq, statusEq }
}

describe('POST /api/admin/outreach/leads/[id]/n8n-outreach-pending-cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('returns auth error when admin verification fails', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(), params('42'))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it.each(['abc', '0', '-1'])('returns 400 for invalid lead id %s', async (id) => {
    const response = await POST(makeRequest(), params(id))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid lead id' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('marks only pending n8n outreach rows as failed', async () => {
    const { update, idEq, statusEq } = mockPendingUpdate()

    const response = await POST(makeRequest(), params('7'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(mocks.from).toHaveBeenCalledWith('contact_submissions')
    expect(update).toHaveBeenCalledWith({ last_n8n_outreach_status: 'failed' })
    expect(idEq).toHaveBeenCalledWith('id', 7)
    expect(statusEq).toHaveBeenCalledWith('last_n8n_outreach_status', 'pending')
  })

  it('returns 500 when the update fails', async () => {
    mockPendingUpdate({ message: 'constraint' })

    const response = await POST(makeRequest(), params('7'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Update failed' })
  })
})
