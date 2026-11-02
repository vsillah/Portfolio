import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  from: vi.fn(),
  initializeOffboarding: vi.fn(),
  markOffboardingStep: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (value: { error?: string }) => Boolean(value?.error),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/kickoff-agenda', () => ({
  initializeOffboarding: mocks.initializeOffboarding,
  markOffboardingStep: mocks.markOffboardingStep,
}))

import { GET, PATCH, POST } from './route'

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/admin/client-projects/proj-1/offboarding', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const params = { params: Promise.resolve({ id: 'proj-1' }) }

describe('/api/admin/client-projects/[id]/offboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.initializeOffboarding.mockResolvedValue('check-1')
    mocks.markOffboardingStep.mockResolvedValue(true)
  })

  it('rejects non-admin callers for GET, POST, and PATCH', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    expect((await GET(makeRequest('GET'), params)).status).toBe(401)
    expect((await POST(makeRequest('POST'), params)).status).toBe(401)
    expect((await PATCH(makeRequest('PATCH', { step: 'completed' }), params)).status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.initializeOffboarding).not.toHaveBeenCalled()
    expect(mocks.markOffboardingStep).not.toHaveBeenCalled()
  })

  it('rejects unknown offboarding steps before writing', async () => {
    const response = await PATCH(makeRequest('PATCH', { step: 'delete_everything' }), params)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/^Invalid step/)
    expect(mocks.markOffboardingStep).not.toHaveBeenCalled()
  })

  it('marks an allowlisted offboarding step complete', async () => {
    const response = await PATCH(makeRequest('PATCH', { step: 'access_revoked' }), params)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(mocks.markOffboardingStep).toHaveBeenCalledWith('proj-1', 'access_revoked')
  })

  it('returns 500 when initializeOffboarding fails', async () => {
    mocks.initializeOffboarding.mockResolvedValue(null)

    const response = await POST(makeRequest('POST'), params)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to initialize offboarding' })
  })
})
