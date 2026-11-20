import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  from: vi.fn(),
  generateKickoffAgenda: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (value: { error?: string }) => Boolean(value?.error),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/kickoff-agenda', () => ({
  generateKickoffAgenda: mocks.generateKickoffAgenda,
}))

import { GET, PATCH, POST } from './route'

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/admin/client-projects/proj-1/kickoff-agenda', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const params = { params: Promise.resolve({ id: 'proj-1' }) }

describe('/api/admin/client-projects/[id]/kickoff-agenda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.generateKickoffAgenda.mockResolvedValue({ agendaId: 'agenda-1', provisioningCount: 3 })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects non-admin callers for GET, POST, and PATCH', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })

    const getResponse = await GET(makeRequest('GET'), params)
    const postResponse = await POST(makeRequest('POST', {}), params)
    const patchResponse = await PATCH(makeRequest('PATCH', { notes: 'x' }), params)

    expect(getResponse.status).toBe(403)
    expect(postResponse.status).toBe(403)
    expect(patchResponse.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.generateKickoffAgenda).not.toHaveBeenCalled()
  })

  it('returns 400 from POST when the project has no onboarding plan', async () => {
    mocks.generateKickoffAgenda.mockResolvedValue(null)

    const response = await POST(makeRequest('POST', { sender_name: 'Ada' }), params)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to generate kickoff agenda. Ensure the project has an onboarding plan.',
    })
    expect(mocks.generateKickoffAgenda).toHaveBeenCalledWith('proj-1', 'Ada')
  })

  it('rejects PATCH bodies that only contain disallowed fields', async () => {
    const response = await PATCH(
      makeRequest('PATCH', {
        id: 'hijack',
        client_project_id: 'other-project',
        used_at: '2020-01-01',
      }),
      params,
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'No valid fields to update' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('updates only the allowlisted fields and stamps used_at when status is used', async () => {
    const select = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: { id: 'agenda-1', status: 'used' },
        error: null,
      }),
    })
    const eq = vi.fn().mockReturnValue({ select })
    const update = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ update })

    const response = await PATCH(
      makeRequest('PATCH', {
        notes: 'Ready',
        status: 'used',
        client_project_id: 'should-not-write',
      }),
      params,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      agenda: { id: 'agenda-1', status: 'used' },
    })
    expect(update).toHaveBeenCalledTimes(1)
    const payload = update.mock.calls[0][0] as Record<string, unknown>
    expect(payload).toMatchObject({ notes: 'Ready', status: 'used' })
    expect(typeof payload.used_at).toBe('string')
    expect(payload).not.toHaveProperty('client_project_id')
    expect(eq).toHaveBeenCalledWith('client_project_id', 'proj-1')
  })
})
