import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: fromMock },
}))

import { POST } from './route'

type DbResult = {
  data: unknown[] | null
  error: { message: string } | null
}

function makeRequest(body: unknown, token = 'test-secret') {
  return new NextRequest('http://localhost/api/webhooks/n8n/outreach-generation-complete', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

function createUpdateBuilder(result: DbResult) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {}
  builder.update = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.select = vi.fn().mockResolvedValue(result)
  return builder
}

describe('POST /api/webhooks/n8n/outreach-generation-complete', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv, N8N_INGEST_SECRET: 'test-secret' }
    fromMock.mockReset()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.clearAllMocks()
  })

  it('rejects invalid bearer tokens before touching the database', async () => {
    const response = await POST(makeRequest({ contact_submission_id: 42, status: 'success' }, 'wrong-token'))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('validates contact id and terminal status before updating', async () => {
    const missingId = await POST(makeRequest({ status: 'success' }))
    expect(missingId.status).toBe(400)
    expect(await missingId.json()).toEqual({
      error: 'contact_submission_id is required (positive integer)',
    })

    const invalidStatus = await POST(makeRequest({ contact_submission_id: 42, status: 'done' }))
    expect(invalidStatus.status).toBe(400)
    expect(await invalidStatus.json()).toEqual({
      error: "status is required and must be 'success' or 'failed'",
    })

    expect(fromMock).not.toHaveBeenCalled()
  })

  it('only transitions pending contacts to the reported terminal status', async () => {
    const updateBuilder = createUpdateBuilder({
      data: [{ id: 42, last_n8n_outreach_status: 'success' }],
      error: null,
    })
    fromMock.mockReturnValue(updateBuilder)

    const response = await POST(makeRequest({ contact_submission_id: '42', status: 'success' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      contact_submission_id: 42,
      status: 'success',
      updated: true,
    })
    expect(fromMock).toHaveBeenCalledWith('contact_submissions')
    expect(updateBuilder.update).toHaveBeenCalledWith({ last_n8n_outreach_status: 'success' })
    expect(updateBuilder.eq).toHaveBeenNthCalledWith(1, 'id', 42)
    expect(updateBuilder.eq).toHaveBeenNthCalledWith(2, 'last_n8n_outreach_status', 'pending')
    expect(updateBuilder.select).toHaveBeenCalledWith('id, last_n8n_outreach_status')
  })

  it('reports no-op when the contact is already resolved', async () => {
    const updateBuilder = createUpdateBuilder({ data: [], error: null })
    fromMock.mockReturnValue(updateBuilder)

    const response = await POST(makeRequest({ contact_submission_id: 42, status: 'failed' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      contact_submission_id: 42,
      status: 'failed',
      updated: false,
      note: 'Row was not in pending state; no change applied (likely already resolved).',
    })
  })

  it('returns a safe error when the status update fails', async () => {
    const updateBuilder = createUpdateBuilder({
      data: null,
      error: { message: 'constraint failed' },
    })
    fromMock.mockReturnValue(updateBuilder)

    const response = await POST(makeRequest({ contact_submission_id: 42, status: 'failed' }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to update contact' })
  })
})
