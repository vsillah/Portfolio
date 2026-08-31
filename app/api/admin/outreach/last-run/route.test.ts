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

import { GET } from './route'

const BASE_ENV = { ...process.env }
const NOW = new Date('2026-08-31T10:00:00.000Z')
const HOUR_MS = 60 * 60 * 1000

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function request(source: string | null, authHeader: string | null = 'Bearer secret-token') {
  const url = source
    ? `http://localhost/api/admin/outreach/last-run?source=${encodeURIComponent(source)}`
    : 'http://localhost/api/admin/outreach/last-run'
  return new NextRequest(url, {
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

function lastRunQuery(result: { data: { completed_at: string | null; triggered_at: string | null } | null; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const limit = vi.fn().mockReturnValue({ maybeSingle })
  const order = vi.fn().mockReturnValue({ limit })
  const eqStatus = vi.fn().mockReturnValue({ order })
  const eqSource = vi.fn().mockReturnValue({ eq: eqStatus })
  const select = vi.fn().mockReturnValue({ eq: eqSource })
  return { select, eqSource, eqStatus, order, limit, maybeSingle }
}

describe('GET /api/admin/outreach/last-run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    process.env.N8N_INGEST_SECRET = 'secret-token'
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    restoreEnv()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns 401 when bearer token is missing, invalid, or the ingest secret is unset', async () => {
    const missing = await GET(request('facebook', null))
    expect(missing.status).toBe(401)
    expect(await missing.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()

    const wrong = await GET(request('facebook', 'Bearer wrong'))
    expect(wrong.status).toBe(401)

    delete process.env.N8N_INGEST_SECRET
    const unset = await GET(request('facebook'))
    expect(unset.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 when source is missing or not a warm-scrape source', async () => {
    const missing = await GET(request(null))
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({
      error: 'source is required and must be one of: facebook, google_contacts, linkedin',
    })

    const invalid = await GET(request('all'))
    expect(invalid.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns shouldRun true when there is no successful prior run', async () => {
    mocks.from.mockReturnValue(lastRunQuery({ data: null, error: null }))

    const response = await GET(request('linkedin'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ lastSuccessAt: null, shouldRun: true })
  })

  it('returns shouldRun false when the last success was within 24 hours', async () => {
    const lastAt = new Date(NOW.getTime() - 23 * HOUR_MS).toISOString()
    mocks.from.mockReturnValue(
      lastRunQuery({ data: { completed_at: lastAt, triggered_at: lastAt }, error: null }),
    )

    const response = await GET(request('facebook'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ lastSuccessAt: lastAt, shouldRun: false })
  })

  it('returns shouldRun true at the 24-hour boundary and uses triggered_at when completed_at is null', async () => {
    const boundary = new Date(NOW.getTime() - 24 * HOUR_MS).toISOString()
    mocks.from.mockReturnValue(
      lastRunQuery({ data: { completed_at: null, triggered_at: boundary }, error: null }),
    )

    const response = await GET(request('google_contacts'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ lastSuccessAt: boundary, shouldRun: true })
  })

  it('returns 500 with a generic message when the audit query fails', async () => {
    mocks.from.mockReturnValue(lastRunQuery({ data: null, error: { message: 'db down' } }))

    const response = await GET(request('facebook'))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to read last run' })
  })
})
