import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  supabaseAdmin: { from: mocks.from },
}))

import { PATCH } from './route'

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/social-content/calendar/calendar-1', {
    method: 'PATCH',
    headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/admin/social-content/calendar/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires a decision note when rejecting a calendar item', async () => {
    const response = await PATCH(
      request({ authorization_status: 'rejected' }) as never,
      { params: { id: 'calendar-1' } },
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Decision note is required when rejecting a calendar item',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('records authorized state as internal draft-handoff only', async () => {
    const readMaybeSingle = vi.fn(async () => ({ data: { metadata: { existing: true } }, error: null }))
    const readSelect = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: readMaybeSingle })) }))
    const updateSingle = vi.fn(async () => ({
      data: { id: 'calendar-1', authorization_status: 'authorized' },
      error: null,
    }))
    const updateSelect = vi.fn(() => ({ single: updateSingle }))
    const updateEq = vi.fn(() => ({ select: updateSelect }))
    const update = vi.fn(() => ({ eq: updateEq }))
    mocks.from
      .mockReturnValueOnce({ select: readSelect })
      .mockReturnValueOnce({ update })

    const response = await PATCH(
      request({ authorization_status: 'authorized' }) as never,
      { params: { id: 'calendar-1' } },
    )

    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      authorization_status: 'authorized',
      metadata: expect.objectContaining({
        existing: true,
        authorized_by: 'admin-user',
        draft_handoff_only: true,
        external_execution_enabled: false,
      }),
    }))
    expect(await response.json()).toMatchObject({
      ok: true,
      side_effects: { publish: false, external_post: false },
    })
  })
})
