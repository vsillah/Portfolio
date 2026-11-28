import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  admin: null as null | { from: ReturnType<typeof vi.fn> },
  from: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  get supabaseAdmin() {
    return mocks.admin
  },
}))

import { POST } from './route'

const FIXED_NOW = new Date('2026-09-30T10:00:00.000Z')

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/sales/in-person-diagnostic', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/admin/sales/in-person-diagnostic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(FIXED_NOW)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.insert.mockResolvedValue({ error: null })
    mocks.eq.mockResolvedValue({ error: null })
    mocks.update.mockReturnValue({ eq: mocks.eq })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'diagnostic_audits') return { insert: mocks.insert }
      if (table === 'sales_sessions') return { update: mocks.update }
      throw new Error(`Unexpected table ${table}`)
    })
    mocks.admin = { from: mocks.from }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects non-admins before writing a diagnostic', async () => {
    mocks.isAuthError.mockReturnValue(true)
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await POST(makeRequest('{'))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it.each([
    ['missing', {}],
    ['blank', { sales_session_id: '' }],
    ['zero', { sales_session_id: 0 }],
  ])('returns 400 when sales_session_id is %s', async (_label, body) => {
    const response = await POST(makeRequest(body))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'sales_session_id is required' })
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('stores default sections and skips a blank business name', async () => {
    const response = await POST(makeRequest({
      sales_session_id: 'sess-9',
      contact_submission_id: 0,
      business_name: '   ',
      diagnostic_data: null,
    }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.auditId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(body).toEqual({
      auditId: body.auditId,
      sessionId: `in-person-sess-9-${FIXED_NOW.getTime()}`,
      status: 'in_progress',
    })

    const inserted = mocks.insert.mock.calls[0][0]
    expect(inserted).toEqual({
      id: body.auditId,
      session_id: `in-person-sess-9-${FIXED_NOW.getTime()}`,
      contact_submission_id: null,
      status: 'in_progress',
      business_challenges: {},
      tech_stack: {},
      automation_needs: {},
      ai_readiness: {},
      budget_timeline: {},
      decision_making: {},
      started_at: FIXED_NOW.toISOString(),
      updated_at: FIXED_NOW.toISOString(),
    })
    expect(inserted).not.toHaveProperty('business_name')
    expect(inserted).not.toHaveProperty('completed_at')
    expect(mocks.update).toHaveBeenCalledWith({
      diagnostic_audit_id: body.auditId,
      updated_at: FIXED_NOW.toISOString(),
    })
    expect(mocks.eq).toHaveBeenCalledWith('id', 'sess-9')
  })

  it('stamps completion and a trimmed business name', async () => {
    const response = await POST(makeRequest({
      sales_session_id: 'sess-9',
      contact_submission_id: 42,
      status: 'completed',
      business_name: '  Northstar  ',
      diagnostic_data: {
        business_challenges: { primary: 'follow-up' },
        tech_stack: { crm: 'sheet' },
        automation_needs: { priority: 'routing' },
        ai_readiness: { score: 3 },
        budget_timeline: { range: 'low' },
        decision_making: { decision_maker: true },
      },
    }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.status).toBe('completed')
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      contact_submission_id: 42,
      status: 'completed',
      business_name: 'Northstar',
      business_challenges: { primary: 'follow-up' },
      tech_stack: { crm: 'sheet' },
      automation_needs: { priority: 'routing' },
      ai_readiness: { score: 3 },
      budget_timeline: { range: 'low' },
      decision_making: { decision_maker: true },
      completed_at: FIXED_NOW.toISOString(),
      started_at: FIXED_NOW.toISOString(),
    }))
  })

  it('writes an explicit null status instead of the in-progress default', async () => {
    await POST(makeRequest({
      sales_session_id: 'sess-9',
      status: null,
    }))

    const inserted = mocks.insert.mock.calls[0][0]
    expect(inserted.status).toBeNull()
    expect(inserted).not.toHaveProperty('completed_at')
  })

  it('persists an unrecognized status without marking the audit complete', async () => {
    const response = await POST(makeRequest({
      sales_session_id: 'sess-9',
      status: 'archived',
    }))

    expect((await response.json()).status).toBe('archived')
    const inserted = mocks.insert.mock.calls[0][0]
    expect(inserted.status).toBe('archived')
    expect(inserted).not.toHaveProperty('completed_at')
  })

  it('returns the database message and does not link the session when insert fails', async () => {
    mocks.insert.mockResolvedValue({ error: { message: 'duplicate key' } })

    const response = await POST(makeRequest({ sales_session_id: 'sess-9' }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'duplicate key' })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('still returns the audit when linking the sales session fails', async () => {
    mocks.eq.mockResolvedValue({ error: { message: 'session missing' } })

    const response = await POST(makeRequest({ sales_session_id: 'sess-9' }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.auditId).toBe(mocks.insert.mock.calls[0][0].id)
    expect(body.sessionId).toContain('in-person-sess-9-')
  })

  it('returns a generic failure for invalid JSON', async () => {
    const response = await POST(makeRequest('{'))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to create diagnostic' })
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('returns a generic failure when the admin client is unavailable', async () => {
    mocks.admin = null

    const response = await POST(makeRequest({ sales_session_id: 'sess-9' }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to create diagnostic' })
  })
})
