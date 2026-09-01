import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}))

import { GET, POST } from './route'

const USER = { id: 'user-1', email: 'member@example.com' }
const ADMIN = { id: 'admin-1', email: 'admin@example.com' }

function request(url: string, init: RequestInit = {}) {
  return new NextRequest(url, init)
}

function authRequest(url: string, token = 'valid-token', init: RequestInit = {}) {
  return request(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  })
}

function profileQuery(role: string | null) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: role ? { role } : null,
          error: role ? null : { message: 'missing' },
        }),
      })),
    })),
  }
}

function listQuery(rows: unknown[], error: unknown = null) {
  const eqCalls: Array<[string, unknown]> = []
  const query: Record<string, unknown> = {}
  query.select = vi.fn(() => query)
  query.eq = vi.fn((column: string, value: unknown) => {
    eqCalls.push([column, value])
    return query
  })
  query.order = vi.fn(() => query)
  query.then = (
    resolve: (value: { data: unknown; error: unknown }) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve({ data: rows, error }).then(resolve, reject)
  return { query, eqCalls }
}

function servicesQuery(rows: unknown[]) {
  return {
    select: vi.fn(() => ({
      in: vi.fn().mockResolvedValue({ data: rows, error: null }),
    })),
  }
}

function maxOrderQuery(displayOrder: number | null) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: displayOrder == null ? null : { display_order: displayOrder },
              error: null,
            }),
          })),
        })),
      })),
    })),
  }
}

function insertQuery(row: unknown, error: unknown = null) {
  const insert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({ data: row, error }),
    })),
  }))
  return { insert }
}

