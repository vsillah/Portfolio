import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { POST } from './route'

const BASE_ENV = { ...process.env }
const SECRET = 'n8n-ingest-secret'

function params(id = 'draft-1') {
  return { params: Promise.resolve({ id }) }
}

function request(body: unknown = {}, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/client-update-drafts/draft-1/delivered', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function updateChain(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result)
  const select = vi.fn(() => ({ single }))
  const statusEq = vi.fn(() => ({ select }))
  const idEq = vi.fn(() => ({ eq: statusEq }))
  const update = vi.fn(() => ({ eq: idEq }))
  return { update, idEq, statusEq }
}

describe('POST /api/client-update-drafts/[id]/delivered', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env = { ...BASE_ENV, N8N_INGEST_SECRET: SECRET }
  })

  afterEach(() => {
    process.env = { ...BASE_ENV }
  })

  it('rejects a mismatched x-ingest-secret when the ingest secret is configured', async () => {
    const response = await POST(
      request({}, { 'x-ingest-secret': 'wrong' }),
      params(),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('does not accept Authorization Bearer in place of x-ingest-secret', async () => {
    const response = await POST(
      request({}, { authorization: `Bearer ${SECRET}` }),
      params(),
    )

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('skips auth when N8N_INGEST_SECRET is unset', async () => {
    delete process.env.N8N_INGEST_SECRET
    const chain = updateChain({ data: { id: 'draft-1', status: 'sent' }, error: null })
    mocks.from.mockReturnValue(chain)

    const response = await POST(request(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      acknowledged: true,
      draft_id: 'draft-1',
    })
  })

  it('marks a still-draft row sent and defaults channel to email', async () => {
    const chain = updateChain({ data: { id: 'draft-1', status: 'sent' }, error: null })
    mocks.from.mockReturnValue(chain)

    const response = await POST(
      request({}, { 'x-ingest-secret': SECRET }),
      params(),
    )

    expect(response.status).toBe(200)
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'sent',
      sent_via: 'email',
    }))
    expect(chain.idEq).toHaveBeenCalledWith('id', 'draft-1')
    expect(chain.statusEq).toHaveBeenCalledWith('status', 'draft')
    await expect(response.json()).resolves.toEqual({
      acknowledged: true,
      draft_id: 'draft-1',
    })
  })

  it('acknowledges an already-sent or missing draft without erroring', async () => {
    const chain = updateChain({ data: null, error: { message: '0 rows' } })
    mocks.from.mockReturnValue(chain)

    const response = await POST(
      request({ channel: 'slack' }, { 'x-ingest-secret': SECRET }),
      params(),
    )

    expect(response.status).toBe(200)
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ sent_via: 'slack' }))
    await expect(response.json()).resolves.toEqual({
      acknowledged: true,
      already_sent: true,
    })
  })
})
