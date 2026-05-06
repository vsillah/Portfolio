import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => {
  class MockLeadFromMeetingError extends Error {
    constructor(
      message: string,
      public readonly code:
        | 'budget_blocked'
        | 'openai_not_configured'
        | 'openai_upstream'
        | 'invalid_response',
    ) {
      super(message)
      this.name = 'LeadFromMeetingError'
    }
  }

  return {
    LeadFromMeetingError: MockLeadFromMeetingError,
    verifyAdmin: vi.fn(),
    isAuthError: vi.fn(),
    extractLeadFieldsFromMeeting: vi.fn(),
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

vi.mock('@/lib/lead-from-meeting', () => ({
  LeadFromMeetingError: mocks.LeadFromMeetingError,
  extractLeadFieldsFromMeeting: mocks.extractLeadFieldsFromMeeting,
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  recordAgentStep: mocks.recordAgentStep,
  endAgentRun: mocks.endAgentRun,
  markAgentRunFailed: mocks.markAgentRunFailed,
}))

import { POST } from './route'

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/meetings/meeting-1/extract-lead-fields', {
    method: 'POST',
  })
}

describe('POST /api/admin/meetings/[id]/extract-lead-fields', () => {
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
    mocks.extractLeadFieldsFromMeeting.mockResolvedValue({
      meeting: {
        id: 'meeting-1',
        meeting_type: 'discovery',
        meeting_date: '2026-05-06',
      },
      extracted: {
        name: 'Jane Prospect',
        company: 'Acme Co',
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requires admin auth before starting an agent run', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(), { params: { id: 'meeting-1' } })

    expect(response.status).toBe(401)
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('starts a trace, passes agentRunId to extraction, and returns it', async () => {
    const response = await POST(makeRequest(), { params: { id: 'meeting-1' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      meeting: {
        id: 'meeting-1',
        meeting_type: 'discovery',
        meeting_date: '2026-05-06',
      },
      fields: {
        name: 'Jane Prospect',
        company: 'Acme Co',
      },
      agentRunId: 'agent-run-1',
    })
    expect(mocks.startAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agentKey: 'manual-admin',
        runtime: 'manual',
        kind: 'meeting_lead_extraction',
        triggerSource: 'admin:meeting_extract_lead_fields',
        triggeredByUserId: 'admin-user-1',
      }),
    )
    expect(mocks.extractLeadFieldsFromMeeting).toHaveBeenCalledWith('meeting-1', {
      agentRunId: 'agent-run-1',
    })
    expect(mocks.endAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        status: 'completed',
      }),
    )
  })

  it('marks the trace failed and returns a safe message when budget blocks extraction', async () => {
    mocks.extractLeadFieldsFromMeeting.mockRejectedValue(
      new mocks.LeadFromMeetingError('Estimated cost exceeds cap.', 'budget_blocked'),
    )

    const response = await POST(makeRequest(), { params: { id: 'meeting-1' } })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error:
        'This meeting transcript is over the current Agent Ops budget limit. Shorten the transcript or split the extraction before retrying.',
    })
    expect(mocks.markAgentRunFailed).toHaveBeenCalledWith(
      'agent-run-1',
      'Estimated cost exceeds cap.',
      { meeting_record_id: 'meeting-1' },
    )
  })
})
