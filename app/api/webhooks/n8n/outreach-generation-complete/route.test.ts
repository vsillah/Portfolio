import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: fromMock },
}))

import { POST } from './route'

type UpdateResult = {
  data: Array<{ id: number; last_n8n_outreach_status: string }>
  error: { message: string } | null
}

function makeRequest(body: unknown, token = 'test-secret') {
  return new Request('http://localhost/api/webhooks/n8n/outreach-generation-complete', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function createUpdateBuilder(result: UpdateResult) {
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
    vi.restoreAllMocks()
  })

  it('rejects requests without the n8n bearer token', async () => {
    const response = await POST(makeRequest({ contact_submission_id: 42, status: 'success' }, 'wrong-token') as any)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed JSON without querying the database', async () => {
    const response = await POST(makeRequest('{bad json') as any)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid JSON body' })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('requires a positive integer contact_submission_id', async () => {
    const response = await POST(makeRequest({ contact_submission_id: 'not-a-number', status: 'success' }) as any)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'contact_submission_id is required (positive integer)',
    })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('requires status to be success or failed', async () => {
    const response = await POST(makeRequest({ contact_submission_id: 42, status: 'skipped' }) as any)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: "status is required and must be 'success' or 'failed'",
    })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('updates only pending contact submissions when n8n reports success', async () => {
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

  it('marks pending contact submissions failed without clobbering resolved rows', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const updateBuilder = createUpdateBuilder({ data: [], error: null })
    fromMock.mockReturnValue(updateBuilder)

    const response = await POST(
      makeRequest({
        contact_submission_id: 42,
        status: 'failed',
        error_message: 'Already contacted gate blocked draft',
        template_key: 'cold_intro',
      }) as any
    )

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
    expect(warnSpy).toHaveBeenCalledWith(
      '[outreach-generation-complete] n8n reported failure',
      {
        contactId: 42,
        template_key: 'cold_intro',
        error_message: 'Already contacted gate blocked draft',
      }
    )
  })

  it('returns 500 when the pending-state update fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const updateBuilder = createUpdateBuilder({
      data: [],
      error: { message: 'database unavailable' },
    })
    fromMock.mockReturnValue(updateBuilder)

    const response = await POST(makeRequest({ contact_submission_id: 42, status: 'success' }) as any)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to update contact' })
    expect(errorSpy).toHaveBeenCalled()
  })
})
