import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  single: vi.fn(),
  update: vi.fn(),
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

const params = { params: Promise.resolve({ id: 'diagnosis-1' }) }

function getRequest() {
  return new NextRequest('http://localhost/api/admin/chat-eval/diagnoses/diagnosis-1')
}

function putRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/chat-eval/diagnoses/diagnosis-1', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function wireGet() {
  const eq = vi.fn(() => ({ single: mocks.single }))
  const select = vi.fn(() => ({ eq }))
  mocks.from.mockReturnValue({ select })
  return { select, eq }
}

function wirePut() {
  const single = mocks.single
  const select = vi.fn(() => ({ single }))
  const eq = vi.fn(() => ({ select }))
  mocks.update.mockReturnValue({ eq })
  mocks.from.mockReturnValue({ update: mocks.update })
  return { eq }
}

describe('GET /api/admin/chat-eval/diagnoses/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(getRequest(), params)

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('loads the diagnosis with explicit foreign keys and fix applications', async () => {
    const chain = wireGet()
    const diagnosis = { id: 'diagnosis-1', fix_applications: [], chat_sessions: null }
    mocks.single.mockResolvedValue({ data: diagnosis, error: null })

    const response = await GET(getRequest(), params)

    expect(response.status).toBe(200)
    expect(String(chain.select.mock.calls[0][0])).toContain('error_diagnoses_session_id_fkey')
    expect(String(chain.select.mock.calls[0][0])).toContain('fix_applications')
    expect(chain.eq).toHaveBeenCalledWith('id', 'diagnosis-1')
    expect(await response.json()).toEqual({ diagnosis })
  })

  it('maps a missing row to 404 and other read errors to a generic 500', async () => {
    wireGet()
    mocks.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: '0 rows' } })
    const missing = await GET(getRequest(), params)
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: 'Diagnosis not found' })

    mocks.single.mockResolvedValueOnce({ data: null, error: { code: '42703', message: 'column missing' } })
    const failed = await GET(getRequest(), params)
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'Failed to fetch diagnosis' })
  })
})

describe('PUT /api/admin/chat-eval/diagnoses/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PUT(putRequest({ status: 'approved' }), params)

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an unknown status and an empty update', async () => {
    const invalid = await PUT(putRequest({ status: 'archived' }), params)
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toEqual({ error: 'Invalid status' })

    const empty = await PUT(putRequest({ status: '' }), params)
    expect(empty.status).toBe(400)
    expect(await empty.json()).toEqual({ error: 'No valid fields to update' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('stamps the reviewer only for reviewed and approved statuses', async () => {
    const chain = wirePut()
    mocks.single.mockResolvedValue({ data: { id: 'diagnosis-1', status: 'approved' }, error: null })

    const response = await PUT(putRequest({
      status: 'approved',
      recommendations: [{ id: 'rec-1' }],
      application_instructions: 'Apply carefully',
    }), params)

    expect(response.status).toBe(200)
    const updates = mocks.update.mock.calls[0][0]
    expect(updates.status).toBe('approved')
    expect(updates.reviewed_by).toBe('admin-1')
    expect(updates.reviewed_at).toEqual(expect.any(String))
    expect(updates.recommendations).toEqual([{ id: 'rec-1' }])
    expect(updates.application_instructions).toBe('Apply carefully')
    expect(chain.eq).toHaveBeenCalledWith('id', 'diagnosis-1')

    mocks.update.mockClear()
    wirePut()
    mocks.single.mockResolvedValue({ data: { id: 'diagnosis-1', status: 'applied' }, error: null })
    await PUT(putRequest({ status: 'applied' }), params)
    const applied = mocks.update.mock.calls[0][0]
    expect(applied).toEqual({ status: 'applied' })
    expect(applied).not.toHaveProperty('reviewed_by')
  })

  it('maps a missing row to 404 and other write errors to a generic 500', async () => {
    wirePut()
    mocks.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: '0 rows' } })
    const missing = await PUT(putRequest({ status: 'rejected' }), params)
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: 'Diagnosis not found' })

    mocks.single.mockResolvedValueOnce({ data: null, error: { code: '23514', message: 'check violation' } })
    const failed = await PUT(putRequest({ recommendations: [] }), params)
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'Failed to update diagnosis' })
  })
})
