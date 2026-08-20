import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

const BASE_ENV = { ...process.env }
const SECRET = 'nurture-webhook-secret'

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function makeRequest(
  body: unknown,
  headers: Record<string, string> = { 'x-webhook-secret': SECRET },
) {
  return new NextRequest('http://localhost/api/lead-magnets/nurture-webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

const validBody = {
  download_id: 'dl-1',
  user_id: 'user-1',
  lead_magnet_id: 'lm-1',
  email_number: 2,
  status: 'sent',
  n8n_execution_id: 'exec-9',
}

describe('POST /api/lead-magnets/nurture-webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    process.env.N8N_WEBHOOK_SECRET = SECRET
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    restoreEnv()
    vi.restoreAllMocks()
  })

  it('returns 401 when the webhook secret is missing, wrong, or unset', async () => {
    const missing = await POST(makeRequest(validBody, {}))
    expect(missing.status).toBe(401)
    expect(await missing.json()).toEqual({ error: 'Unauthorized' })

    const wrong = await POST(
      makeRequest(validBody, { 'x-webhook-secret': 'nope' }),
    )
    expect(wrong.status).toBe(401)

    delete process.env.N8N_WEBHOOK_SECRET
    const unset = await POST(makeRequest(validBody))
    expect(unset.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 when required fields are missing', async () => {
    const response = await POST(makeRequest({ user_id: 'user-1' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Missing required fields: user_id, lead_magnet_id, email_number, status',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 for out-of-range email_number and invalid status', async () => {
    const badNumber = await POST(
      makeRequest({ ...validBody, email_number: 11 }),
    )
    expect(badNumber.status).toBe(400)
    expect(await badNumber.json()).toEqual({ error: 'email_number must be 1-10' })

    const fractional = await POST(
      makeRequest({ ...validBody, email_number: 1.5 }),
    )
    expect(fractional.status).toBe(400)

    const badStatus = await POST(
      makeRequest({ ...validBody, status: 'bounced' }),
    )
    expect(badStatus.status).toBe(400)
    expect(await badStatus.json()).toEqual({
      error: 'status must be one of: queued, sent, failed, opened, clicked',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('inserts a sent-row with sent_at and returns success', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ insert })

    const response = await POST(makeRequest(validBody))
    const [rows] = insert.mock.calls[0] as [Array<Record<string, unknown>>]

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(mocks.from).toHaveBeenCalledWith('lead_magnet_nurture_emails')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      lead_magnet_download_id: 'dl-1',
      user_id: 'user-1',
      lead_magnet_id: 'lm-1',
      email_number: 2,
      status: 'sent',
      n8n_execution_id: 'exec-9',
    })
    expect(typeof rows[0].sent_at).toBe('string')
  })

  it('leaves sent_at null for non-sent statuses and returns 500 on insert failure', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ insert })

    const queued = await POST(makeRequest({ ...validBody, status: 'queued' }))
    const [queuedRows] = insert.mock.calls[0] as [Array<Record<string, unknown>>]

    expect(queued.status).toBe(200)
    expect(queuedRows[0].sent_at).toBeNull()
    expect(queuedRows[0].status).toBe('queued')

    insert.mockResolvedValueOnce({ error: { message: 'unique violation' } })
    const failed = await POST(makeRequest(validBody))
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'Failed to log nurture email' })
  })
})
