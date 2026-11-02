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

import { GET, PUT } from './route'

function jsonRequest(url: string, body?: Record<string, unknown>) {
  return new NextRequest(url, {
    method: body ? 'PUT' : 'GET',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function thenableQuery(result: { data?: unknown; error?: unknown }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    update: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.update.mockReturnValue(query)
  return query
}

describe('/api/admin/communication-templates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth for GET and PUT', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const getResponse = await GET(jsonRequest('http://localhost/api/admin/communication-templates'))
    const putResponse = await PUT(jsonRequest('http://localhost/api/admin/communication-templates', {
      id: 'tpl-1',
      tone: 'warm',
    }))

    expect(getResponse.status).toBe(401)
    expect(putResponse.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('lists templates and optionally filters by update_type', async () => {
    const query = thenableQuery({ data: [{ id: 'tpl-1' }], error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(jsonRequest('http://localhost/api/admin/communication-templates?update_type=action_items_update'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ templates: [{ id: 'tpl-1' }] })
    expect(query.eq).toHaveBeenCalledWith('update_type', 'action_items_update')
  })

  it('requires an id on PUT', async () => {
    const response = await PUT(jsonRequest('http://localhost/api/admin/communication-templates', { tone: 'warm' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'id is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a PUT with no allowlisted fields', async () => {
    const response = await PUT(jsonRequest('http://localhost/api/admin/communication-templates', {
      id: 'tpl-1',
      update_type: 'should-not-write',
      created_by: 'attacker',
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'No valid fields to update' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('updates only allowlisted fields', async () => {
    const query = thenableQuery({ data: { id: 'tpl-1', tone: 'warm' }, error: null })
    mocks.from.mockReturnValue(query)

    const response = await PUT(jsonRequest('http://localhost/api/admin/communication-templates', {
      id: 'tpl-1',
      email_subject: 'Update',
      email_body: 'Hello',
      slack_body: 'Hello slack',
      is_active: false,
      tone: 'warm',
      update_type: 'should-not-write',
      created_by: 'attacker',
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ template: { id: 'tpl-1', tone: 'warm' } })
    expect(query.update).toHaveBeenCalledWith({
      email_subject: 'Update',
      email_body: 'Hello',
      slack_body: 'Hello slack',
      is_active: false,
      tone: 'warm',
    })
    expect(query.eq).toHaveBeenCalledWith('id', 'tpl-1')
  })
})
