import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  sendDeliveryEmail: vi.fn(),
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

vi.mock('@/lib/delivery-email', () => ({
  sendDeliveryEmail: mocks.sendDeliveryEmail,
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>, contactId = '42') {
  return new NextRequest(`http://localhost/api/admin/contacts/${contactId}/send-delivery`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function chain(result: Record<string, unknown>) {
  const api: Record<string, any> = {}
  const self = () => api
  api.select = vi.fn(self)
  api.insert = vi.fn(self)
  api.eq = vi.fn(self)
  api.limit = vi.fn(self)
  api.order = vi.fn(self)
  api.single = vi.fn(async () => result)
  api.maybeSingle = vi.fn(async () => result)
  api.then = (
    resolve: (value: Record<string, unknown>) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return api
}

const validBody = {
  subject: 'Your delivery',
  body: 'Here are the assets.',
  recipientEmail: 'client@example.com',
  assetIds: [{ type: 'gamma_report', id: 'g1' }],
}

describe('POST /api/admin/contacts/[id]/send-delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.sendDeliveryEmail.mockResolvedValue({
      success: true,
      deliveryId: 'delivery-1',
    })
  })

  it('rejects unauthenticated requests before sending', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(validBody), { params: { id: '42' } })

    expect(response.status).toBe(401)
    expect(mocks.sendDeliveryEmail).not.toHaveBeenCalled()
  })

  it('rejects non-numeric contact ids', async () => {
    const response = await POST(makeRequest(validBody, 'abc'), { params: { id: 'abc' } })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid contact ID' })
    expect(mocks.sendDeliveryEmail).not.toHaveBeenCalled()
  })

  it('requires subject, body, and recipientEmail', async () => {
    const response = await POST(
      makeRequest({ subject: ' ', body: 'x', recipientEmail: 'a@b.com' }),
      { params: { id: '42' } },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'subject, body, and recipientEmail are required',
    })
    expect(mocks.sendDeliveryEmail).not.toHaveBeenCalled()
  })

  it('reuses an existing dashboard token when includeDashboardLink is true', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'contact_submissions') {
        return chain({ data: { email: 'client@example.com' }, error: null })
      }
      if (table === 'client_dashboard_access') {
        return chain({ data: { access_token: 'dash-token-1' }, error: null })
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest(validBody), { params: { id: '42' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      deliveryId: 'delivery-1',
      dashboardToken: 'dash-token-1',
    })
    expect(mocks.sendDeliveryEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 42,
        recipientEmail: 'client@example.com',
        subject: 'Your delivery',
        body: 'Here are the assets.',
        dashboardToken: 'dash-token-1',
        sentBy: 'admin-1',
      }),
    )
  })

  it('skips dashboard lookup when includeDashboardLink is false', async () => {
    const response = await POST(
      makeRequest({ ...validBody, includeDashboardLink: false }),
      { params: { id: '42' } },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      deliveryId: 'delivery-1',
      dashboardToken: null,
    })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.sendDeliveryEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 42,
        dashboardToken: null,
        sentBy: 'admin-1',
      }),
    )
  })

  it('returns a generic failure when sendDeliveryEmail fails', async () => {
    mocks.sendDeliveryEmail.mockResolvedValue({
      success: false,
      error: 'smtp down',
    })

    const response = await POST(
      makeRequest({ ...validBody, includeDashboardLink: false }),
      { params: { id: '42' } },
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'smtp down' })
  })
})
