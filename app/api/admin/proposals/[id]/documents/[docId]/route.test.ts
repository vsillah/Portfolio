import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  storageFrom: vi.fn(),
  storageRemove: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
    storage: {
      from: mocks.storageFrom,
    },
  },
}))

import { DELETE } from './route'

function params(id = 'proposal-1', docId = 'doc-1') {
  return { params: Promise.resolve({ id, docId }) }
}

function makeRequest() {
  return new NextRequest(
    'http://localhost/api/admin/proposals/proposal-1/documents/doc-1',
    { method: 'DELETE' },
  )
}

function chain(result: Record<string, unknown>) {
  const api: Record<string, any> = {}
  const self = () => api
  api.select = vi.fn(self)
  api.delete = vi.fn(self)
  api.eq = vi.fn(self)
  api.single = vi.fn(async () => result)
  api.then = (
    resolve: (value: Record<string, unknown>) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return api
}

describe('DELETE /api/admin/proposals/[id]/documents/[docId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.storageFrom.mockReturnValue({
      remove: mocks.storageRemove,
    })
    mocks.storageRemove.mockResolvedValue({ data: null, error: null })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects unauthenticated requests before database access', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await DELETE(makeRequest(), params())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the document is missing or outside the proposal scope', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'proposal_documents') {
        return chain({ data: null, error: { message: 'not found' } })
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await DELETE(makeRequest(), params('proposal-1', 'other-doc'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Document not found' })
    expect(mocks.storageRemove).not.toHaveBeenCalled()
  })

  it('deletes the row and removes the storage object when present', async () => {
    let phase = 0
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'proposal_documents') throw new Error(`Unexpected table: ${table}`)
      phase += 1
      if (phase === 1) {
        return chain({
          data: { id: 'doc-1', file_path: 'proposal-docs/proposal-1/doc-1.pdf' },
          error: null,
        })
      }
      return chain({ data: null, error: null })
    })

    const response = await DELETE(makeRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(mocks.storageFrom).toHaveBeenCalledWith('documents')
    expect(mocks.storageRemove).toHaveBeenCalledWith([
      'proposal-docs/proposal-1/doc-1.pdf',
    ])
  })

  it('skips storage removal when the document has no file_path', async () => {
    let phase = 0
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'proposal_documents') throw new Error(`Unexpected table: ${table}`)
      phase += 1
      if (phase === 1) {
        return chain({ data: { id: 'doc-1', file_path: null }, error: null })
      }
      return chain({ data: null, error: null })
    })

    const response = await DELETE(makeRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(mocks.storageRemove).not.toHaveBeenCalled()
  })
})
