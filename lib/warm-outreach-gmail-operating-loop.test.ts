import { describe, expect, it } from 'vitest'

import {
  buildWarmGmailOperatingLoop,
  type BuildWarmGmailOperatingLoopInput,
} from './warm-outreach-gmail-operating-loop'

function input(
  overrides: Partial<BuildWarmGmailOperatingLoopInput> = {},
): BuildWarmGmailOperatingLoopInput {
  return {
    contactId: 42,
    queueId: 'queue-42',
    messageVersionKey: 'warm-outreach:email-message-version:v1:42',
    sendQueueIdempotencyKey: 'warm-outreach:email-send-queue:v1:42',
    submittedEvidenceKey: 'warm-outreach:email-submitted-evidence:v1:42',
    internalDraftReady: true,
    draftTracked: false,
    providerConfigured: true,
    senderMatched: true,
    approvalRequestStatus: 'not_sent',
    authorizationStatus: 'missing',
    executionState: 'approval_needed',
    submittedEvidenceRecorded: false,
    secondaryLogRepairRequired: false,
    responseMonitoringAttached: false,
    hardBlockers: [],
    ...overrides,
  }
}

describe('warm Gmail operating loop', () => {
  it.each([
    ['ready_for_draft', input()],
    ['draft_created', input({ draftTracked: true })],
    ['send_approval_requested', input({
      draftTracked: true,
      approvalRequestStatus: 'pending',
      executionState: 'approval_requested',
    })],
    ['send_authorized', input({
      draftTracked: true,
      approvalRequestStatus: 'approved',
      authorizationStatus: 'approved',
      executionState: 'approved_for_send',
    })],
    ['sent', input({
      draftTracked: true,
      authorizationStatus: 'approved',
      executionState: 'sent',
      submittedEvidenceRecorded: true,
    })],
    ['response_monitoring', input({
      draftTracked: true,
      authorizationStatus: 'approved',
      executionState: 'sent',
      submittedEvidenceRecorded: true,
      responseMonitoringAttached: true,
      responseMonitoringStatus: 'awaiting_response',
    })],
  ] as const)('derives the %s progression state', (state, stateInput) => {
    const loop = buildWarmGmailOperatingLoop(stateInput)

    expect(loop.state).toBe(state)
    expect(loop.stages.find((stage) => stage.key === state)?.status).toBe('current')
  })

  it('shows one governed approval request after the Gmail draft is tracked', () => {
    const loop = buildWarmGmailOperatingLoop(input({ draftTracked: true }))

    expect(loop.nextAction).toMatchObject({
      key: 'request_send_approval',
      label: 'Request send approval',
      enabledOnThisSurface: true,
      route: '/api/admin/outreach/queue-42/slack-send-approval',
    })
    expect(loop.reviewMoment).toMatchObject({
      kind: 'single_slack_or_portfolio_review',
      slackDispatchEnabled: false,
      recordsAuthorizationIntentOnly: true,
    })
    expect(loop.reviewMoment.portfolioDeepLink).toContain(
      '/admin/outreach?tab=leads&filter=warm&id=42',
    )
  })

  it('keeps authorized Gmail execution disabled and rejects generic proceed authority', () => {
    const loop = buildWarmGmailOperatingLoop(input({
      draftTracked: true,
      approvalRequestStatus: 'approved',
      authorizationStatus: 'approved',
      executionState: 'eligible_for_execution',
    }))

    expect(loop).toMatchObject({
      state: 'send_authorized',
      authority: {
        sendApproval: 'authorized',
        liveSendExecution: 'explicit_gate_required',
      },
      nextAction: {
        key: 'run_exact_send_gate',
        enabledOnThisSurface: false,
      },
      executionBoundary: {
        gmailSendEnabledOnThisSurface: false,
        genericProceedAuthorizesLiveSend: false,
        exactLiveSendAuthorization:
          'execute_warm_gmail_send_for_authorized_recipient',
      },
      executionGate: {
        state: 'live_execution_eligible',
        label: 'Live execution eligible',
        liveSendEligible: true,
        liveSendActionEnabledOnThisSurface: false,
      },
    })
    expect(loop.executionGate.requiredEvidence).toMatchObject({
      messageVersionKey: 'warm-outreach:email-message-version:v1:42',
      sendQueueIdempotencyKey: 'warm-outreach:email-send-queue:v1:42',
      submittedEvidenceKey: 'warm-outreach:email-submitted-evidence:v1:42',
    })
  })

  it('blocks duplicate sends and gives secondary-log recovery after sent evidence', () => {
    const loop = buildWarmGmailOperatingLoop(input({
      draftTracked: true,
      authorizationStatus: 'approved',
      executionState: 'sent',
      submittedEvidenceRecorded: true,
      secondaryLogRepairRequired: true,
      responseMonitoringAttached: true,
    }))

    expect(loop).toMatchObject({
      state: 'response_monitoring',
      duplicateSendBlocked: true,
      authority: {
        liveSendExecution: 'complete',
        responseImport: 'manual_or_dry_run_only',
      },
      nextAction: {
        key: 'repair_execution_evidence',
        label: 'Repair communication log',
        enabledOnThisSurface: false,
      },
      responseImport: {
        attachedToSameOutreachItem: true,
        livePollingEnabled: false,
        liveProviderImportEnabled: false,
      },
      executionGate: {
        state: 'response_monitoring',
        label: 'Response monitoring active',
        liveSendEligible: false,
      },
    })
    expect(loop.nextAction.recovery).toContain('preserve the existing send')
  })

  it('surfaces draft recovery without turning missing readiness into a vague blocker stack', () => {
    const loop = buildWarmGmailOperatingLoop(input({
      providerConfigured: false,
      senderMatched: false,
    }))

    expect(loop.state).toBe('ready_for_draft')
    expect(loop.blocked).toBe(true)
    expect(loop.nextAction).toMatchObject({
      key: 'resolve_draft_readiness',
      label: 'Resolve draft blocker',
      detail: 'The connected Gmail provider is not ready for draft creation.',
    })
    expect(loop.stages.find((stage) => stage.key === 'ready_for_draft')?.status).toBe('blocked')
  })

  it('does not offer approval while tracked draft evidence conflicts with a hard blocker', () => {
    const loop = buildWarmGmailOperatingLoop(input({
      draftTracked: true,
      hardBlockers: ['The tracked draft message version does not match this queue row.'],
    }))

    expect(loop.state).toBe('draft_created')
    expect(loop.blocked).toBe(true)
    expect(loop.nextAction).toMatchObject({
      key: 'resolve_draft_readiness',
      label: 'Resolve workflow blocker',
      enabledOnThisSurface: false,
    })
  })
})
