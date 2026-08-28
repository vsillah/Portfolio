import { describe, expect, it } from 'vitest'

import {
  buildWarmOutreachGmailResponseImportActivationReadiness,
  planWarmOutreachGmailResponseImport,
  type WarmOutreachGmailImportPortfolioRows,
  type WarmOutreachGmailReplyPayload,
} from './warm-outreach-gmail-response-import'

const baseRows: WarmOutreachGmailImportPortfolioRows = {
  contacts: [
    {
      id: 42,
      name: 'Ada Operator',
      email: 'ada@example.com',
      do_not_contact: false,
      removed_at: null,
      relationship_strength: 'warm',
      warm_source_detail: 'Prior Portfolio meeting context.',
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
      message_id: 'gmail-original-42',
      sent_at: '2026-08-27T12:00:00.000Z',
    },
  ],
  contactCommunications: [],
  emailMessages: [],
  actionTasks: [],
}

const reply: WarmOutreachGmailReplyPayload = {
  provider: 'gmail',
  threadId: 'gmail-thread-42',
  messageId: 'gmail-reply-99',
  from: 'Ada Operator <ada@example.com>',
  to: ['vambah@amadutown.com'],
  subject: 'Re: Warm follow-up',
  text: 'Interested. Can we schedule a quick review?',
  receivedAt: '2026-08-28T10:00:00.000Z',
}

