import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAuth: mocks.verifyAuth,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/prototypes/enroll', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/prototypes/enroll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated callers before querying', async () => {
    mocks.verifyAuth.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(
      request({ prototypeId: 1, enrollmentType: 'Waitlist' }),
    )

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects missing required fields before querying', async () => {
    const missingType = await POST(request({ prototypeId: 1 }))
    expect(missingType.status).toBe(400)
    expect(await missingType.json()).toEqual({ error: 'Missing required fields' })

    const missingId = await POST(request({ enrollmentType: 'Waitlist' }))
    expect(missingId.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects enrollment types outside the allowlist', async () => {
    const response = await POST(
      request({ prototypeId: 1, enrollmentType: 'beta' }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid enrollment type' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 when the user is already enrolled for that type', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'enr-1' },
                error: null,
              }),
            }),
          }),
        }),
      }),
    })

    const response = await POST(
      request({ prototypeId: 12, enrollmentType: 'Pilot' }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Already enrolled' })
  })

  it('creates an enrollment for an allowlisted type', async () => {
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'enr-2', enrollment_type: 'Production-Interest' },
          error: null,
        }),
      }),
    })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
      insert,
    })

    const response = await POST(
      request({ prototypeId: 12, enrollmentType: 'Production-Interest' }),
    )

    expect(response.status).toBe(201)
    expect(insert).toHaveBeenCalledWith([
      {
        user_id: 'user-1',
        prototype_id: 12,
        enrollment_type: 'Production-Interest',
      },
    ])
    expect(await response.json()).toEqual({
      success: true,
      data: { id: 'enr-2', enrollment_type: 'Production-Interest' },
    })
  })
})
