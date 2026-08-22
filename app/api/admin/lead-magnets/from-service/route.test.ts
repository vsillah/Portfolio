import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
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

import { POST } from './route'

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/lead-magnets/from-service', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function serviceQuery(data: unknown, error: unknown = null) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data, error }),
      })),
    })),
  }
}

function existingMagnetQuery(data: unknown) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
      })),
    })),
  }
}

function maxOrderQuery(displayOrder: number | null) {
  return {
    select: vi.fn(() => ({
      order: vi.fn(() => ({
        limit: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: displayOrder == null ? null : { display_order: displayOrder },
            error: null,
          }),
        })),
      })),
    })),
  }
}

function updateQuery(data: unknown) {
  const update = vi.fn(() => ({
    eq: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data, error: null }),
      })),
    })),
  }))
  return { update }
}

function insertQuery(data: unknown) {
  const insert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({ data, error: null }),
    })),
  }))
  return { insert }
}

const service = {
  id: 'svc-1',
  title: 'AI Operating System',
  description: 'Install an AI OS',
  video_url: 'https://video.example/os',
  presentation_url: null,
}

describe('POST /api/admin/lead-magnets/from-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ service_id: 'svc-1' }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a service_id', async () => {
    const response = await POST(request({}))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'service_id is required' })
  })

  it('returns 404 when the service is missing', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'services') return serviceQuery(null, { message: 'missing' })
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(request({ service_id: 'svc-missing' }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Service not found' })
  })

  it('rejects a service with no video or presentation', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'services') {
        return serviceQuery({
          ...service,
          video_url: '   ',
          presentation_url: null,
        })
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(request({ service_id: 'svc-1' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Service must have a video URL or presentation URL to offer as lead magnet',
    })
  })

  it('updates an existing service-linked magnet', async () => {
    const update = updateQuery({
      id: 'lm-existing',
      title: 'Watch the OS',
      service_id: 'svc-1',
    })
    let magnetCalls = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'services') return serviceQuery(service)
      if (table === 'lead_magnets') {
        magnetCalls += 1
        if (magnetCalls === 1) return existingMagnetQuery({ id: 'lm-existing', title: 'Old' })
        return update
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(request({
      service_id: 'svc-1',
      title: 'Watch the OS',
    }))

    expect(response.status).toBe(200)
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Watch the OS',
      category: 'gate_keeper',
      access_type: 'public_gated',
      funnel_stage: 'attention_capture',
      type: 'link',
      is_active: true,
    }))
  })

  it('creates a magnet with the next display_order when none exists', async () => {
    const insert = insertQuery({
      id: 'lm-new',
      title: 'Watch: AI Operating System',
      service_id: 'svc-1',
      display_order: 8,
    })
    let magnetCalls = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'services') return serviceQuery(service)
      if (table === 'lead_magnets') {
        magnetCalls += 1
        if (magnetCalls === 1) return existingMagnetQuery(null)
        if (magnetCalls === 2) return maxOrderQuery(7)
        return insert
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(request({ service_id: 'svc-1' }))

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.leadMagnet.id).toBe('lm-new')
    expect(insert.insert).toHaveBeenCalledWith([expect.objectContaining({
      title: 'Watch: AI Operating System',
      description: 'Install an AI OS',
      service_id: 'svc-1',
      category: 'gate_keeper',
      access_type: 'public_gated',
      funnel_stage: 'attention_capture',
      type: 'link',
      display_order: 8,
      is_active: true,
    })])
  })
})
