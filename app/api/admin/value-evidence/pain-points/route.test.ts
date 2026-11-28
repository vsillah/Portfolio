import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (value: { error?: unknown; status?: unknown } | null | undefined) =>
    Boolean(value?.error && value?.status),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/value-evidence/pain-points', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/value-evidence/pain-points', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await POST(request({ name: 'follow_up', display_name: 'Follow-up' }))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires name and display_name before insert', async () => {
    for (const body of [{ display_name: 'Follow-up' }, { name: 'follow_up' }]) {
      const response = await POST(request(body))
      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: 'name and display_name are required',
      })
    }
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('inserts with empty related arrays when optional fields are omitted', async () => {
    const insert = vi.fn()
    mocks.from.mockReturnValue({
      insert: (payload: Record<string, unknown>) => {
        insert(payload)
        return {
          select: () => ({
            single: vi.fn().mockResolvedValue({
              data: { id: 'pp-1', ...payload },
              error: null,
            }),
          }),
        }
      },
    })

    const response = await POST(request({ name: 'follow_up', display_name: 'Follow-up' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(insert).toHaveBeenCalledWith({
      name: 'follow_up',
      display_name: 'Follow-up',
      description: null,
      related_services: [],
      related_products: [],
      industry_tags: [],
    })
    expect(body.painPoint).toEqual(expect.objectContaining({ id: 'pp-1', name: 'follow_up' }))
  })
})
