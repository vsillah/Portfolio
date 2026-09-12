import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

import { GET } from './route'

const BASE_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function request() {
  return new NextRequest('http://localhost/api/admin/printful/config-status')
}

describe('GET /api/admin/printful/config-status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  afterEach(() => {
    restoreEnv()
  })

  it('rejects non-admin callers before reading env', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)
    process.env.PRINTFUL_API_KEY = 'should-not-leak'
    process.env.PRINTFUL_STORE_ID = '12345'

    const response = await GET(request())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('returns booleans only and never echoes secret values', async () => {
    process.env.PRINTFUL_API_KEY = 'pf_live_secret_value'
    process.env.PRINTFUL_STORE_ID = '  998877  '

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ apiKeySet: true, storeIdSet: true })
    expect(JSON.stringify(body)).not.toContain('pf_live_secret_value')
    expect(JSON.stringify(body)).not.toContain('998877')
  })

  it('treats blank Printful env values as unset', async () => {
    process.env.PRINTFUL_API_KEY = '   '
    process.env.PRINTFUL_STORE_ID = ''

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      apiKeySet: false,
      storeIdSet: false,
    })
  })
})
