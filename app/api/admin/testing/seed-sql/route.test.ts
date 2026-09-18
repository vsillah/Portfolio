import { readFile } from 'fs/promises'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (value: { error?: unknown; status?: unknown } | null | undefined) =>
    Boolean(value?.error && value?.status),
}))

import { GET } from './route'

function request(query = '') {
  return new NextRequest(`http://localhost/api/admin/testing/seed-sql${query}`)
}

describe('GET /api/admin/testing/seed-sql', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
  })

  it('requires admin auth before reading seed SQL', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await GET(request('?scriptId=lead_qualification_seed'))

    expect(response.status).toBe(401)
  })

  it('requires a scriptId query param', async () => {
    const response = await GET(request())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'scriptId query param is required' })
  })

  it('returns 404 for an unknown script', async () => {
    const response = await GET(request('?scriptId=missing_script'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Unknown script ID' })
  })

  it('rejects scripts that are not seed SQL', async () => {
    const response = await GET(request('?scriptId=inbound_lead_trigger'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'This script is not a seed SQL.' })
  })

  it('returns the on-disk seed SQL for a known seed script', async () => {
    const expected = await readFile(
      join(process.cwd(), 'scripts/seed-lead-qualification-test-row.sql'),
      'utf-8',
    )

    const response = await GET(request('?scriptId=lead_qualification_seed'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      scriptId: 'lead_qualification_seed',
      label: 'Seed: Lead Qualification Test Row',
      sql: expected,
    })
  })
})
