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

import { DELETE, PATCH } from './route'

function jsonRequest(method: 'PATCH' | 'DELETE', body?: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/testing/chatbot-questions/custom-1', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function thenableQuery(result: { data?: unknown; error?: unknown }) {
  const query: {
    delete: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    select: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    delete: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.delete.mockReturnValue(query)
  query.update.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.select.mockReturnValue(query)
  return query
}

describe('/api/admin/testing/chatbot-questions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.from.mockReturnValue(thenableQuery({ data: { id: 'custom-1' }, error: null }))
  })

  it('requires admin auth for PATCH and DELETE', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const patchResponse = await PATCH(jsonRequest('PATCH', { question: 'Updated' }), { params: { id: 'custom-1' } })
    const deleteResponse = await DELETE(jsonRequest('DELETE'), { params: { id: 'custom-1' } })

    expect(patchResponse.status).toBe(401)
    expect(deleteResponse.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an empty PATCH payload', async () => {
    const response = await PATCH(jsonRequest('PATCH', { ignored: true }), { params: { id: 'custom-1' } })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'No fields to update' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('maps known fields onto the custom question row', async () => {
    const query = thenableQuery({ data: { id: 'custom-1', question: 'Updated' }, error: null })
    mocks.from.mockReturnValue(query)

    const response = await PATCH(jsonRequest('PATCH', {
      question: '  Updated  ',
      category: 'identity',
      expectedKeywords: ['mission'],
      expectsBoundary: true,
      triggersDiagnostic: false,
      tags: ['intro'],
      created_by: 'attacker',
    }), { params: { id: 'custom-1' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ question: { id: 'custom-1', question: 'Updated' } })
    expect(query.update).toHaveBeenCalledWith({
      question: 'Updated',
      category: 'identity',
      expected_keywords: ['mission'],
      expects_boundary: true,
      triggers_diagnostic: false,
      tags: ['intro'],
    })
    expect(query.eq).toHaveBeenCalledWith('id', 'custom-1')
  })

  it('deletes the custom question by id', async () => {
    const query = thenableQuery({ data: null, error: null })
    mocks.from.mockReturnValue(query)

    const response = await DELETE(jsonRequest('DELETE'), { params: { id: 'custom-1' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(query.delete).toHaveBeenCalled()
    expect(query.eq).toHaveBeenCalledWith('id', 'custom-1')
  })
})
