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
  return new NextRequest('http://localhost/api/admin/outreach/leads/42/n8n-outreach-ack', {
    method: 'POST',
  })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function mockUpdate(error: unknown = null) {
  const eq = vi.fn().mockResolvedValue({ error })
  const update = vi.fn().mockReturnValue({ eq })
  mocks.from.mockReturnValue({ update })
  return { update, eq }
}

describe('POST /api/admin/outreach/leads/[id]/n8n-outreach-ack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('returns auth error when admin verification fails', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(), params('42'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it.each(['not-a-number', '0', '-3'])('returns 400 for invalid lead id %s', async (id) => {
    const response = await POST(makeRequest(), params(id))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid lead id' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('clears last_n8n_outreach fields for the lead', async () => {
    const { update, eq } = mockUpdate()

    const response = await POST(makeRequest(), params('42'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(mocks.from).toHaveBeenCalledWith('contact_submissions')
    expect(update).toHaveBeenCalledWith({
      last_n8n_outreach_triggered_at: null,
      last_n8n_outreach_status: null,
      last_n8n_outreach_template_key: null,
    })
    expect(eq).toHaveBeenCalledWith('id', 42)
  })

  it('returns 500 when the update fails', async () => {
    mockUpdate({ message: 'db write failed' })

    const response = await POST(makeRequest(), params('42'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Update failed' })
  })
})
