import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

import { POST } from './route'

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/outreach/gmail-response-import/dry-run', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const portfolioRows = {
  contacts: [
    {
      id: 42,
      name: 'Ada Operator',
      email: 'ada@example.com',
      do_not_contact: false,
      removed_at: null,
      warm_source_detail: 'Prior local relationship context.',
    },
  ],
  outreachQueue: [
    {
      id: 'queue-42',
      contact_submission_id: 42,
      channel: 'email',
      subject: 'Warm follow-up',
      status: 'sent',
      thread_id: 'gmail-thread-42',
      sent_at: '2026-08-27T12:00:00.000Z',
    },
  ],
  contactCommunications: [],
  emailMessages: [],
  actionTasks: [],
}

const reply = {
  threadId: 'gmail-thread-42',
  messageId: 'gmail-reply-99',
  from: 'Ada Operator <ada@example.com>',
  to: ['vambah@amadutown.com'],
  subject: 'Re: Warm follow-up',
  text: 'Interested. Can we schedule a quick review?',
  receivedAt: '2026-08-28T10:00:00.000Z',
}

describe('POST /api/admin/outreach/gmail-response-import/dry-run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('plans mocked Gmail reply import without external actions or database writes', async () => {
    const response = await POST(request({
      replies: [reply],
      portfolioRows,
    }))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.executionBoundary).toEqual({
      localRowsOnly: true,
      dryRun: true,
      liveProviderImportEnabled: false,
      providerPollingEnabled: false,
      gmailApiCalled: false,
      externalActionsEnabled: false,
      gmailDraftCreationEnabled: false,
      gmailSendEnabled: false,
      slackDispatchEnabled: false,
      n8nDispatchEnabled: false,
      databaseWritesEnabled: false,
    })
    expect(json.plan).toMatchObject({
      version: 'warm-outreach-gmail-response-import/v1',
      state: 'dry_run_ready',
      liveProviderImportEnabled: false,
      gmailApiCalled: false,
      summary: {
        readyForReview: 1,
      },
      activationReadiness: {
        state: 'ready_for_mock_import',
        canRunMockImport: true,
        canRunLiveImport: false,
        gmailApiCalled: false,
        databaseWritesEnabled: false,
      },
    })
    expect(json.plan.candidates[0]).toMatchObject({
      status: 'ready_for_review',
      matchedContactId: 42,
      matchedOutreachQueueId: 'queue-42',
      localEvidence: {
        sourceId: 'warm-outreach:reply:gmail:gmail-thread-42:gmail-reply-99',
        externalActionsEnabled: false,
      },
    })
  })

  it('rejects non-dry-run import requests', async () => {
    const response = await POST(request({
      dryRun: false,
      replies: [reply],
      portfolioRows,
    }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Only dry-run Gmail response import planning is enabled.',
    })
  })

  it('rejects live provider import and polling requests', async () => {
    const response = await POST(request({
      replies: [reply],
      portfolioRows,
      liveProviderImportEnabled: true,
    }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Live Gmail response import and provider polling are disabled for this route.',
    })
  })

  it('returns no-payload readiness without requiring live Gmail access', async () => {
    const response = await POST(request({
      replies: [],
      portfolioRows,
      gmailProviderReadiness: {
        providerConfigured: false,
      },
    }))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.plan).toMatchObject({
      state: 'blocked',
      candidates: [],
      summary: {
        total: 0,
      },
      activationReadiness: {
        state: 'provider_missing',
        canRunMockImport: true,
        canRunLiveImport: false,
        providerConfigured: false,
        gmailApiCalled: false,
        databaseWritesEnabled: false,
      },
    })
  })

  it('reports missing Gmail readonly scope from supplied readiness metadata', async () => {
    const response = await POST(request({
      replies: [reply],
      portfolioRows,
      gmailProviderReadiness: {
        providerConfigured: true,
        gmailTokenAvailable: true,
        grantedScopes: [
          'https://www.googleapis.com/auth/gmail.compose',
          'https://www.googleapis.com/auth/userinfo.email',
        ],
      },
    }))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.plan.activationReadiness).toMatchObject({
      state: 'missing_gmail_scope',
      missingScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      canRunMockImport: true,
      canRunLiveImport: false,
    })
  })

  it('returns provider-disabled planning when the dry-run planner is disabled', async () => {
    const response = await POST(request({
      replies: [reply],
      portfolioRows,
      dryRunImportEnabled: false,
    }))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.plan).toMatchObject({
      state: 'provider_disabled',
      summary: {
        providerDisabled: 1,
      },
      gmailApiCalled: false,
      externalActionsEnabled: false,
      slackDispatchEnabled: false,
      n8nDispatchEnabled: false,
      activationReadiness: {
        state: 'provider_disabled',
        canRunMockImport: false,
        canRunLiveImport: false,
      },
    })
    expect(json.plan.candidates[0]).toMatchObject({
      status: 'provider_disabled',
      captureRequest: null,
      localEvidence: null,
    })
  })
})
