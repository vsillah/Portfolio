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

import { GET, PATCH, POST } from './route'

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

function makeUploadRequest(fields: {
  file?: File | null
  title?: string | null
  document_type?: string | null
  omitFile?: boolean
}) {
  const values = new Map<string, unknown>()
  if (!fields.omitFile && fields.file !== null) {
    values.set(
      'file',
      fields.file ??
        ({
          type: 'application/pdf',
          arrayBuffer: vi.fn(async () => Buffer.from('%PDF-1.4').buffer),
        } as unknown as File),
    )
  }
  if (fields.title !== null) {
    values.set('title', fields.title ?? 'Strategy packet')
  }
  if (fields.document_type !== undefined && fields.document_type !== null) {
    values.set('document_type', fields.document_type)
  }

  const request = new NextRequest('http://localhost/api/admin/proposals/proposal-1/documents', {
    method: 'POST',
  })
  vi.spyOn(request, 'formData').mockResolvedValue({
    get: vi.fn((key: string) => (values.has(key) ? values.get(key) : null)),
  } as unknown as FormData)
  return request
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
      await expect(response.json()).resolves.toEqual({ documents: docs })
    })
  })

  describe('POST', () => {
    it('rejects non-PDF uploads', async () => {
      mocks.from.mockImplementation((table: string) => {
        if (table === 'proposals') return chain({ data: { id: 'proposal-1' }, error: null })
        throw new Error(`Unexpected table: ${table}`)
      })

      const response = await POST(
        makeUploadRequest({
          file: new File([Buffer.from('not-pdf')], 'notes.txt', { type: 'text/plain' }),
        }),
        params(),
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ error: 'File must be a PDF' })
      expect(mocks.storageUpload).not.toHaveBeenCalled()
    })

    it('requires file and title', async () => {
      mocks.from.mockImplementation((table: string) => {
        if (table === 'proposals') return chain({ data: { id: 'proposal-1' }, error: null })
        throw new Error(`Unexpected table: ${table}`)
      })

      const response = await POST(makeUploadRequest({ omitFile: true, title: '  ' }), params())

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: 'Missing required fields: file, title',
      })
    })

    it('uploads PDF, defaults invalid document_type to other, and appends display_order', async () => {
      const inserted = {
        id: 'doc-new',
        proposal_id: 'proposal-1',
        document_type: 'other',
        title: 'Strategy packet',
        file_path: 'proposal-docs/proposal-1/uuid.pdf',
        display_order: 2,
        source: 'uploaded',
        created_at: '2026-07-27T00:00:00.000Z',
      }

      let proposalDocumentsCalls = 0
      let capturedInsert: Record<string, unknown> | null = null
      mocks.from.mockImplementation((table: string) => {
        if (table === 'proposals') return chain({ data: { id: 'proposal-1' }, error: null })
        if (table === 'proposal_documents') {
          proposalDocumentsCalls += 1
          if (proposalDocumentsCalls === 1) {
            return chain({ data: { display_order: 1 }, error: null })
          }
          const api = chain({ data: inserted, error: null })
          api.insert = vi.fn((payload: Record<string, unknown>) => {
            capturedInsert = payload
            return api
          })
          return api
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const response = await POST(
        makeUploadRequest({ document_type: 'not-a-real-type' }),
        params(),
      )

      expect(response.status).toBe(201)
      await expect(response.json()).resolves.toEqual({ document: inserted })
      expect(mocks.storageUpload).toHaveBeenCalledWith(
        expect.stringMatching(/^proposal-docs\/proposal-1\/.+\.pdf$/),
        expect.any(Buffer),
        expect.objectContaining({ contentType: 'application/pdf', upsert: false }),
      )
      expect(capturedInsert).toEqual(
        expect.objectContaining({
          proposal_id: 'proposal-1',
          document_type: 'other',
          title: 'Strategy packet',
          display_order: 2,
          source: 'uploaded',
        }),
      )
    })

    it('removes the uploaded object when the document row insert fails', async () => {
      let proposalDocumentsCalls = 0
      mocks.from.mockImplementation((table: string) => {
        if (table === 'proposals') return chain({ data: { id: 'proposal-1' }, error: null })
        if (table === 'proposal_documents') {
          proposalDocumentsCalls += 1
          if (proposalDocumentsCalls === 1) {
            return chain({ data: null, error: null })
          }
          return chain({ data: null, error: { message: 'insert failed' } })
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const response = await POST(makeUploadRequest({}), params())

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual({ error: 'Failed to save document record' })
      expect(mocks.storageRemove).toHaveBeenCalledWith([
        expect.stringMatching(/^proposal-docs\/proposal-1\/.+\.pdf$/),
      ])
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
