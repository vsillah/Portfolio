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

import { GET } from './route'

function request(key = 'chatbot') {
  return new NextRequest(`http://localhost/api/prompts/${key}`)
}

function params(key: string) {
  return { params: Promise.resolve({ key }) }
}

describe('GET /api/prompts/[key]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns only active prompts with the public field set', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'p-1',
        key: 'chatbot',
        name: 'Chatbot',
        prompt: 'You are helpful.',
        config: {},
        version: 3,
      },
      error: null,
    })
    const eqActive = vi.fn().mockReturnValue({ single })
    const eqKey = vi.fn().mockReturnValue({ eq: eqActive })
    const select = vi.fn().mockReturnValue({ eq: eqKey })
    mocks.from.mockReturnValue({ select })

    const response = await GET(request(), params('chatbot'))

    expect(response.status).toBe(200)
    expect(select).toHaveBeenCalledWith('id, key, name, prompt, config, version')
    expect(eqKey).toHaveBeenCalledWith('key', 'chatbot')
    expect(eqActive).toHaveBeenCalledWith('is_active', true)
    expect(await response.json()).toEqual({
      prompt: {
        id: 'p-1',
        key: 'chatbot',
        name: 'Chatbot',
        prompt: 'You are helpful.',
        config: {},
        version: 3,
      },
    })
  })

  it('returns 404 when the active prompt is missing', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          }),
        }),
      }),
    })

    const response = await GET(request('inactive_key'), params('inactive_key'))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Prompt not found' })
  })

  it('returns a generic 500 when the lookup fails', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'XX000', message: 'db down' },
            }),
          }),
        }),
      }),
    })

    const response = await GET(request(), params('chatbot'))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to fetch prompt' })
  })
})
