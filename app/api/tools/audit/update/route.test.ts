import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { AUDIT_CATEGORY_ORDER } from '@/lib/audit-questions'

const mocks = vi.hoisted(() => ({
  getDiagnosticAudit: vi.fn(),
  saveDiagnosticAudit: vi.fn(),
  tryVerifyAuth: vi.fn(),
  getAuthUserPrimaryEmail: vi.fn(),
  findOrCreateContactByEmail: vi.fn(),
  triggerDiagnosticCompletionWebhook: vi.fn(),
  computeReportTier: vi.fn(),
  buildAgentReadinessAssessment: vi.fn(),
}))

vi.mock('@/lib/diagnostic', () => ({
  getDiagnosticAudit: mocks.getDiagnosticAudit,
  saveDiagnosticAudit: mocks.saveDiagnosticAudit,
}))

vi.mock('@/lib/auth-server', () => ({
  tryVerifyAuth: mocks.tryVerifyAuth,
}))

vi.mock('@/lib/auth-user-email', () => ({
  getAuthUserPrimaryEmail: mocks.getAuthUserPrimaryEmail,
}))

vi.mock('@/lib/find-or-create-contact', () => ({
  findOrCreateContactByEmail: mocks.findOrCreateContactByEmail,
}))

vi.mock('@/lib/n8n', () => ({
  triggerDiagnosticCompletionWebhook: mocks.triggerDiagnosticCompletionWebhook,
}))

vi.mock('@/lib/audit-report-tier', () => ({
  computeReportTier: mocks.computeReportTier,
}))

vi.mock('@/lib/agent-readiness-assessment', () => ({
  buildAgentReadinessAssessment: mocks.buildAgentReadinessAssessment,
}))

import { PUT } from './route'

function makeRequest(body: Record<string, unknown>, ip: string) {
  return new NextRequest('http://localhost/api/tools/audit/update', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  })
}

function emptyCategoryMap() {
  return Object.fromEntries(AUDIT_CATEGORY_ORDER.map((category) => [category, {}]))
}

function filledAudit(overrides: Record<string, unknown> = {}) {
  return {
    id: 'audit-1',
    session_id: 'audit_session_1',
    contact_submission_id: null,
    contact_email: null,
    business_name: 'Ada Co',
    website_url: null,
    ...emptyCategoryMap(),
    ...overrides,
  }
}

describe('PUT /api/tools/audit/update', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.tryVerifyAuth.mockResolvedValue(null)
    mocks.saveDiagnosticAudit.mockResolvedValue({ id: 'audit-1', error: null })
    mocks.computeReportTier.mockReturnValue({ tier: 'silver' })
    mocks.buildAgentReadinessAssessment.mockReturnValue({ score: 1 })
    mocks.triggerDiagnosticCompletionWebhook.mockResolvedValue({ triggered: true })
  })

  it('requires auditId, category, and values', async () => {
    const response = await PUT(makeRequest({ auditId: 'audit-1' }, 'audit-update-ip-missing'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'auditId, category, and values are required',
    })
    expect(mocks.getDiagnosticAudit).not.toHaveBeenCalled()
  })

  it('rejects an unknown category', async () => {
    const response = await PUT(makeRequest({
      auditId: 'audit-1',
      category: 'not_a_category',
      values: { crm: 'hubspot' },
    }, 'audit-update-ip-invalid-category'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid category' })
    expect(mocks.getDiagnosticAudit).not.toHaveBeenCalled()
  })

  it('returns 404 when the audit is missing', async () => {
    mocks.getDiagnosticAudit.mockResolvedValue({ data: null })

    const response = await PUT(makeRequest({
      auditId: 'audit-1',
      category: 'tech_stack',
      values: { crm: 'hubspot' },
    }, 'audit-update-ip-missing-audit'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Audit not found' })
  })

  it('rejects values that map to an empty category payload', async () => {
    mocks.getDiagnosticAudit.mockResolvedValue({ data: filledAudit() })

    const response = await PUT(makeRequest({
      auditId: 'audit-1',
      category: 'tech_stack',
      values: { crm: '' },
    }, 'audit-update-ip-empty-values'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'No valid values for this category' })
    expect(mocks.saveDiagnosticAudit).not.toHaveBeenCalled()
  })

  it('saves an in-progress category update without completing', async () => {
    mocks.getDiagnosticAudit.mockResolvedValue({ data: filledAudit() })

    const response = await PUT(makeRequest({
      auditId: 'audit-1',
      category: 'tech_stack',
      values: { crm: 'hubspot' },
    }, 'audit-update-ip-in-progress'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true, auditId: 'audit-1', completed: false })
    expect(mocks.saveDiagnosticAudit).toHaveBeenCalledWith(
      'audit_session_1',
      expect.objectContaining({
        diagnosticAuditId: 'audit-1',
        status: 'in_progress',
      }),
    )
    expect(mocks.triggerDiagnosticCompletionWebhook).not.toHaveBeenCalled()
  })

  it('blocks completion when no contact email or submission is linked', async () => {
    const populated = Object.fromEntries(AUDIT_CATEGORY_ORDER.map((category) => [category, { filled: true }]))
    mocks.getDiagnosticAudit.mockResolvedValue({
      data: filledAudit({
        ...populated,
        contact_submission_id: null,
        contact_email: null,
      }),
    })

    const response = await PUT(makeRequest({
      auditId: 'audit-1',
      category: 'tech_stack',
      values: { crm: 'hubspot' },
    }, 'audit-update-ip-complete-no-email'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Email is required to complete the audit. Please provide your email in the first step or sign in.',
    })
    expect(mocks.saveDiagnosticAudit).not.toHaveBeenCalled()
    expect(mocks.findOrCreateContactByEmail).not.toHaveBeenCalled()
  })

  it('completes the audit when a contact submission already exists', async () => {
    const populated = Object.fromEntries(AUDIT_CATEGORY_ORDER.map((category) => [category, { filled: true }]))
    mocks.getDiagnosticAudit.mockResolvedValue({
      data: filledAudit({
        ...populated,
        contact_submission_id: 'contact-9',
        contact_email: 'ada@example.com',
      }),
    })

    const response = await PUT(makeRequest({
      auditId: 'audit-1',
      category: 'budget_timeline',
      values: { budget_range: 'large' },
    }, 'audit-update-ip-complete'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true, auditId: 'audit-1', completed: true })
    expect(mocks.saveDiagnosticAudit).toHaveBeenCalledWith(
      'audit_session_1',
      expect.objectContaining({
        status: 'completed',
        reportTier: 'silver',
      }),
    )
    expect(mocks.findOrCreateContactByEmail).not.toHaveBeenCalled()
    expect(mocks.triggerDiagnosticCompletionWebhook).toHaveBeenCalled()
  })

  it('returns 429 after five hits from the same IP', async () => {
    mocks.getDiagnosticAudit.mockResolvedValue({ data: filledAudit() })
    const ip = 'audit-update-ip-rate-limit'
    const body = {
      auditId: 'audit-1',
      category: 'tech_stack',
      values: { crm: 'hubspot' },
    }

    for (let i = 0; i < 5; i++) {
      const response = await PUT(makeRequest(body, ip))
      expect(response.status).not.toBe(429)
    }

    const blocked = await PUT(makeRequest(body, ip))
    expect(blocked.status).toBe(429)
    await expect(blocked.json()).resolves.toEqual({
      error: 'Too many requests. Please try again later.',
    })
  })
})