describe('GET /api/lead-magnets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon'
    mocks.createClient.mockReturnValue({
      auth: { getUser: mocks.getUser },
    })
    mocks.getUser.mockResolvedValue({ data: { user: USER }, error: null })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requires a bearer token', async () => {
    const response = await GET(request('http://localhost/api/lead-magnets'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized - token required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an invalid session token', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad token' } })

    const response = await GET(authRequest('http://localhost/api/lead-magnets', 'bad-token'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('does not restrict funnel_stage when the filter is all', async () => {
    const magnets = listQuery([
      {
        id: 'lm-attention',
        title: 'Audit',
        funnel_stage: 'attention_capture',
        display_order: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        is_active: true,
        file_path: 'audit.pdf',
      },
      {
        id: 'lm-close',
        title: 'Onboarding pack',
        funnel_stage: 'close_onboarding',
        display_order: 1,
        created_at: '2026-01-02T00:00:00.000Z',
        is_active: true,
        file_url: 'https://cdn.example/onboarding.pdf',
      },
    ])
    mocks.from.mockImplementation((table: string) => {
      if (table === 'lead_magnets') return magnets.query
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(authRequest('http://localhost/api/lead-magnets?funnel_stage=all'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.leadMagnets.map((row: { id: string }) => row.id)).toEqual([
      'lm-attention',
      'lm-close',
    ])
    expect(body.leadMagnets[1].file_path).toBe('https://cdn.example/onboarding.pdf')
    expect(body.leadMagnets[0].funnel_stage_label).toBe('Attention & Capture')
    expect(magnets.eqCalls).toEqual([['is_active', true]])
    expect(magnets.eqCalls.some(([column]) => column === 'funnel_stage')).toBe(false)
  })

  it('treats an omitted or invalid funnel_stage the same as all', async () => {
    const omitted = listQuery([])
    mocks.from.mockImplementation((table: string) => {
      if (table === 'lead_magnets') return omitted.query
      throw new Error(`Unexpected table: ${table}`)
    })

    await GET(authRequest('http://localhost/api/lead-magnets'))
    expect(omitted.eqCalls.some(([column]) => column === 'funnel_stage')).toBe(false)

    const invalid = listQuery([])
    mocks.from.mockImplementation((table: string) => {
      if (table === 'lead_magnets') return invalid.query
      throw new Error(`Unexpected table: ${table}`)
    })

    await GET(authRequest('http://localhost/api/lead-magnets?funnel_stage=not_a_stage'))
    expect(invalid.eqCalls).toEqual([['is_active', true]])
  })

  it('applies a specific funnel_stage filter', async () => {
    const magnets = listQuery([])
    mocks.from.mockImplementation((table: string) => {
      if (table === 'lead_magnets') return magnets.query
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(
      authRequest('http://localhost/api/lead-magnets?funnel_stage=sales_call_process'),
    )

    expect(response.status).toBe(200)
    expect(magnets.eqCalls).toEqual([
      ['is_active', true],
      ['funnel_stage', 'sales_call_process'],
    ])
  })

  it('forbids admin mode for non-admin users', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') return profileQuery('member')
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(authRequest('http://localhost/api/lead-magnets?admin=1'))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
    expect(mocks.from).toHaveBeenCalledWith('user_profiles')
    expect(mocks.from).not.toHaveBeenCalledWith('lead_magnets')
  })

  it('skips the active-only filter in admin mode', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: ADMIN }, error: null })
    const magnets = listQuery([
      {
        id: 'lm-inactive',
        title: 'Hidden',
        funnel_stage: 'attention_capture',
        display_order: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        is_active: false,
        file_path: 'hidden.pdf',
      },
    ])
    mocks.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') return profileQuery('admin')
      if (table === 'lead_magnets') return magnets.query
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(authRequest('http://localhost/api/lead-magnets?admin=1'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.leadMagnets).toHaveLength(1)
    expect(body.leadMagnets[0].id).toBe('lm-inactive')
    expect(magnets.eqCalls).toEqual([])
  })

  it('attaches linked service media and sorts by canonical funnel order', async () => {
    const magnets = listQuery([
      {
        id: 'lm-later',
        title: 'Later stage',
        funnel_stage: 'delivery_results',
        display_order: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        service_id: 'svc-1',
        file_path: 'later.pdf',
      },
      {
        id: 'lm-first',
        title: 'First stage',
        funnel_stage: 'attention_capture',
        display_order: 5,
        created_at: '2026-01-03T00:00:00.000Z',
        service_id: 'svc-1',
        file_path: 'first.pdf',
      },
    ])
    mocks.from.mockImplementation((table: string) => {
      if (table === 'lead_magnets') return magnets.query
      if (table === 'services') {
        return servicesQuery([
          {
            id: 'svc-1',
            title: 'AI Audit',
            video_url: 'https://video.example/audit',
            video_thumbnail_url: 'https://img.example/audit.jpg',
            presentation_url: 'https://slides.example/audit',
          },
        ])
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(authRequest('http://localhost/api/lead-magnets?funnel_stage=all'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.leadMagnets.map((row: { id: string }) => row.id)).toEqual([
      'lm-first',
      'lm-later',
    ])
    expect(body.leadMagnets[0]).toEqual(expect.objectContaining({
      service_title: 'AI Audit',
      video_url: 'https://video.example/audit',
      video_thumbnail_url: 'https://img.example/audit.jpg',
      presentation_url: 'https://slides.example/audit',
    }))
  })
})

describe('POST /api/lead-magnets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon'
    mocks.createClient.mockReturnValue({
      auth: { getUser: mocks.getUser },
    })
    mocks.getUser.mockResolvedValue({ data: { user: ADMIN }, error: null })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects non-admin creators', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: USER }, error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') return profileQuery('member')
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(authRequest('http://localhost/api/lead-magnets', 'valid-token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'X', file_path: 'x.pdf', file_type: 'application/pdf' }),
    }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
  })

  it('requires title, file path, and file type', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') return profileQuery('admin')
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(authRequest('http://localhost/api/lead-magnets', 'valid-token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Missing file' }),
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Missing required fields' })
  })

  it('defaults invalid classification fields and assigns the next display_order', async () => {
    const insert = insertQuery({
      id: 'lm-new',
      title: 'New magnet',
      file_path: 'new.pdf',
      category: 'gate_keeper',
      access_type: 'public_gated',
      funnel_stage: 'attention_capture',
      type: 'pdf',
      display_order: 4,
    })
    let magnetCalls = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') return profileQuery('admin')
      if (table === 'lead_magnets') {
        magnetCalls += 1
        if (magnetCalls === 1) return maxOrderQuery(3)
        return insert
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(authRequest('http://localhost/api/lead-magnets', 'valid-token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'New magnet',
        file_path: 'new.pdf',
        file_type: 'application/pdf',
        category: 'not-real',
        access_type: 'everyone',
        funnel_stage: 'all',
        type: 'zip',
      }),
    }))

    expect(response.status).toBe(201)
    expect(insert.insert).toHaveBeenCalledWith([expect.objectContaining({
      title: 'New magnet',
      file_path: 'new.pdf',
      category: 'gate_keeper',
      access_type: 'public_gated',
      funnel_stage: 'attention_capture',
      type: 'pdf',
      display_order: 4,
      is_active: true,
    })])
  })
})
