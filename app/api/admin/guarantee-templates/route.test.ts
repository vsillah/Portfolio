import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  validateConditions: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/guarantees', () => ({
  validateConditions: mocks.validateConditions,
}))

import { GET, POST } from './route'

function makeGetRequest(query = '') {
  return new NextRequest(`http://localhost/api/admin/guarantee-templates${query}`)
}

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/guarantee-templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function validCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    name: '  30-Day Outcome Guarantee  ',
    duration_days: 30,
    default_payout_type: 'refund',
    ...overrides,
  }
}

describe('GET /api/admin/guarantee-templates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated requests before listing templates', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGetRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('defaults to active-only templates', async () => {
    // Chain: select('*').order(...).eq('is_active', true) then await
    const eq = vi.fn().mockResolvedValue({ data: [{ id: 'tpl-1' }], error: null })
    const order = vi.fn().mockReturnValue({ eq })
    const select = vi.fn().mockReturnValue({ order })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeGetRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([{ id: 'tpl-1' }])
    expect(eq).toHaveBeenCalledWith('is_active', true)
  })

  it('includes inactive templates when active=false', async () => {
    // Chain: select('*').order(...) then await (no eq filter)
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 'tpl-2', is_active: false }],
      error: null,
    })
    const eq = vi.fn()
    const select = vi.fn().mockReturnValue({ order })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeGetRequest('?active=false'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([{ id: 'tpl-2', is_active: false }])
    expect(eq).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/guarantee-templates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.validateConditions.mockReturnValue(true)
  })

  it('rejects unauthenticated creates before writing templates', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makePostRequest(validCreateBody()))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a non-empty name', async () => {
    const response = await POST(makePostRequest(validCreateBody({ name: '   ' })))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Name is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires duration_days of at least 1', async () => {
    const response = await POST(makePostRequest(validCreateBody({ duration_days: 0 })))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Duration must be at least 1 day',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects invalid payout types before insert', async () => {
    const response = await POST(
      makePostRequest(validCreateBody({ default_payout_type: 'gift_card' })),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error:
        'Invalid default_payout_type. Must be one of: refund, credit, rollover_upsell, rollover_continuity',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects malformed conditions structures', async () => {
    mocks.validateConditions.mockReturnValue(false)

    const response = await POST(
      makePostRequest(
        validCreateBody({
          conditions: [{ label: 'missing required fields' }],
        }),
      ),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error:
        'Invalid conditions structure. Each condition must have id, label, verification_method, and required.',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('creates a template with trimmed fields and admin attribution', async () => {
    const created = { id: 'tpl-new', name: '30-Day Outcome Guarantee' }
    const single = vi.fn().mockResolvedValue({ data: created, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'guarantee_templates') throw new Error(`Unexpected table: ${table}`)
      return { insert }
    })

    const response = await POST(
      makePostRequest(
        validCreateBody({
          description: '  Money-back if milestones miss  ',
          guarantee_type: 'conditional',
          payout_amount_type: 'full',
          conditions: [],
        }),
      ),
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual(created)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '30-Day Outcome Guarantee',
        description: 'Money-back if milestones miss',
        guarantee_type: 'conditional',
        duration_days: 30,
        default_payout_type: 'refund',
        payout_amount_type: 'full',
        created_by: 'admin-user-1',
      }),
    )
  })
})
