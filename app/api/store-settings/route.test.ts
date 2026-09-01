import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

function chain(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const api: Record<string, any> = {}
  const self = () => api
  api.select = vi.fn(self)
  api.eq = vi.fn(self)
  api.single = vi.fn(async () => result)
  return api
}

const DEFAULT = { type: 'fixed', value: 5 }

describe('GET /api/store-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns the default social share discount when no row exists', async () => {
    mocks.from.mockReturnValue(chain({ data: null, error: { message: 'missing' } }))

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      social_share_discount: DEFAULT,
    })
    expect(mocks.from).toHaveBeenCalledWith('store_settings')
  })

  it('keeps a stored percentage discount', async () => {
    mocks.from.mockReturnValue(
      chain({ data: { value: { type: 'percentage', value: 10 } }, error: null }),
    )

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      social_share_discount: { type: 'percentage', value: 10 },
    })
  })

  it('coerces unknown types and negative values to the safe default', async () => {
    mocks.from.mockReturnValue(
      chain({ data: { value: { type: 'bogus', value: -3 } }, error: null }),
    )

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      social_share_discount: { type: 'fixed', value: 5 },
    })
  })

  it('fail-opens to the default discount when the lookup throws', async () => {
    mocks.from.mockImplementation(() => {
      throw new Error('db down')
    })

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      social_share_discount: DEFAULT,
    })
  })
})
