import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: fromMock },
}))

import { POST } from './route'

type UpdateBuilder = {
  update: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
}

function createUpdateBuilder(result: { data: unknown[] | null; error: { message: string } | null }) {
  const builder = {} as UpdateBuilder
  builder.update = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.select = vi.fn().mockResolvedValue(result)
  return builder
}

function makeRequest(body: unknown, token = 'test-secret') {
  return new Request('http://localhost/api/webhooks/n8n/outreach-generation-complete', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
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

  it('returns 401 without the expected bearer token', async () => {
    const response = await POST(makeRequest({ contact_submission_id: 42, status: 'success' }, 'wrong') as any)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('validates contact id and status before touching the database', async () => {
    const invalidIdResponse = await POST(makeRequest({ contact_submission_id: 'nope', status: 'success' }) as any)
    expect(invalidIdResponse.status).toBe(400)
    expect(await invalidIdResponse.json()).toEqual({
      error: 'contact_submission_id is required (positive integer)',
    })

    const invalidStatusResponse = await POST(makeRequest({ contact_submission_id: 42, status: 'pending' }) as any)
    expect(invalidStatusResponse.status).toBe(400)
    expect(await invalidStatusResponse.json()).toEqual({
      error: "status is required and must be 'success' or 'failed'",
    })

    expect(fromMock).not.toHaveBeenCalled()
  })

  it('marks only the matching pending contact as successful', async () => {
    const updateBuilder = createUpdateBuilder({
      data: [{ id: 42, last_n8n_outreach_status: 'success' }],
      error: null,
    })
    fromMock.mockReturnValue(updateBuilder)

    const response = await POST(makeRequest({ contact_submission_id: '42', status: 'success' }) as any)

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

  it('reports a no-op when the row is no longer pending', async () => {
    const updateBuilder = createUpdateBuilder({ data: [], error: null })
    fromMock.mockReturnValue(updateBuilder)

    const response = await POST(makeRequest({ contact_submission_id: 42, status: 'failed' }) as any)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      contact_submission_id: 42,
      status: 'failed',
      updated: false,
      note: 'Row was not in pending state; no change applied (likely already resolved).',
    })
    expect(updateBuilder.update).toHaveBeenCalledWith({ last_n8n_outreach_status: 'failed' })
    expect(updateBuilder.eq).toHaveBeenNthCalledWith(2, 'last_n8n_outreach_status', 'pending')
  })
})
