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

import { PATCH } from './route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/meetings/bulk-assign', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/admin/meetings/bulk-assign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects unauthenticated callers before touching the database', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PATCH(makeRequest({ meeting_ids: ['m1'], contact_submission_id: 7 }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an empty meeting_ids array', async () => {
    const response = await PATCH(makeRequest({ meeting_ids: [], contact_submission_id: 7 }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'meeting_ids must be a non-empty array' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects more than 50 meetings in one request', async () => {
    const meeting_ids = Array.from({ length: 51 }, (_, i) => `m-${i}`)
    const response = await PATCH(makeRequest({ meeting_ids, contact_submission_id: 7 }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Cannot assign more than 50 meetings at once' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('allows exactly 50 meetings', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const limit = vi.fn().mockReturnValue({ maybeSingle })
    const eq = vi.fn().mockReturnValue({ limit })
    const select = vi.fn().mockReturnValue({ eq })
    const inIds = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ in: inIds })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') return { select }
      if (table === 'meeting_records') return { update }
      throw new Error(`Unexpected table: ${table}`)
    })

    const meeting_ids = Array.from({ length: 50 }, (_, i) => `m-${i}`)
    const response = await PATCH(makeRequest({ meeting_ids, contact_submission_id: 7 }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, updated: 50 })
    expect(update).toHaveBeenCalledWith({ contact_submission_id: 7 })
  })

  it('requires a contact or project id', async () => {
    const response = await PATCH(makeRequest({ meeting_ids: ['m-1'] }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Provide contact_submission_id or client_project_id',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('auto-links the first client project for a contact and updates meetings', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'proj-auto' }, error: null })
    const limit = vi.fn().mockReturnValue({ maybeSingle })
    const eq = vi.fn().mockReturnValue({ limit })
    const select = vi.fn().mockReturnValue({ eq })
    const inIds = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ in: inIds })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') return { select }
      if (table === 'meeting_records') return { update }
      throw new Error(`Unexpected table: ${table}`)
    })

    const meeting_ids = ['m-1', 'm-2']
    const response = await PATCH(
      makeRequest({ meeting_ids, contact_submission_id: '42' }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, updated: 2 })
    expect(eq).toHaveBeenCalledWith('contact_submission_id', 42)
    expect(update).toHaveBeenCalledWith({
      contact_submission_id: 42,
      client_project_id: 'proj-auto',
    })
    expect(inIds).toHaveBeenCalledWith('id', meeting_ids)
  })

  it('backfills contact_submission_id from the assigned project when contact is omitted', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { contact_submission_id: 99 },
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    const inIds = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ in: inIds })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') return { select }
      if (table === 'meeting_records') return { update }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await PATCH(
      makeRequest({ meeting_ids: ['m-9'], client_project_id: 'proj-9' }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, updated: 1 })
    expect(eq).toHaveBeenCalledWith('id', 'proj-9')
    expect(update).toHaveBeenCalledWith({
      client_project_id: 'proj-9',
      contact_submission_id: 99,
    })
  })

  it('lets an explicit project id override the auto-linked contact project', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'proj-auto' }, error: null })
    const limit = vi.fn().mockReturnValue({ maybeSingle })
    const contactEq = vi.fn().mockReturnValue({ limit })
    const select = vi.fn().mockReturnValue({ eq: contactEq })
    const inIds = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ in: inIds })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') return { select }
      if (table === 'meeting_records') return { update }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await PATCH(
      makeRequest({
        meeting_ids: ['m-1'],
        contact_submission_id: 7,
        client_project_id: 'proj-explicit',
      }),
    )

    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith({
      contact_submission_id: 7,
      client_project_id: 'proj-explicit',
    })
    expect(select).toHaveBeenCalledTimes(1)
  })

  it('returns a generic 500 when the meeting update fails', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const limit = vi.fn().mockReturnValue({ maybeSingle })
    const eq = vi.fn().mockReturnValue({ limit })
    const select = vi.fn().mockReturnValue({ eq })
    const inIds = vi.fn().mockResolvedValue({ error: { message: 'fk violation' } })
    const update = vi.fn().mockReturnValue({ in: inIds })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') return { select }
      if (table === 'meeting_records') return { update }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await PATCH(
      makeRequest({ meeting_ids: ['m-1'], contact_submission_id: 7 }),
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to update meetings' })
  })
})
