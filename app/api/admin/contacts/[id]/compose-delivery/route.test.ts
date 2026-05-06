import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => {
  class MockDeliveryDraftError extends Error {
    constructor(
      message: string,
      public readonly code:
        | 'openai_not_configured'
        | 'openai_upstream'
        | 'invalid_response'
        | 'budget_blocked',
    ) {
      super(message)
      this.name = 'DeliveryDraftError'
    }
  }

  return {
    DeliveryDraftError: MockDeliveryDraftError,
    verifyAdmin: vi.fn(),
    isAuthError: vi.fn(),
    generateDeliveryDraft: vi.fn(),
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
    from: vi.fn(),
  },
}))

vi.mock('@/lib/delivery-email', () => ({
  DeliveryDraftError: mocks.DeliveryDraftError,
  generateDeliveryDraft: mocks.generateDeliveryDraft,
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  recordAgentStep: mocks.recordAgentStep,
  endAgentRun: mocks.endAgentRun,
  markAgentRunFailed: mocks.markAgentRunFailed,
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/contacts/42/compose-delivery', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/contacts/[id]/compose-delivery', () => {
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
    mocks.generateDeliveryDraft.mockResolvedValue({
      subject: 'Delivery draft',
      body: 'Here are the resources.',
      dashboardUrl: null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requires admin auth before starting an agent run', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({}), { params: { id: '42' } })

    expect(response.status).toBe(401)
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('starts a trace, passes agentRunId to the draft generator, and returns it', async () => {
    const response = await POST(
      makeRequest({
        assetIds: [{ type: 'gamma_report', id: 'gamma-1' }],
        templateKey: 'email_asset_delivery',
        includeDashboardLink: false,
      }),
      { params: { id: '42' } },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      subject: 'Delivery draft',
      body: 'Here are the resources.',
      dashboardUrl: null,
      agentRunId: 'agent-run-1',
    })
    expect(mocks.startAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agentKey: 'manual-admin',
        runtime: 'manual',
        kind: 'delivery_email_draft',
        triggerSource: 'admin:compose_delivery',
        triggeredByUserId: 'admin-user-1',
      }),
    )
    expect(mocks.generateDeliveryDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 42,
        agentRunId: 'agent-run-1',
        templateKey: 'email_asset_delivery',
      }),
    )
    expect(mocks.endAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        status: 'completed',
      }),
    )
  })

  it('marks the trace failed and returns a safe message when budget blocks generation', async () => {
    mocks.generateDeliveryDraft.mockRejectedValue(
      new mocks.DeliveryDraftError('Estimated cost exceeds cap.', 'budget_blocked'),
    )

    const response = await POST(
      makeRequest({ includeDashboardLink: false }),
      { params: { id: '42' } },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error:
        'This delivery draft is over the current Agent Ops budget limit. Reduce the prompt, asset set, or model size before retrying.',
    })
    expect(mocks.markAgentRunFailed).toHaveBeenCalledWith(
      'agent-run-1',
      'Estimated cost exceeds cap.',
      expect.objectContaining({ contact_id: 42 }),
    )
  })
})
