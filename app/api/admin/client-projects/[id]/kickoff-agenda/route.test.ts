import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  generateKickoffAgenda: vi.fn(),
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
  generateKickoffAgenda: mocks.generateKickoffAgenda,
}))

import { GET, PATCH, POST } from './route'

function makeRequest(method: string, body?: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/client-projects/proj-1/kickoff-agenda', {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('/api/admin/client-projects/[id]/kickoff-agenda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated GET before querying agendas', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest('GET'), {
      params: Promise.resolve({ id: 'proj-1' }),
    })

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 when kickoff generation cannot find an onboarding plan', async () => {
    mocks.generateKickoffAgenda.mockResolvedValue(null)

    const response = await POST(makeRequest('POST', { sender_name: 'Lead' }), {
      params: Promise.resolve({ id: 'proj-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to generate kickoff agenda. Ensure the project has an onboarding plan.',
    })
    expect(mocks.generateKickoffAgenda).toHaveBeenCalledWith('proj-1', 'Lead')
  })

  it('rejects PATCH bodies with no allowlisted fields', async () => {
    const response = await PATCH(makeRequest('PATCH', { unknown_field: true }), {
      params: Promise.resolve({ id: 'proj-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'No valid fields to update',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('updates allowlisted agenda fields and stamps used_at when status is used', async () => {
    const updatePayloads: Record<string, unknown>[] = []
    const updated = {
      id: 'agenda-1',
      status: 'used',
      notes: 'Ready',
    }

    mocks.from.mockImplementation((table: string) => {
      if (table === 'kickoff_agendas') {
        return {
          update: vi.fn((payload: Record<string, unknown>) => {
            updatePayloads.push(payload)
            return {
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: updated, error: null }),
                }),
              }),
            }
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await PATCH(
      makeRequest('PATCH', {
        status: 'used',
        notes: 'Ready',
        secret_admin_flag: true,
      }),
      { params: Promise.resolve({ id: 'proj-1' }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ agenda: updated })
    expect(updatePayloads[0]).toMatchObject({
      status: 'used',
      notes: 'Ready',
    })
    expect(updatePayloads[0]).not.toHaveProperty('secret_admin_flag')
    expect(typeof updatePayloads[0].used_at).toBe('string')
  })
})
