import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  generateGamma: vi.fn(),
  waitForGeneration: vi.fn(),
  resolveGammaThemeIdForGeneration: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/gamma-client', () => ({
  generateGamma: mocks.generateGamma,
  waitForGeneration: mocks.waitForGeneration,
}))

vi.mock('@/lib/gamma-theme-config', () => ({
  resolveGammaThemeIdForGeneration: mocks.resolveGammaThemeIdForGeneration,
}))

import { POST } from './route'

function request(body?: unknown) {
  return new NextRequest('http://localhost/api/admin/gamma-reports/from-script', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

function insertChain(result: { data?: unknown; error?: unknown } = {}) {
  const query: Record<string, unknown> = {}
  const self = () => query
  query.insert = vi.fn(self)
  query.select = vi.fn(self)
  query.update = vi.fn(self)
  query.eq = vi.fn(self)
  query.single = vi.fn(async () => ({
    data: result.data ?? null,
    error: result.error ?? null,
  }))
  query.then = (
    onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) =>
    Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(
      onFulfilled,
      onRejected,
    )
  return query
}

describe('POST /api/admin/gamma-reports/from-script', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.resolveGammaThemeIdForGeneration.mockResolvedValue('theme-1')
  })

  it('rejects unauthenticated requests before creating a Gamma job', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ scriptText: 'Deck copy' }))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.generateGamma).not.toHaveBeenCalled()
  })

  it('requires non-empty script text after trim', async () => {
    const missing = await POST(request({}))
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({ error: 'scriptText is required' })

    const blank = await POST(request({ scriptText: '   ' }))
    expect(blank.status).toBe(400)
    await expect(blank.json()).resolves.toEqual({ error: 'scriptText is required' })
    expect(mocks.generateGamma).not.toHaveBeenCalled()
  })

  it('returns 500 when the report row cannot be inserted', async () => {
    mocks.from.mockImplementation(() => insertChain({ data: null, error: { message: 'insert failed' } }))

    const response = await POST(request({ scriptText: 'Deck copy' }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to create report record' })
    expect(mocks.generateGamma).not.toHaveBeenCalled()
  })

  it('records a failed generation instead of throwing through to the client as a 500', async () => {
    const insert = insertChain({ data: { id: 'rep-9' } })
    mocks.from.mockImplementation(() => insert)
    mocks.generateGamma.mockRejectedValue(new Error('Gamma API timeout'))

    const response = await POST(request({ scriptText: 'Deck copy', title: '  Script deck  ' }))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toEqual({
      error: 'Gamma generation failed',
      details: 'Gamma API timeout',
    })
    expect(mocks.resolveGammaThemeIdForGeneration).toHaveBeenCalledWith(null)
    expect(insert.update).toHaveBeenCalledWith({
      status: 'failed',
      error_message: 'Gamma API timeout',
    })
  })
})
