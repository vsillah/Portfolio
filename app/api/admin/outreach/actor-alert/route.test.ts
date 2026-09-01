import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

const BASE_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function request(body: unknown, authHeader: string | null = 'Bearer secret-token') {
  return new NextRequest('http://localhost/api/admin/outreach/actor-alert', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authHeader ? { authorization: authHeader } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/outreach/actor-alert', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    process.env.N8N_INGEST_SECRET = 'secret-token'
    mocks.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    restoreEnv()
    vi.restoreAllMocks()
  })

  it('returns 401 when bearer token is missing or invalid', async () => {
    const missing = await POST(request({ alerts: [{ actor: 'facebook-scraper' }] }, null))
    expect(missing.status).toBe(401)
    expect(await missing.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()

    delete process.env.N8N_INGEST_SECRET
    const unset = await POST(request({ alerts: [{ actor: 'facebook-scraper' }] }))
    expect(unset.status).toBe(401)
  })

  it('returns success without writing when alerts are missing or empty', async () => {
    const missing = await POST(request({}))
    expect(missing.status).toBe(200)
    expect(await missing.json()).toEqual({ success: true, message: 'No alerts to process' })
    expect(mocks.from).not.toHaveBeenCalled()

    const empty = await POST(request({ alerts: [] }))
    expect(empty.status).toBe(200)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('normalizes n8n id/name payloads and maps actor names onto scrape sources', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ insert })

    const response = await POST(
      request({
        alerts: [
          { id: 'apify-facebook-friends', name: 'FB friends', failedRuns: 3, totalRuns: 4, lastError: 'timeout' },
          { actor: 'linkedin-connections', actorName: 'LI', failedRuns: 1, totalRuns: 1, severity: 'critical' },
          { id: 'other-actor', name: 'Other', failedRuns: 2, totalRuns: 2, severity: 'warning' },
        ],
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      message: 'Logged 3 actor health alert(s)',
      alerts: [
        { actor: 'apify-facebook-friends', severity: 'warning', failedRuns: 3 },
        { actor: 'linkedin-connections', severity: 'critical', failedRuns: 1 },
        { actor: 'other-actor', severity: 'warning', failedRuns: 2 },
      ],
    })

    expect(insert).toHaveBeenCalledTimes(3)
    expect(insert.mock.calls[0][0]).toMatchObject({
      source: 'facebook',
      status: 'error',
      options: expect.objectContaining({
        type: 'actor_health_alert',
        actor: 'apify-facebook-friends',
        actorName: 'FB friends',
        severity: 'warning',
      }),
    })
    expect(insert.mock.calls[1][0]).toMatchObject({
      source: 'linkedin',
      options: expect.objectContaining({ actor: 'linkedin-connections', severity: 'critical' }),
    })
    expect(insert.mock.calls[2][0]).toMatchObject({
      source: 'unknown',
      options: expect.objectContaining({ actor: 'other-actor' }),
    })
  })
})
