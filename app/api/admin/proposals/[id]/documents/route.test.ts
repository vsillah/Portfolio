import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  storageFrom: vi.fn(),
  storageUpload: vi.fn(),
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

import { GET, PATCH } from './route'

function params(id = 'proposal-1') {
  return { params: Promise.resolve({ id }) }
}

function makeJsonRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/admin/proposals/proposal-1/documents', {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function chain(result: Record<string, unknown>) {
  const api: Record<string, any> = {}
  const self = () => api
  api.select = vi.fn(self)
  api.insert = vi.fn(self)
  api.update = vi.fn(self)
  api.eq = vi.fn(self)
  api.order = vi.fn(self)
  api.limit = vi.fn(self)
  api.single = vi.fn(async () => result)
  api.maybeSingle = vi.fn(async () => result)
  api.then = (
    resolve: (value: Record<string, unknown>) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return api
}

describe('/api/admin/proposals/[id]/documents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.storageFrom.mockReturnValue({
      upload: mocks.storageUpload,
      remove: mocks.storageRemove,
      createSignedUrl: vi.fn(async()=>({data:{signedUrl:'https://synthetic.invalid/pdf'}})),
    })
    mocks.storageUpload.mockResolvedValue({ error: null })
    mocks.storageRemove.mockResolvedValue({ data: null, error: null })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('GET', () => {
    it('rejects unauthenticated requests before touching proposals', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await GET(makeJsonRequest('GET'), params())

      expect(response.status).toBe(401)
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('returns 404 when the proposal does not exist', async () => {
      mocks.from.mockImplementation((table: string) => {
        if (table === 'proposals') return chain({ data: null, error: { message: 'missing' } })
        throw new Error(`Unexpected table: ${table}`)
      })

      const response = await GET(makeJsonRequest('GET'), params('missing'))

      expect(response.status).toBe(404)
      await expect(response.json()).resolves.toEqual({ error: 'Proposal not found' })
    })

    it('lists documents ordered by display_order', async () => {
      const docs = [
        { id: 'doc-1', display_order: 0, title: 'A' },
        { id: 'doc-2', display_order: 1, title: 'B' },
      ]
      mocks.from.mockImplementation((table: string) => {
        if (table === 'proposals') return chain({ data: { id: 'proposal-1' }, error: null })
        if (table === 'proposal_documents') return chain({ data: docs, error: null })
        throw new Error(`Unexpected table: ${table}`)
      })

      const response = await GET(makeJsonRequest('GET'), params())

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({ documents: docs })
    })
  })

  describe('PATCH', () => {
    it('rejects reorder payloads that do not match the current document set exactly', async () => {
      mocks.from.mockImplementation((table: string) => {
        if (table === 'proposal_documents') {
          return chain({ data: [{ id: 'doc-1' }, { id: 'doc-2' }], error: null })
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const response = await PATCH(
        makeJsonRequest('PATCH', { documentIds: ['doc-1'] }),
        params(),
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: 'documentIds must match exactly the current document ids for this proposal',
      })
    })

    it('reassigns display_order by array index for a complete id set', async () => {
      const updatePayloads: Array<{ id: string; display_order: number; proposalId: string }> = []
      let call = 0
      const ordered = [
        { id: 'doc-2', display_order: 0 },
        { id: 'doc-1', display_order: 1 },
      ]

      mocks.from.mockImplementation((table: string) => {
        if (table !== 'proposal_documents') throw new Error(`Unexpected table: ${table}`)
        call += 1

        if (call === 1) {
          return chain({ data: [{ id: 'doc-1' }, { id: 'doc-2' }], error: null })
        }

        if (call === 2 || call === 3) {
          const api: Record<string, any> = {}
          api.update = vi.fn((payload: { display_order: number }) => {
            let id = ''
            let proposalId = ''
            const eqApi: Record<string, any> = {
              eq: vi.fn((column: string, value: string) => {
                if (column === 'id') id = value
                if (column === 'proposal_id') proposalId = value
                if (id && proposalId) {
                  updatePayloads.push({
                    id,
                    proposalId,
                    display_order: payload.display_order,
                  })
                }
                return eqApi
              }),
              then: (
                resolve: (value: { error: null }) => unknown,
                reject?: (reason: unknown) => unknown,
              ) => Promise.resolve({ error: null }).then(resolve, reject),
            }
            return eqApi
          })
          return api
        }

        return chain({ data: ordered, error: null })
      })

      const response = await PATCH(
        makeJsonRequest('PATCH', { documentIds: ['doc-2', 'doc-1'] }),
        params(),
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ documents: ordered })
      expect(updatePayloads).toEqual([
        { id: 'doc-2', proposalId: 'proposal-1', display_order: 0 },
        { id: 'doc-1', proposalId: 'proposal-1', display_order: 1 },
      ])
    })
  })
})
