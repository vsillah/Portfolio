import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  runDemoSeed: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (value: { error?: unknown; status?: unknown } | null | undefined) =>
    Boolean(value?.error && value?.status),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: vi.fn() },
}))

vi.mock('@/lib/admin-demo-seed', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin-demo-seed')>()
  return {
    ...actual,
    runDemoSeed: mocks.runDemoSeed,
  }
})

import { DEMO_SEED_KEYS } from '@/lib/admin-demo-seed'
import { POST } from './route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/testing/demo-seed', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/testing/demo-seed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.runDemoSeed.mockResolvedValue({
      ok: true,
      key: 'sarah_mitchell_lead',
      detail: 'seeded',
    })
  })

  it('requires admin auth before seeding', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await POST(request({ key: 'sarah_mitchell_lead' }))

    expect(response.status).toBe(401)
    expect(mocks.runDemoSeed).not.toHaveBeenCalled()
  })

  it('rejects a missing or unknown seed key and lists valid keys', async () => {
    for (const body of [{}, { key: 'not-a-seed' }]) {
      const response = await POST(request(body))
      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: 'Invalid or missing key',
        validKeys: DEMO_SEED_KEYS,
      })
    }
    expect(mocks.runDemoSeed).not.toHaveBeenCalled()
  })

  it('runs the named demo seed', async () => {
    const response = await POST(request({ key: 'sarah_mitchell_lead' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      key: 'sarah_mitchell_lead',
      detail: 'seeded',
    })
    expect(mocks.runDemoSeed).toHaveBeenCalledWith('sarah_mitchell_lead', expect.anything())
  })

  it('returns 500 when the seed helper fails', async () => {
    mocks.runDemoSeed.mockResolvedValue({ ok: false, error: 'duplicate row' })

    const response = await POST(request({ key: 'sarah_mitchell_lead' }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'duplicate row',
    })
  })
})
