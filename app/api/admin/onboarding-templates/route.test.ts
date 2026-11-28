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

import { GET, POST } from './route'

function jsonRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/onboarding-templates', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function thenableQuery(result: { data?: unknown; error?: { message?: string } | null }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    single: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.insert.mockReturnValue(query)
  query.single.mockResolvedValue(result)
  return query
}

describe('GET /api/admin/onboarding-templates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('lists templates without admin authentication', async () => {
    const templates = [{ id: 'tpl-1', name: 'Kickoff' }]
    const query = thenableQuery({ data: templates, error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ templates })
    expect(mocks.from).toHaveBeenCalledWith('onboarding_plan_templates')
    expect(query.order).toHaveBeenNthCalledWith(1, 'content_type')
    expect(query.order).toHaveBeenNthCalledWith(2, 'service_type')
  })

  it('returns a generic 500 when the list query fails', async () => {
    mocks.from.mockReturnValue(thenableQuery({ data: null, error: { message: 'db down' } }))

    const response = await GET()

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch templates' })
  })
})

describe('POST /api/admin/onboarding-templates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('requires name and content_type and does not require admin auth', async () => {
    const missingName = await POST(jsonRequest({ content_type: 'service' }))
    expect(missingName.status).toBe(400)
    await expect(missingName.json()).resolves.toEqual({ error: 'name is required' })

    const missingType = await POST(jsonRequest({ name: 'Kickoff' }))
    expect(missingType.status).toBe(400)
    await expect(missingType.json()).resolves.toEqual({ error: 'content_type is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('inserts defaults for optional fields including is_active=true', async () => {
    const created = { id: 'tpl-1', name: 'Kickoff' }
    const query = thenableQuery({ data: created, error: null })
    mocks.from.mockReturnValue(query)

    const response = await POST(jsonRequest({
      name: 'Kickoff',
      content_type: 'service',
    }))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ template: created })
    expect(query.insert).toHaveBeenCalledWith({
      name: 'Kickoff',
      content_type: 'service',
      service_type: null,
      offer_role: null,
      setup_requirements: [],
      milestones_template: [],
      communication_plan: {},
      win_conditions: [],
      warranty: {},
      artifacts_handoff: [],
      estimated_duration_weeks: null,
      is_active: true,
    })
  })

  it('preserves an explicit is_active=false', async () => {
    const query = thenableQuery({ data: { id: 'tpl-2' }, error: null })
    mocks.from.mockReturnValue(query)

    await POST(jsonRequest({
      name: 'Paused',
      content_type: 'product',
      is_active: false,
    }))

    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }))
  })
})
