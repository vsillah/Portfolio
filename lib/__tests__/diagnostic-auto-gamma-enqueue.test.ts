/**
 * Regression: standalone audit final PUT often omits contactSubmissionId when the contact
 * was linked on an earlier step. saveDiagnosticAudit must still enqueue audit_summary Gamma;
 * the worker reads contact_submission_id from the DB (prod incident: contact had audits, zero gamma_reports).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  enqueueAuditSummaryGamma: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('../auto-audit-summary-gamma', () => ({
  enqueueAuditSummaryGamma: mocks.enqueueAuditSummaryGamma,
}))

vi.mock('../supabase', () => ({
  supabaseAdmin: {
    from: mocks.mockFrom,
  },
}))

import { saveDiagnosticAudit } from '../diagnostic'

const minimalDiagnosticData = {
  business_challenges: { pain: 'x' },
  tech_stack: {},
  automation_needs: {},
  ai_readiness: {},
  budget_timeline: {},
  decision_making: {},
}

/** Minimal supabaseAdmin.from mock: diagnostic_audits update + optional contact_submissions select for tech stack. */
function setupSupabaseMock(auditId: string) {
  mocks.mockFrom.mockImplementation((table: string) => {
    if (table === 'contact_submissions') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { website_tech_stack: null },
              error: null,
            }),
          }),
        }),
      }
    }
    if (table === 'diagnostic_audits') {
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: auditId }, error: null }),
            }),
          }),
        }),
      }
    }
    throw new Error(`Unexpected supabaseAdmin.from('${table}') in test`)
  })
}

describe('saveDiagnosticAudit → enqueueAuditSummaryGamma', () => {
  beforeEach(() => {
    mocks.enqueueAuditSummaryGamma.mockClear()
    mocks.mockFrom.mockReset()
  })

  it('enqueues on completed when contactSubmissionId is omitted (contact linked on prior save)', async () => {
    const auditId = 'audit-standalone-final'
    setupSupabaseMock(auditId)

    const result = await saveDiagnosticAudit('sess-standalone-1', {
      diagnosticAuditId: auditId,
      status: 'completed',
      diagnosticData: minimalDiagnosticData,
      auditType: 'standalone',
    })

    expect(result.error).toBeUndefined()
    expect(result.id).toBe(auditId)

    await vi.waitFor(() => {
      expect(mocks.enqueueAuditSummaryGamma).toHaveBeenCalledWith(auditId)
    })
  })

  it('still enqueues once when contactSubmissionId is present on completion', async () => {
    const auditId = 'audit-with-contact-in-payload'
    setupSupabaseMock(auditId)

    await saveDiagnosticAudit('sess-2', {
      diagnosticAuditId: auditId,
      status: 'completed',
      contactSubmissionId: 13645,
      diagnosticData: minimalDiagnosticData,
      auditType: 'standalone',
    })

    await vi.waitFor(() => {
      expect(mocks.enqueueAuditSummaryGamma).toHaveBeenCalledTimes(1)
      expect(mocks.enqueueAuditSummaryGamma).toHaveBeenCalledWith(auditId)
    })
  })

  it('does not enqueue when status is in_progress', async () => {
    const auditId = 'audit-in-progress'
    setupSupabaseMock(auditId)

    await saveDiagnosticAudit('sess-3', {
      diagnosticAuditId: auditId,
      status: 'in_progress',
      diagnosticData: minimalDiagnosticData,
    })

    await new Promise((r) => setImmediate(r))
    expect(mocks.enqueueAuditSummaryGamma).not.toHaveBeenCalled()
  })
})
