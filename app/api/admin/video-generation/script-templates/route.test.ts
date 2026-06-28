import { beforeEach, describe, expect, it, vi } from 'vitest'
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

import { GET, POST } from './route'

describe('/api/admin/video-generation/script-templates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('lists active script templates without provider side effects', async () => {
    const orderSecond = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'template-1',
          key: 'killer_script',
          name: 'Killer script',
          description: 'Start from pain.',
          source_type: 'seeded',
          source_urls: ['https://youtu.be/IUE8o_e4uCY'],
          outline: { pain_point: 'Name the pain.', cta: 'Join the workshop.' },
          status: 'active',
        },
      ],
      error: null,
    })
    const orderFirst = vi.fn(() => ({ order: orderSecond }))
    mocks.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: orderFirst,
        })),
      })),
    })

    const response = await GET(new NextRequest('http://localhost/api/admin/video-generation/script-templates'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.templates[0]).toMatchObject({
      key: 'killer_script',
      outline: expect.objectContaining({ pain_point: 'Name the pain.' }),
    })
    expect(body.side_effects).toMatchObject({
      heygen: false,
      render: false,
      publish: false,
      apify: false,
    })
  })

  it('creates a creator-pattern template without scraper or provider side effects', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'template-2',
        key: 'creator_hook_pattern',
        name: 'Creator hook pattern',
        description: 'Pattern only.',
        source_type: 'creator_pattern',
        source_urls: ['https://youtu.be/RagRPz6DI6U'],
        outline: { pain_point: 'A weak opening loses the viewer.', cta: 'Subscribe.' },
        status: 'active',
      },
      error: null,
    })
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({ single })),
    }))
    mocks.from.mockReturnValue({ insert })

    const response = await POST(new NextRequest('http://localhost/api/admin/video-generation/script-templates', {
      method: 'POST',
      body: JSON.stringify({
        key: 'creator_hook_pattern',
        name: 'Creator hook pattern',
        source_type: 'creator_pattern',
        source_urls: ['https://youtu.be/RagRPz6DI6U'],
        outline: {
          pain_point: 'A weak opening loses the viewer.',
          cta: 'Subscribe.',
        },
      }),
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      source_type: 'creator_pattern',
      source_urls: ['https://youtu.be/RagRPz6DI6U'],
      created_by: 'admin-1',
    }))
    expect(body.side_effects).toMatchObject({
      heygen: false,
      elevenlabs: false,
      render: false,
      publish: false,
      apify: false,
    })
  })
})
