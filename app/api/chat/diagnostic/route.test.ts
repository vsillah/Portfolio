import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getDiagnosticAudit: vi.fn(),
  getDiagnosticAuditBySession: vi.fn(),
  saveDiagnosticAudit: vi.fn(),
}))

vi.mock('@/lib/diagnostic', () => ({
  getDiagnosticAudit: mocks.getDiagnosticAudit,
  getDiagnosticAuditBySession: mocks.getDiagnosticAuditBySession,
  saveDiagnosticAudit: mocks.saveDiagnosticAudit,
}))

import { GET, PUT } from './route'

function makeGet(query = '') {
  return new NextRequest(`http://localhost/api/chat/diagnostic${query}`)
}

function makePut(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/chat/diagnostic', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const auditRow = {
  id: '42',
  session_id: 'session01',
  contact_submission_id: null,
  audit_type: 'chat',
  source_meeting_ids: [],
  status: 'in_progress',
  current_category: 'tech_stack',
  questions_asked: ['q1'],
  responses_received: { q1: 'a1' },
  business_challenges: { primary_challenges: ['manual_processes'] },
  tech_stack: {},
  automation_needs: {},
  ai_readiness: {},
  agent_readiness: {},
  agent_readiness_assessment: null,
  budget_timeline: {},
  decision_making: {},
  diagnostic_summary: null,
  key_insights: [],
  recommended_actions: [],
  urgency_score: null,
  opportunity_score: null,
  sales_notes: null,
  started_at: '2026-09-01T00:00:00.000Z',
  completed_at: null,
  updated_at: '2026-09-01T00:00:00.000Z',
  business_name: 'Ada Co',
  website_url: null,
  contact_email: 'ada@example.com',
  industry_slug: null,
  industry_gics_code: null,
  enriched_tech_stack: null,
  value_estimate: null,
  report_tier: 'bronze',
}

describe('GET /api/chat/diagnostic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('requires sessionId or auditId', async () => {
    const response = await GET(makeGet())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid request' })
    expect(mocks.getDiagnosticAudit).not.toHaveBeenCalled()
    expect(mocks.getDiagnosticAuditBySession).not.toHaveBeenCalled()
  })

  it('returns audit null when no diagnostic exists for the session', async () => {
    mocks.getDiagnosticAuditBySession.mockResolvedValue({ data: null, error: null })

    const response = await GET(makeGet('?sessionId=session01'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ audit: null })
    expect(mocks.getDiagnosticAuditBySession).toHaveBeenCalledWith('session01')
  })

  it('looks up by numeric audit id and maps the public audit shape', async () => {
    mocks.getDiagnosticAudit.mockResolvedValue({ data: auditRow, error: null })

    const response = await GET(makeGet('?auditId=42'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.getDiagnosticAudit).toHaveBeenCalledWith('42')
    expect(body.audit).toMatchObject({
      id: '42',
      sessionId: 'session01',
      status: 'in_progress',
      currentCategory: 'tech_stack',
      contactEmail: 'ada@example.com',
      reportTier: 'bronze',
    })
  })
})

describe('PUT /api/chat/diagnostic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getDiagnosticAudit.mockResolvedValue({ data: auditRow, error: null })
    mocks.saveDiagnosticAudit.mockResolvedValue({ id: '42', error: null })
  })

  it('rejects an invalid audit id before loading the row', async () => {
    const response = await PUT(makePut({ auditId: 'not-valid', status: 'in_progress' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid request' })
    expect(mocks.getDiagnosticAudit).not.toHaveBeenCalled()
  })

  it('returns 404 when the diagnostic audit is missing', async () => {
    mocks.getDiagnosticAudit.mockResolvedValue({ data: null, error: null })

    const response = await PUT(makePut({ auditId: '42', status: 'abandoned' }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Diagnostic audit not found' })
    expect(mocks.saveDiagnosticAudit).not.toHaveBeenCalled()
  })

  it('saves status and business name onto the session audit', async () => {
    const response = await PUT(makePut({
      auditId: '42',
      status: 'in_progress',
      businessName: 'Ada Advisory',
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, auditId: '42' })
    expect(mocks.saveDiagnosticAudit).toHaveBeenCalledWith('session01', {
      diagnosticAuditId: '42',
      status: 'in_progress',
      currentCategory: undefined,
      progress: undefined,
      diagnosticData: undefined,
      businessName: 'Ada Advisory',
    })
  })
})
