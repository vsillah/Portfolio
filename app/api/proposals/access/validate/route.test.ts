import { beforeEach, describe, expect, it, vi } from 'vitest'
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

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/proposals/access/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/proposals/access/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('requires a string access code', async () => {
    const missing = await POST(makeRequest({}))
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({ error: 'Access code is required' })

    const wrongType = await POST(makeRequest({ access_code: 12345 }))
    expect(wrongType.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('normalizes the code and returns proposal_id on success', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'prop-9' }, error: null })
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ select })

    const response = await POST(makeRequest({ access_code: '  abc123  ' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ proposal_id: 'prop-9' })
    expect(mocks.from).toHaveBeenCalledWith('proposals')
    expect(eq).toHaveBeenCalledWith('access_code', 'ABC123')
  })

  it('returns 404 for an invalid access code', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) }),
    })

    const response = await POST(makeRequest({ access_code: 'NOPE' }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid access code' })
  })
})
