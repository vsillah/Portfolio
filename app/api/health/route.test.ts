import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/n8n-runtime-flags', () => ({
  describeN8nRuntimeFlags: () => ({
    tier: 'production',
    mockN8n: { effective: false },
    disableOutbound: { effective: false },
  }),
}))

import { GET } from './route'

function siteSettingsQuery(error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { key: 'site_name' }, error }),
  }
}

describe('health route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.from.mockReturnValue(siteSettingsQuery())
  })

  it('probes site_settings by key because production has no id column', async () => {
    const query = siteSettingsQuery()
    mocks.from.mockReturnValue(query)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ ok: true, db: 'connected' })
    expect(mocks.from).toHaveBeenCalledWith('site_settings')
    expect(query.select).toHaveBeenCalledWith('key')
  })

  it('returns 503 when the database probe fails', async () => {
    mocks.from.mockReturnValue(siteSettingsQuery({ message: 'db unavailable' }))

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toMatchObject({ ok: false, db: 'unreachable' })
  })
})
