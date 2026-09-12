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

import { GET, PATCH } from './route'

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeGet(id: string) {
  return new NextRequest(`http://localhost/api/admin/chat-escalations/${id}`)
}

function makePatch(id: string, body: unknown, raw?: string) {
  return new NextRequest(`http://localhost/api/admin/chat-escalations/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: raw ?? JSON.stringify(body),
  })
}

describe('GET /api/admin/chat-escalations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGet('1'), params('1'))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric id', async () => {
    const response = await GET(makeGet('abc'), params('abc'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid escalation id' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the escalation is missing', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeGet('9'), params('9'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Escalation not found' })
  })
})

describe('PATCH /api/admin/chat-escalations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication before mutating a link', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PATCH(makePatch('1', { contact_submission_id: 12 }), params('1'))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON', async () => {
    const response = await PATCH(makePatch('1', {}, '{'), params('1'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' })
  })

  it('rejects a non-numeric contact id', async () => {
    const response = await PATCH(makePatch('1', { contact_submission_id: 'abc' }), params('1'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'contact_submission_id must be a number or null',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 when the contact foreign key is missing', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: '23503', message: 'fk' } })
    const select = vi.fn().mockReturnValue({ single })
    const eq = vi.fn().mockReturnValue({ select })
    const update = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ update })

    const response = await PATCH(makePatch('1', { contact_submission_id: 99 }), params('1'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Contact not found (invalid contact_submission_id)',
    })
  })

  it('unlinks a lead when contact_submission_id is null', async () => {
    const updated = { id: 1, contact_submission_id: null }
    const single = vi.fn().mockResolvedValue({ data: updated, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const eq = vi.fn().mockReturnValue({ select })
    const update = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ update })

    const response = await PATCH(makePatch('1', { contact_submission_id: null }), params('1'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(updated)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      contact_submission_id: null,
    }))
  })
})
