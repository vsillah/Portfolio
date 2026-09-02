import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  suggestEmailTemplateForLead: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/delivery-email', () => ({
  suggestEmailTemplateForLead: mocks.suggestEmailTemplateForLead,
}))

import { GET } from './route'

function makeRequest(id = '42') {
  return new NextRequest(`http://localhost/api/admin/outreach/leads/${id}/suggested-template`)
}

function params(id: string) {
  return { params: { id } }
}

describe('GET /api/admin/outreach/leads/[id]/suggested-template', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.suggestEmailTemplateForLead.mockResolvedValue({
      template: 'email_warm_followup',
      reason: 'meeting',
    })
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest(), params('42'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.suggestEmailTemplateForLead).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric lead id', async () => {
    const response = await GET(makeRequest('abc'), params('abc'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid lead ID' })
    expect(mocks.suggestEmailTemplateForLead).not.toHaveBeenCalled()
  })

  it('returns the journey-stage suggestion for a valid lead', async () => {
    const response = await GET(makeRequest(), params('42'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      template: 'email_warm_followup',
      reason: 'meeting',
    })
    expect(mocks.suggestEmailTemplateForLead).toHaveBeenCalledWith(42)
  })

  it('fails closed to cold outreach when suggestion lookup throws', async () => {
    mocks.suggestEmailTemplateForLead.mockRejectedValue(new Error('db down'))

    const response = await GET(makeRequest(), params('42'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      template: 'email_cold_outreach',
      reason: 'cold',
    })
  })
})
