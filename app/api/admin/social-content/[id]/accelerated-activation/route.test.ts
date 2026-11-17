import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth-server', () => ({ verifyAdmin: vi.fn(async () => ({ user: { id: 'admin-test' } })), isAuthError: () => false }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: vi.fn(() => { throw new Error('No database read expected') }) } }))

import { GET, POST } from './route'

const id = '20d09867-24ce-4849-b03d-f877d7114d6a'
const excludedX = 'd0046271-92ba-4c7f-a009-197b44562f48'
const params = { params: { id } }

afterEach(() => { delete process.env.ACCELERATED_THREE_RECORD_ACTIVATION_ENABLED })

describe('Accelerated campaign activation route', () => {
  it('rejects an unlisted content ID before reading any row', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/other/accelerated-activation'), { params: { id: 'other' } })
    expect(response.status).toBe(404)
  })

  it('rejects the excluded X record on GET and POST even when the flag is enabled', async () => {
    process.env.ACCELERATED_THREE_RECORD_ACTIVATION_ENABLED = 'true'
    const url = `http://localhost/api/admin/social-content/${excludedX}/accelerated-activation`
    expect((await GET(new NextRequest(url), { params: { id: excludedX } })).status).toBe(404)
    expect((await POST(new NextRequest(url, { method: 'POST', body: '{}' }), { params: { id: excludedX } })).status).toBe(404)
  })

  it('cannot mutate when the deployment activation flag is off', async () => {
    const response = await POST(new NextRequest(`http://localhost/api/admin/social-content/${id}/accelerated-activation`, { method: 'POST', body: '{}' }), params)
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'Campaign activation is disabled.' })
  })

  it('requires the complete exact binding before a database read', async () => {
    process.env.ACCELERATED_THREE_RECORD_ACTIVATION_ENABLED = 'true'
    const response = await POST(new NextRequest(`http://localhost/api/admin/social-content/${id}/accelerated-activation`, { method: 'POST', body: JSON.stringify({ scope: 'wrong' }) }), params)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Exact approved activation binding is required.' })
  })
})
