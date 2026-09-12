import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  triggerWarmLeadScrape: vi.fn(),
  startAgentRun: vi.fn(),
  recordAgentStep: vi.fn(),
  markAgentRunFailed: vi.fn(),
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

vi.mock('@/lib/n8n', () => ({
  triggerWarmLeadScrape: mocks.triggerWarmLeadScrape,
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  recordAgentStep: mocks.recordAgentStep,
  markAgentRunFailed: mocks.markAgentRunFailed,
}))

import { GET, POST } from './route'

const NOW = new Date('2026-08-31T10:00:00.000Z')
const HOUR_MS = 60 * 60 * 1000

function postRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/outreach/trigger', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function getRequest(query = '') {
  return new NextRequest(`http://localhost/api/admin/outreach/trigger${query}`)
}

function skipQuery(lastAt: string | null) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: lastAt ? { completed_at: lastAt, triggered_at: lastAt } : null,
    error: null,
  })
  const limit = vi.fn().mockReturnValue({ maybeSingle })
  const order = vi.fn().mockReturnValue({ limit })
  const eqStatus = vi.fn().mockReturnValue({ order })
  const eqSource = vi.fn().mockReturnValue({ eq: eqStatus })
  const select = vi.fn().mockReturnValue({ eq: eqSource })
  const insert = vi.fn().mockResolvedValue({ error: null })
  return { select, eqSource, eqStatus, order, limit, maybeSingle, insert }
}

function historyQuery(result: { data: unknown; error: unknown }) {
  const resolved = Promise.resolve(result)
  const chain: {
    select: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    then: typeof resolved.then
  } = {
    select: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    eq: vi.fn(),
    then: (onFulfilled, onRejected) => resolved.then(onFulfilled, onRejected),
  }
  chain.select.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  return chain
}

describe('/api/admin/outreach/trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.startAgentRun.mockResolvedValue({ id: 'agent-run-1' })
    mocks.recordAgentStep.mockResolvedValue(undefined)
    mocks.markAgentRunFailed.mockResolvedValue(undefined)
    mocks.triggerWarmLeadScrape.mockResolvedValue({ triggered: true, message: 'ok' })
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('POST', () => {
    it('rejects unauthenticated requests before reading the body or calling n8n', async () => {
      mocks.verifyAdmin.mockResolvedValueOnce({ error: 'Authentication required', status: 401 })
      mocks.isAuthError.mockReturnValueOnce(true)

      const response = await POST(postRequest({ source: 'facebook' }))
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Authentication required' })
      expect(mocks.triggerWarmLeadScrape).not.toHaveBeenCalled()
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('returns 400 when source is missing or invalid', async () => {
      const missing = await POST(postRequest({}))
      expect(missing.status).toBe(400)
      expect(await missing.json()).toEqual({ error: 'source is required' })

      const invalid = await POST(postRequest({ source: 'instagram' }))
      expect(invalid.status).toBe(400)
      expect(await invalid.json()).toEqual({
        error: 'Invalid source. Must be one of: facebook, google_contacts, linkedin, all',
      })
      expect(mocks.triggerWarmLeadScrape).not.toHaveBeenCalled()
    })

    it('skips n8n when the last successful scrape for that source was within 24 hours', async () => {
      const lastAt = new Date(NOW.getTime() - 12 * HOUR_MS).toISOString()
      mocks.from.mockReturnValue(skipQuery(lastAt))

      const response = await POST(postRequest({ source: 'facebook' }))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body).toMatchObject({
        success: true,
        message: 'Skipped: last run within 24 hours',
        triggered: {
          facebook: {
            triggered: false,
            skipped: true,
            message: 'Skipped: last run within 24 hours',
          },
        },
      })
      expect(mocks.triggerWarmLeadScrape).not.toHaveBeenCalled()
      expect(mocks.startAgentRun).not.toHaveBeenCalled()
    })

    it('dispatches n8n and writes a running audit row when the 24-hour window has elapsed', async () => {
      const lastAt = new Date(NOW.getTime() - 24 * HOUR_MS).toISOString()
      const query = skipQuery(lastAt)
      mocks.from.mockReturnValue(query)

      const response = await POST(
        postRequest({ source: 'linkedin', options: { max_leads: 25 } }),
      )
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.triggered.linkedin).toMatchObject({
        triggered: true,
        message: 'ok',
        agent_run_id: 'agent-run-1',
      })
      expect(mocks.startAgentRun).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'warm_lead_scrape',
          triggerSource: 'admin_outreach_trigger',
          triggeredByUserId: 'admin-1',
        }),
      )
      expect(mocks.triggerWarmLeadScrape).toHaveBeenCalledWith({
        source: 'linkedin',
        agentRunId: 'agent-run-1',
        options: { max_leads: 25 },
      })
      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'linkedin',
          triggered_by: 'admin-1',
          status: 'running',
          error_message: null,
        }),
      )
    })

    it('reports all-skipped when every source in an all-trigger is inside the 24-hour window', async () => {
      const lastAt = new Date(NOW.getTime() - 1 * HOUR_MS).toISOString()
      mocks.from.mockReturnValue(skipQuery(lastAt))

      const response = await POST(postRequest({ source: 'all' }))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.message).toBe('All skipped: last run within 24 hours')
      expect(body.triggered.facebook.skipped).toBe(true)
      expect(body.triggered.google_contacts.skipped).toBe(true)
      expect(body.triggered.linkedin.skipped).toBe(true)
      expect(mocks.triggerWarmLeadScrape).not.toHaveBeenCalled()
    })
  })

  describe('GET', () => {
    it('rejects unauthenticated history requests', async () => {
      mocks.verifyAdmin.mockResolvedValueOnce({ error: 'Authentication required', status: 401 })
      mocks.isAuthError.mockReturnValueOnce(true)

      const response = await GET(getRequest())
      expect(response.status).toBe(401)
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('returns recent trigger history and filters by source when it is not all', async () => {
      const chain = historyQuery({
        data: [{ id: 'audit-1', source: 'facebook', status: 'success' }],
        error: null,
      })
      mocks.from.mockReturnValue(chain)

      const response = await GET(getRequest('?source=facebook&limit=5'))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        success: true,
        history: [{ id: 'audit-1', source: 'facebook', status: 'success' }],
      })
      expect(mocks.from).toHaveBeenCalledWith('warm_lead_trigger_audit')
      expect(chain.limit).toHaveBeenCalledWith(5)
      expect(chain.eq).toHaveBeenCalledWith('source', 'facebook')
    })
  })
})
