import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => {
  class MockAuditFromMeetingsError extends Error {
    constructor(
      message: string,
      public readonly code:
        | 'budget_blocked'
        | 'openai_not_configured'
        | 'openai_upstream'
        | 'invalid_response',
    ) {
      super(message)
      this.name = 'AuditFromMeetingsError'
    }
  }

  return {
    AuditFromMeetingsError: MockAuditFromMeetingsError,
    verifyAdmin: vi.fn(),
    isAuthError: vi.fn(),
    buildDiagnosticFromMeetings: vi.fn(),
    saveDiagnosticAudit: vi.fn(),
    from: vi.fn(),
    startAgentRun: vi.fn(),
    recordAgentStep: vi.fn(),
    endAgentRun: vi.fn(),
    markAgentRunFailed: vi.fn(),
  }
})

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/diagnostic', () => ({
  saveDiagnosticAudit: mocks.saveDiagnosticAudit,
}))

vi.mock('@/lib/audit-from-meetings', () => ({
  AuditFromMeetingsError: mocks.AuditFromMeetingsError,
  buildDiagnosticFromMeetings: mocks.buildDiagnosticFromMeetings,
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  recordAgentStep: mocks.recordAgentStep,
  endAgentRun: mocks.endAgentRun,
  markAgentRunFailed: mocks.markAgentRunFailed,
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/audit-from-meetings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/audit-from-meetings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({
      user: { id: 'admin-user-1' },
      isAdmin: true,
    })
    mocks.isAuthError.mockReturnValue(false)
    mocks.startAgentRun.mockResolvedValue({ id: 'agent-run-1' })
    mocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
    mocks.endAgentRun.mockResolvedValue(undefined)
    mocks.markAgentRunFailed.mockResolvedValue(undefined)
    mocks.from.mockImplementation((table: string) => {
      if (table === 'chat_sessions') {
        return {
          insert: vi.fn(() => Promise.resolve({ error: null })),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })
    mocks.buildDiagnosticFromMeetings.mockResolvedValue({
      meetings: [{ id: 'meeting-1' }],
      combinedText: 'meeting transcript',
      extracted: {
        business_challenges: {},
        tech_stack: {},
        automation_needs: {},
        ai_readiness: {},
        budget_timeline: {},
        decision_making: {},
        diagnostic_summary: 'Summary',
      },
    })
    mocks.saveDiagnosticAudit.mockResolvedValue({
      id: 'audit-1',
      error: null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requires admin auth before starting an agent run', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({ contact_submission_id: 42 }))

    expect(response.status).toBe(401)
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('starts a trace, passes agentRunId to extraction, and returns it', async () => {
    const response = await POST(makeRequest({ contact_submission_id: 42 }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      auditId: 'audit-1',
      sessionId: expect.stringMatching(/^meetings_42_/),
      meetingsUsed: 1,
      agentRunId: 'agent-run-1',
    })
    expect(mocks.startAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agentKey: 'manual-admin',
        runtime: 'manual',
        kind: 'audit_from_meetings',
        triggerSource: 'admin:audit_from_meetings',
        triggeredByUserId: 'admin-user-1',
      }),
    )
    expect(mocks.buildDiagnosticFromMeetings).toHaveBeenCalledWith(
      42,
      undefined,
      { agentRunId: 'agent-run-1' },
    )
    expect(mocks.endAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        status: 'completed',
        outcome: expect.objectContaining({
          audit_id: 'audit-1',
          meetings_used: 1,
        }),
      }),
    )
  })

  it('marks the trace failed and returns a safe message when budget blocks extraction', async () => {
    mocks.buildDiagnosticFromMeetings.mockRejectedValue(
      new mocks.AuditFromMeetingsError('Estimated cost exceeds cap.', 'budget_blocked'),
    )

    const response = await POST(makeRequest({ contact_submission_id: 42 }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error:
        'This meeting audit is over the current Agent Ops budget limit. Use fewer meetings or shorten the transcripts before retrying.',
    })
    expect(mocks.markAgentRunFailed).toHaveBeenCalledWith(
      'agent-run-1',
      'Estimated cost exceeds cap.',
      expect.objectContaining({ contact_submission_id: 42 }),
    )
  })
})
