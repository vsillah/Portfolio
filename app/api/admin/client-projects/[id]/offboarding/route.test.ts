import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  initializeOffboarding: vi.fn(),
  markOffboardingStep: vi.fn(),
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

vi.mock('@/lib/kickoff-agenda', () => ({
  initializeOffboarding: mocks.initializeOffboarding,
  markOffboardingStep: mocks.markOffboardingStep,
}))

import { GET, PATCH, POST } from './route'

function makeRequest(method: string, body?: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/client-projects/proj-1/offboarding', {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('/api/admin/client-projects/[id]/offboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated GET before querying checklists', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest('GET'), {
      params: Promise.resolve({ id: 'proj-1' }),
    })

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('initializes offboarding for authenticated admins', async () => {
    mocks.initializeOffboarding.mockResolvedValue('checklist-1')

    const response = await POST(makeRequest('POST'), {
      params: Promise.resolve({ id: 'proj-1' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ checklist_id: 'checklist-1' })
    expect(mocks.initializeOffboarding).toHaveBeenCalledWith('proj-1')
  })

  it('rejects invalid offboarding steps before mutating', async () => {
    const response = await PATCH(makeRequest('PATCH', { step: 'shipped' }), {
      params: Promise.resolve({ id: 'proj-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('Invalid step'),
    })
    expect(mocks.markOffboardingStep).not.toHaveBeenCalled()
  })

  it('marks a valid offboarding step complete', async () => {
    mocks.markOffboardingStep.mockResolvedValue(true)

    const response = await PATCH(
      makeRequest('PATCH', { step: 'access_revoked' }),
      { params: Promise.resolve({ id: 'proj-1' }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(mocks.markOffboardingStep).toHaveBeenCalledWith('proj-1', 'access_revoked')
  })
})
