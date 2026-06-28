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

import { POST } from './route'

describe('/api/admin/video-generation/script-templates/from-research', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('extracts a creator pattern from recorded evidence without external side effects', async () => {
    const inQuery = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'packet-1',
          source_url: 'https://youtu.be/IUE8o_e4uCY',
          platform: 'youtube',
          title: 'How to write a killer script',
          hook_transcript: 'Most scripts fail because the opening does not name the pain.',
          pattern_packet: {
            tension_or_missed_opportunity: 'Scripts skip the pain point.',
            hook_structure: 'Name the pain before the lesson.',
            promise_value: 'A repeatable structure for better retention.',
            cta_style: 'Ask the viewer to apply the structure.',
            thumbnail_pattern: 'Pain-first promise.',
          },
          pattern_status: 'usable_framework',
          privacy_notes: 'Public creator research packet. Use patterns only.',
        },
      ],
      error: null,
    })
    const templateSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'template-1',
        key: 'creator_pattern_packet',
        name: 'Creator pattern: How to write a killer script',
        description: 'Reusable outline extracted from approved public creator research. Pattern only; no copying.',
        source_type: 'creator_pattern',
        source_urls: ['https://youtu.be/IUE8o_e4uCY'],
        outline: {
          pain_point: 'Scripts skip the pain point.',
          hook: 'Name the pain before the lesson.',
          cta: 'Ask the viewer to apply the structure.',
          source_distance_notes: 'Creator research is used for outline structure only.',
        },
        status: 'active',
      },
      error: null,
    })
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({ single: templateSingle })),
    }))
    mocks.from
      .mockReturnValueOnce({
        select: vi.fn(() => ({ in: inQuery })),
      })
      .mockReturnValueOnce({ insert })

    const response = await POST(new NextRequest('http://localhost/api/admin/video-generation/script-templates/from-research', {
      method: 'POST',
      body: JSON.stringify({ research_packet_ids: ['packet-1'] }),
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      source_type: 'creator_pattern',
      source_urls: ['https://youtu.be/IUE8o_e4uCY'],
      outline: expect.objectContaining({
        pain_point: 'Scripts skip the pain point.',
        hook: 'Name the pain before the lesson.',
        cta: 'Ask the viewer to apply the structure.',
      }),
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
