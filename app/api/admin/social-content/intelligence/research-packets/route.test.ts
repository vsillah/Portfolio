import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  selectLimit: vi.fn(),
  selectEq: vi.fn(),
  insertSingle: vi.fn(),
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

describe('/api/admin/social-content/intelligence/research-packets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.selectLimit.mockResolvedValue({
      data: [
        {
          id: 'packet-1',
          source_url: 'https://youtube.com/watch?v=abc',
          platform: 'youtube',
          outlier_score: 82,
        },
      ],
      error: null,
    })
    mocks.insertSingle.mockResolvedValue({
      data: {
        id: 'packet-2',
        source_url: 'https://youtube.com/watch?v=abc',
        platform: 'youtube',
        outlier_score: 81,
        actor_metadata: { actor_id: 'pintostudio/youtube-transcript-scraper' },
      },
      error: null,
    })
    const selectChain = {
      eq: mocks.selectEq.mockImplementation(() => selectChain),
      order: vi.fn(() => selectChain),
      limit: mocks.selectLimit,
    }
    mocks.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: selectChain.eq,
        order: selectChain.order,
        limit: mocks.selectLimit,
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: mocks.insertSingle,
        })),
      })),
    })
  })

  it('lists stored research packets for admin review', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/intelligence/research-packets?platform=youtube'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      packets: [
        {
          id: 'packet-1',
          source_url: 'https://youtube.com/watch?v=abc',
          platform: 'youtube',
          outlier_score: 82,
        },
      ],
    })
  })

  it('loads one exact packet outside the top-50 list for a recovery link', async () => {
    const id = '11111111-1111-1111-1111-111111111111'
    const response = await GET(new NextRequest(`http://localhost/api/admin/social-content/intelligence/research-packets?packet_id=${id}`))
    expect(response.status).toBe(200)
    expect(mocks.selectEq).toHaveBeenCalledWith('id', id)
    expect((await GET(new NextRequest('http://localhost/api/admin/social-content/intelligence/research-packets?packet_id=bad'))).status).toBe(400)
  })

  it('stores research packets with actor metadata and no publishing side effects', async () => {
    const response = await POST(new NextRequest('http://localhost/api/admin/social-content/intelligence/research-packets', {
      method: 'POST',
      body: JSON.stringify({
        source_url: 'https://youtube.com/watch?v=abc',
        platform: 'youtube',
        title: 'How I find outlier videos',
        hook_transcript: 'I spent weeks studying what actually worked.',
        metrics: {
          views: 100000,
          likes: 7000,
          comments: 400,
          follower_count: 50000,
          published_at: '2026-06-20T12:00:00.000Z',
        },
        actor_metadata: {
          actor_id: 'pintostudio/youtube-transcript-scraper',
          run_id: 'run-1',
        },
      }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.from).toHaveBeenCalledWith('social_content_research_packets')
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      packet: {
        id: 'packet-2',
        actor_metadata: { actor_id: 'pintostudio/youtube-transcript-scraper' },
      },
      side_effects: {
        provider_generation: false,
        upload: false,
        publish: false,
        schedule: false,
        external_post: false,
      },
    })
  })

  it('rejects invalid platform values', async () => {
    const response = await POST(new NextRequest('http://localhost/api/admin/social-content/intelligence/research-packets', {
      method: 'POST',
      body: JSON.stringify({
        source_url: 'https://example.com/video',
        platform: 'snapchat',
      }),
    }))

    expect(response.status).toBe(400)
  })
})