describe('warm outreach Gmail response import planner', () => {
  it('matches a mocked Gmail reply to a tracked warm outreach queue row', () => {
    const plan = planWarmOutreachGmailResponseImport({
      replies: [reply],
      rows: baseRows,
    })

    expect(plan).toMatchObject({
      state: 'dry_run_ready',
      dryRun: true,
      liveProviderImportEnabled: false,
      providerPollingEnabled: false,
      gmailApiCalled: false,
      externalActionsEnabled: false,
      gmailDraftCreationEnabled: false,
      slackDispatchEnabled: false,
      n8nDispatchEnabled: false,
      summary: {
        readyForReview: 1,
      },
    })
    expect(plan.candidates[0]).toMatchObject({
      status: 'ready_for_review',
      confidence: 'high',
      matchedContactId: 42,
      matchedOutreachQueueId: 'queue-42',
      normalizedRecipient: 'ada@example.com',
      providerThreadId: 'gmail-thread-42',
      providerMessageId: 'gmail-reply-99',
      matchSignals: expect.arrayContaining([
        'gmail_thread_id',
        'normalized_recipient',
        'subject_fingerprint',
      ]),
      captureRequest: {
        contactId: 42,
        channel: 'email',
        sourceType: 'gmail',
        provider: 'gmail',
        outreachQueueId: 'queue-42',
      },
      localEvidence: {
        table: 'contact_communications',
        sourceSystem: 'manual',
        lifecycle: 'warm_outreach_response',
        provider: 'gmail',
        providerThreadId: 'gmail-thread-42',
        providerMessageId: 'gmail-reply-99',
        externalActionsEnabled: false,
      },
      decision: {
        responseClass: 'interested',
        executionBoundary: {
          providerIngestionEnabled: false,
          externalMonitoringEnabled: false,
          gmailDraftCreationEnabled: false,
          slackActionEnabled: false,
        },
      },
    })
    expect(plan.candidates[0].localEvidence?.sourceId).toBe(
      'warm-outreach:reply:gmail:gmail-thread-42:gmail-reply-99',
    )
    expect(plan.activationReadiness).toMatchObject({
      state: 'ready_for_mock_import',
      canRunMockImport: true,
      canRunLiveImport: false,
      gmailApiCalled: false,
      databaseWritesEnabled: false,
    })
  })

  it('blocks duplicate replay by Gmail provider message id', () => {
    const plan = planWarmOutreachGmailResponseImport({
      replies: [reply],
      rows: {
        ...baseRows,
        contactCommunications: [
          {
            id: 'comm-existing',
            contact_submission_id: 42,
            source_id: 'warm-outreach:reply:gmail:gmail-thread-42:gmail-reply-99',
            message_type: 'reply',
            status: 'replied',
            metadata: {
              lifecycle: 'warm_outreach_response',
              provider: 'gmail',
              provider_thread_id: 'gmail-thread-42',
              provider_message_id: 'gmail-reply-99',
            },
          },
        ],
      },
    })

    expect(plan.candidates[0]).toMatchObject({
      status: 'duplicate_replay',
      localEvidence: null,
      captureRequest: null,
      blockers: expect.arrayContaining([
        'Existing Gmail response evidence already matches this provider message.',
      ]),
    })
    expect(plan.summary.duplicateReplay).toBe(1)
    expect(plan.activationReadiness).toMatchObject({
      state: 'blocked_manual_recovery',
      canRunMockImport: false,
      blockedReasons: expect.arrayContaining([
        'Existing Gmail response evidence already matches this provider message.',
      ]),
    })
  })

  it('routes unmatched replies to manual recovery', () => {
    const plan = planWarmOutreachGmailResponseImport({
      replies: [{
        ...reply,
        threadId: 'untracked-thread',
        messageId: 'gmail-unmatched-1',
        from: 'unknown@example.com',
        subject: 'Re: Something else',
      }],
      rows: baseRows,
    })

    expect(plan.candidates[0]).toMatchObject({
      status: 'unmatched_manual_review',
      confidence: 'none',
      matchedContactId: null,
      matchedOutreachQueueId: null,
      captureRequest: null,
      localEvidence: null,
      recoveryPath: expect.stringContaining('queue id'),
    })
    expect(plan.summary.unmatched).toBe(1)
  })

  it('fails closed when more than one queue row can match the reply', () => {
    const plan = planWarmOutreachGmailResponseImport({
      replies: [reply],
      rows: {
        ...baseRows,
        outreachQueue: [
          ...baseRows.outreachQueue!,
          {
            id: 'queue-ambiguous',
            contact_submission_id: 42,
            channel: 'email',
            subject: 'Warm follow-up',
            status: 'sent',
            thread_id: 'gmail-thread-42',
            sent_at: '2026-08-27T12:05:00.000Z',
          },
        ],
      },
    })

    expect(plan.candidates[0]).toMatchObject({
      status: 'ambiguous_manual_review',
      matchedContactId: null,
      matchedOutreachQueueId: null,
      captureRequest: null,
      blockers: expect.arrayContaining([
        'Multiple warm outreach queue rows match this Gmail reply.',
      ]),
    })
    expect(plan.summary.ambiguous).toBe(1)
  })

  it('blocks suppressed contacts before producing import evidence', () => {
    const plan = planWarmOutreachGmailResponseImport({
      replies: [reply],
      rows: {
        ...baseRows,
        contacts: [{ ...baseRows.contacts![0], do_not_contact: true }],
      },
    })

    expect(plan.candidates[0]).toMatchObject({
      status: 'blocked_suppressed',
      captureRequest: null,
      localEvidence: null,
      blockers: expect.arrayContaining([
        'Contact is marked do not contact in Portfolio.',
      ]),
    })
    expect(plan.summary.suppressed).toBe(1)
  })

  it('blocks a matched queue row that already has response evidence', () => {
    const plan = planWarmOutreachGmailResponseImport({
      replies: [reply],
      rows: {
        ...baseRows,
        outreachQueue: [{
          ...baseRows.outreachQueue![0],
          status: 'replied',
          replied_at: '2026-08-28T10:01:00.000Z',
          reply_content: 'Interested.',
        }],
      },
    })

    expect(plan.candidates[0]).toMatchObject({
      status: 'blocked_existing_response',
      captureRequest: null,
      localEvidence: null,
      blockers: expect.arrayContaining(['Matched queue already has replied evidence.']),
    })
    expect(plan.summary.existingResponse).toBe(1)
  })

  it('exposes a provider-disabled state without calling Gmail or providers', () => {
    const plan = planWarmOutreachGmailResponseImport({
      replies: [reply],
      rows: baseRows,
      dryRunImportEnabled: false,
    })

    expect(plan).toMatchObject({
      state: 'provider_disabled',
      liveProviderImportEnabled: false,
      providerPollingEnabled: false,
      gmailApiCalled: false,
      externalActionsEnabled: false,
      gmailDraftCreationEnabled: false,
      summary: {
        providerDisabled: 1,
      },
    })
    expect(plan.activationReadiness).toMatchObject({
      state: 'provider_disabled',
      canRunMockImport: false,
      canRunLiveImport: false,
    })
    expect(plan.candidates[0]).toMatchObject({
      status: 'provider_disabled',
      captureRequest: null,
      localEvidence: null,
      decision: null,
      nextAction: expect.stringContaining('dry-run import planner'),
    })
  })

  it('reports provider-missing readiness without provider calls', () => {
    const readiness = buildWarmOutreachGmailResponseImportActivationReadiness({
      providerConfigured: false,
    })

    expect(readiness).toMatchObject({
      state: 'provider_missing',
      canRunMockImport: true,
      canRunLiveImport: false,
      providerConfigured: false,
      gmailApiCalled: false,
      databaseWritesEnabled: false,
      blockedReasons: expect.arrayContaining([
        'Gmail response import provider configuration is missing.',
      ]),
    })
  })

  it('reports missing Gmail token and recovery action', () => {
    const readiness = buildWarmOutreachGmailResponseImportActivationReadiness({
      providerConfigured: true,
      gmailTokenAvailable: false,
    })

    expect(readiness).toMatchObject({
      state: 'missing_gmail_token',
      canRunMockImport: true,
      gmailTokenAvailable: false,
      nextOperatorAction: expect.stringContaining('Reconnect Gmail'),
      blockedReasons: expect.arrayContaining([
        'No connected Gmail token is available for this admin.',
      ]),
    })
  })

  it('reports missing Gmail readonly scope separately from token state', () => {
    const readiness = buildWarmOutreachGmailResponseImportActivationReadiness({
      providerConfigured: true,
      gmailTokenAvailable: true,
      grantedScopes: [
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    })

    expect(readiness).toMatchObject({
      state: 'missing_gmail_scope',
      canRunMockImport: true,
      gmailTokenAvailable: true,
      missingScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      blockedReasons: expect.arrayContaining([
        'Stored Gmail OAuth scope is missing: https://www.googleapis.com/auth/gmail.readonly.',
      ]),
    })
  })

  it('treats an explicitly empty scope list as missing readonly scope', () => {
    const readiness = buildWarmOutreachGmailResponseImportActivationReadiness({
      providerConfigured: true,
      gmailTokenAvailable: true,
      grantedScopes: [],
    })

    expect(readiness).toMatchObject({
      state: 'missing_gmail_scope',
      missingScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    })
  })

  it('keeps live import disabled even when provider metadata is present', () => {
    const readiness = buildWarmOutreachGmailResponseImportActivationReadiness({
      providerConfigured: true,
      gmailTokenAvailable: true,
      grantedScopes: 'https://www.googleapis.com/auth/gmail.readonly',
      liveImportRequested: true,
    })

    expect(readiness).toMatchObject({
      state: 'live_import_disabled',
      canRunMockImport: true,
      canRunLiveImport: false,
      liveProviderImportEnabled: false,
      providerPollingEnabled: false,
      blockedReasons: expect.arrayContaining([
        'Live Gmail response reads are disabled by default.',
      ]),
    })
  })
})
