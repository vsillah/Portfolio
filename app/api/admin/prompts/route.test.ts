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

import { GET, POST } from './route'

function getRequest() {
  return new NextRequest('http://localhost/api/admin/prompts')
}

function postRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/prompts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/admin/prompts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers before querying', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(getRequest())

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns prompts ordered by key', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ key: 'chatbot', name: 'Chatbot' }],
      error: null,
    })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ order }),
    })

    const response = await GET(getRequest())

    expect(response.status).toBe(200)
    expect(mocks.from).toHaveBeenCalledWith('system_prompts')
    expect(order).toHaveBeenCalledWith('key')
    expect(await response.json()).toEqual({
      prompts: [{ key: 'chatbot', name: 'Chatbot' }],
    })
  })

  it('returns a generic 500 when the list query fails', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'relation missing' },
        }),
      }),
    })

    const response = await GET(getRequest())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to fetch prompts' })
  })
})

describe('POST /api/admin/prompts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers before inserting', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(
      postRequest({ key: 'custom', name: 'Custom', prompt: 'Hello' }),
    )

    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects missing key, name, or prompt before touching the database', async () => {
    const missingKey = await POST(postRequest({ name: 'Custom', prompt: 'Hello' }))
    expect(missingKey.status).toBe(400)
    expect(await missingKey.json()).toEqual({
      error: 'Key, name, and prompt are required',
    })

    const missingName = await POST(postRequest({ key: 'custom', prompt: 'Hello' }))
    expect(missingName.status).toBe(400)

    const emptyPrompt = await POST(
      postRequest({ key: 'custom', name: 'Custom', prompt: '' }),
    )
    expect(emptyPrompt.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('inserts with default config and is_active, stamped by the admin user', async () => {
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'p-1', key: 'custom' },
          error: null,
        }),
      }),
    })
    mocks.from.mockReturnValue({ insert })

    const response = await POST(
      postRequest({ key: 'custom', name: 'Custom', prompt: 'Hello' }),
    )

    expect(response.status).toBe(201)
    expect(insert).toHaveBeenCalledWith({
      key: 'custom',
      name: 'Custom',
      description: undefined,
      prompt: 'Hello',
      config: {},
      is_active: true,
      created_by: 'admin-1',
      updated_by: 'admin-1',
    })
    expect(await response.json()).toEqual({ prompt: { id: 'p-1', key: 'custom' } })
  })

  it('returns 409 when the prompt key already exists', async () => {
    mocks.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '23505', message: 'duplicate' },
          }),
        }),
      }),
    })

    const response = await POST(
      postRequest({ key: 'chatbot', name: 'Chatbot', prompt: 'Hi' }),
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'A prompt with this key already exists',
    })
  })
})
