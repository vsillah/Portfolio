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

import { DELETE, GET, PATCH } from './route'

const MAGNET_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER = { id: 'user-1', email: 'member@example.com' }
const ADMIN = { id: 'admin-1', email: 'admin@example.com' }

function authRequest(url: string, token = 'valid-token', init: RequestInit = {}) {
  return new NextRequest(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  })
}

function params(id = MAGNET_ID) {
  return { params: Promise.resolve({ id }) }
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

function magnetGetQuery(data: unknown, error: unknown = null) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data, error }),
      })),
    })),
  }
}

function serviceGetQuery(data: unknown) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data, error: data ? null : { message: 'missing' } }),
      })),
    })),
  }
}

function magnetUpdateQuery(data: unknown, error: unknown = null) {
  const update = vi.fn(() => ({
    eq: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data, error }),
      })),
    })),
  }))
  return { update }
}

function magnetDeleteQuery(error: unknown = null) {
  const del = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error }),
  }))
  return { delete: del }
}

const publicMagnet = {
  id: MAGNET_ID,
  title: 'AI Audit Calculator',
  is_active: true,
  category: 'gate_keeper',
  access_type: 'public_gated',
  file_path: 'audit.pdf',
}

describe('GET /api/lead-magnets/[id]', () => {
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

  it('rejects a non-UUID id', async () => {
    const response = await GET(
      authRequest('http://localhost/api/lead-magnets/not-a-uuid'),
      params('not-a-uuid'),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid lead magnet ID' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a bearer token', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/lead-magnets/' + MAGNET_ID),
      params(),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized - token required' })
  })

  it('hides inactive magnets as not found', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'lead_magnets') return magnetGetQuery({ ...publicMagnet, is_active: false })
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(
      authRequest(`http://localhost/api/lead-magnets/${MAGNET_ID}`),
      params(),
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Lead magnet not found' })
    expect(mocks.from).not.toHaveBeenCalledWith('user_profiles')
  })

  it('hides non-public magnets from non-admin users', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'lead_magnets') {
        return magnetGetQuery({
          ...publicMagnet,
          category: 'deal_closer',
          access_type: 'private_link',
        })
      }
      if (table === 'user_profiles') return profileQuery('member')
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(
      authRequest(`http://localhost/api/lead-magnets/${MAGNET_ID}`),
      params(),
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Lead magnet not found' })
  })

  it('returns a public gate-keeper magnet to a logged-in member', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'lead_magnets') return magnetGetQuery({
        ...publicMagnet,
        file_url: 'https://cdn.example/audit.pdf',
        file_path: null,
        service_id: 'svc-1',
      })
      if (table === 'user_profiles') return profileQuery('member')
      if (table === 'services') {
        return serviceGetQuery({
          id: 'svc-1',
          title: 'AI Audit',
          video_url: 'https://video.example/audit',
          video_thumbnail_url: 'https://img.example/audit.jpg',
          presentation_url: null,
        })
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(
      authRequest(`http://localhost/api/lead-magnets/${MAGNET_ID}`),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      leadMagnet: expect.objectContaining({
        id: MAGNET_ID,
        file_path: 'https://cdn.example/audit.pdf',
        service_title: 'AI Audit',
        video_url: 'https://video.example/audit',
        presentation_url: null,
      }),
    })
  })

  it('lets an admin read a private deal-closer magnet', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: ADMIN }, error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'lead_magnets') {
        return magnetGetQuery({
          ...publicMagnet,
          category: 'deal_closer',
          access_type: 'private_link',
        })
      }
      if (table === 'user_profiles') return profileQuery('admin')
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(
      authRequest(`http://localhost/api/lead-magnets/${MAGNET_ID}`),
      params(),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.leadMagnet.category).toBe('deal_closer')
  })
})

describe('PATCH /api/lead-magnets/[id]', () => {
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

  it('forbids non-admin updates', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: USER }, error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') return profileQuery('member')
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await PATCH(
      authRequest(`http://localhost/api/lead-magnets/${MAGNET_ID}`, 'valid-token', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Updated' }),
      }),
      params(),
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
    expect(mocks.from).not.toHaveBeenCalledWith('lead_magnets')
  })

  it('rejects a body with no valid fields', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') return profileQuery('admin')
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await PATCH(
      authRequest(`http://localhost/api/lead-magnets/${MAGNET_ID}`, 'valid-token', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category: 'not-real', funnel_stage: 'all', display_order: 1.5 }),
      }),
      params(),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'No valid fields to update' })
  })

  it('applies only validated admin fields', async () => {
    const update = magnetUpdateQuery({
      ...publicMagnet,
      title: 'Updated title',
      is_active: false,
      funnel_stage: 'delivery_results',
      service_id: null,
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') return profileQuery('admin')
      if (table === 'lead_magnets') return update
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await PATCH(
      authRequest(`http://localhost/api/lead-magnets/${MAGNET_ID}`, 'valid-token', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Updated title',
          is_active: false,
          funnel_stage: 'delivery_results',
          category: 'not-real',
          service_id: '',
        }),
      }),
      params(),
    )

    expect(response.status).toBe(200)
    expect(update.update).toHaveBeenCalledWith({
      title: 'Updated title',
      is_active: false,
      funnel_stage: 'delivery_results',
      service_id: null,
    })
  })
})

describe('DELETE /api/lead-magnets/[id]', () => {
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

  it('forbids non-admin deletes', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: USER }, error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') return profileQuery('member')
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await DELETE(
      authRequest(`http://localhost/api/lead-magnets/${MAGNET_ID}`),
      params(),
    )

    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalledWith('lead_magnets')
  })

  it('deletes the magnet for an admin', async () => {
    const del = magnetDeleteQuery()
    mocks.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') return profileQuery('admin')
      if (table === 'lead_magnets') return del
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await DELETE(
      authRequest(`http://localhost/api/lead-magnets/${MAGNET_ID}`),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(del.delete).toHaveBeenCalled()
  })
})
