import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  supabaseAdminRef: { current: null as null | { from: ReturnType<typeof vi.fn> } },
}))

vi.mock('@/lib/supabase', () => ({
  get supabaseAdmin() {
    return mocks.supabaseAdminRef.current
  },
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown> | string, token = 'test-secret') {
  return new NextRequest('http://localhost/api/webhooks/n8n/outreach-generation-complete', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function mockPendingUpdate(result: { data: unknown[] | null; error: { message: string } | null }) {
  const select = vi.fn().mockResolvedValue(result)
  const pendingEq = vi.fn().mockReturnValue({ select })
  const idEq = vi.fn().mockReturnValue({ eq: pendingEq })
  const update = vi.fn().mockReturnValue({ eq: idEq })

  mocks.from.mockReturnValue({ update })

  return { update, idEq, pendingEq, select }
}

describe('POST /api/webhooks/n8n/outreach-generation-complete', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv, N8N_INGEST_SECRET: 'test-secret' }
    mocks.from.mockReset()
    mocks.supabaseAdminRef.current = { from: mocks.from }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.clearAllMocks()
  })

  it('returns 401 when bearer token is invalid', async () => {
    const response = await POST(
      makeRequest({ contact_submission_id: 42, status: 'success' }, 'wrong-secret')
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 when request body is invalid JSON', async () => {
    const response = await POST(makeRequest('{bad json'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 when contact_submission_id is invalid', async () => {
    const response = await POST(makeRequest({ contact_submission_id: 'abc', status: 'success' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'contact_submission_id is required (positive integer)',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 when status is not success or failed', async () => {
    const response = await POST(makeRequest({ contact_submission_id: 42, status: 'pending' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "status is required and must be 'success' or 'failed'",
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('updates pending contact rows to success', async () => {
    const db = mockPendingUpdate({
      data: [{ id: 42, last_n8n_outreach_status: 'success' }],
      error: null,
    })

    const response = await POST(makeRequest({ contact_submission_id: '42', status: 'success' }))

    expect(mocks.from).toHaveBeenCalledWith('contact_submissions')
    expect(db.update).toHaveBeenCalledWith({ last_n8n_outreach_status: 'success' })
    expect(db.idEq).toHaveBeenCalledWith('id', 42)
    expect(db.pendingEq).toHaveBeenCalledWith('last_n8n_outreach_status', 'pending')
    expect(db.select).toHaveBeenCalledWith('id, last_n8n_outreach_status')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      contact_submission_id: 42,
      status: 'success',
      updated: true,
    })
  })

  it('returns updated=false note when row is not pending', async () => {
    mockPendingUpdate({ data: [], error: null })

    const response = await POST(
      makeRequest({ contact_submission_id: 42, status: 'failed', error_message: 'timeout' })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      contact_submission_id: 42,
      status: 'failed',
      updated: false,
      note: 'Row was not in pending state; no change applied (likely already resolved).',
    })
  })

  it('returns 500 when database update fails', async () => {
    mockPendingUpdate({ data: null, error: { message: 'db unavailable' } })

    const response = await POST(makeRequest({ contact_submission_id: 42, status: 'success' }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to update contact' })
  })
})
