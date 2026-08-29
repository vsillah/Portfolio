export const WARM_GMAIL_OPERATING_LOOP_STATES = [
  'ready_for_draft',
  'draft_created',
  'send_approval_requested',
  'send_authorized',
  'sent',
  'response_monitoring',
] as const

export type WarmGmailOperatingLoopState =
  (typeof WARM_GMAIL_OPERATING_LOOP_STATES)[number]

export type WarmGmailOperatingLoopActionKey =
  | 'resolve_draft_readiness'
  | 'create_gmail_draft'
  | 'request_send_approval'
  | 'record_send_decision'
  | 'revise_gmail_draft'
  | 'repair_execution_evidence'
  | 'run_exact_send_gate'
  | 'attach_response_monitoring'
  | 'review_response_monitoring'

export type WarmGmailOperatingLoop = {
  version: 'warm-outreach-gmail-operating-loop/v1'
  contactId: number
  queueId: string | null
  state: WarmGmailOperatingLoopState
  label: string
  blocked: boolean
  blockedReasons: string[]
  duplicateSendBlocked: boolean
  stages: Array<{
    key: WarmGmailOperatingLoopState
    label: string
    status: 'complete' | 'current' | 'upcoming' | 'blocked'
  }>
  authority: {
    draft: 'required' | 'recorded'
    sendApproval: 'not_requested' | 'requested' | 'authorized' | 'rejected' | 'revision_requested'
    liveSendExecution: 'disabled' | 'explicit_gate_required' | 'complete'
    responseImport: 'not_applicable' | 'manual_or_dry_run_only'
  }
  nextAction: {
    key: WarmGmailOperatingLoopActionKey
    label: string
    detail: string
    route: string
    enabledOnThisSurface: boolean
    recovery: string
  }
  audit: {
    messageVersionKey: string
    sendQueueIdempotencyKey: string
    submittedEvidenceKey: string
    submittedEvidenceRecorded: boolean
    secondaryLogRepairRequired: boolean
  }
  operatorContext: {
    recipientLabel: string
    recipientEmail: string | null
    queueLabel: string
    messageVersionKey: string
    gmailDraftId: string | null
    gmailThreadId: string | null
    approvalDecisionKey: string | null
  }
  executionGate: {
    state:
      | 'draft_required'
      | 'approval_request_required'
      | 'authorization_required'
      | 'live_execution_disabled'
      | 'live_execution_eligible'
      | 'submitted_evidence_recorded'
      | 'response_monitoring'
      | 'blocked'
    label: string
    blockedReason: string | null
    safeNextStep: string
    liveSendEligible: boolean
    liveSendActionEnabledOnThisSurface: false
    requiredAuthorization: 'execute_warm_gmail_send_for_authorized_recipient'
    requiredEvidence: {
      messageVersionKey: string
      sendQueueIdempotencyKey: string
      submittedEvidenceKey: string
      gmailDraftId: string | null
    }
  }
  reviewMoment: {
    kind: 'single_slack_or_portfolio_review'
    requestRoute: '/api/admin/outreach/[id]/slack-send-approval'
    portfolioDeepLink: string
    slackDispatchEnabled: false
    recordsAuthorizationIntentOnly: true
  }
  responseImport: {
    attachedToSameOutreachItem: boolean
    livePollingEnabled: false
    liveProviderImportEnabled: false
    reviewRoute: string
  }
  executionBoundary: {
    gmailDraftCreationEnabledOnThisSurface: false
    gmailSendEnabledOnThisSurface: false
    slackDispatchEnabled: false
    responsePollingEnabled: false
    genericProceedAuthorizesLiveSend: false
    exactLiveSendAuthorization: 'execute_warm_gmail_send_for_authorized_recipient'
  }
}

export type BuildWarmGmailOperatingLoopInput = {
  contactId: number
  queueId: string | null
  recipientLabel?: string | null
  recipientEmail?: string | null
  gmailDraftId?: string | null
  gmailThreadId?: string | null
  approvalDecisionKey?: string | null
  messageVersionKey: string
  sendQueueIdempotencyKey: string
  submittedEvidenceKey: string
  internalDraftReady: boolean
  draftTracked: boolean
  providerConfigured: boolean
  senderMatched: boolean
  approvalRequestStatus: 'not_sent' | 'pending' | 'approved' | 'rejected' | 'revision_requested'
  authorizationStatus: 'missing' | 'approved' | 'rejected' | 'revision_requested'
  executionState:
    | 'approval_needed'
    | 'approval_requested'
    | 'approved_for_send'
    | 'eligible_for_execution'
    | 'sent'
    | 'blocked'
    | 'failed'
  submittedEvidenceRecorded: boolean
  secondaryLogRepairRequired: boolean
  responseMonitoringAttached: boolean
  responseMonitoringStatus?: string | null
  hardBlockers?: string[]
}

const STAGE_LABELS: Record<WarmGmailOperatingLoopState, string> = {
  ready_for_draft: 'Ready for draft',
  draft_created: 'Draft created',
  send_approval_requested: 'Approval requested',
  send_authorized: 'Send authorized',
  sent: 'Sent',
  response_monitoring: 'Response monitoring',
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])]
}

function portfolioReviewRoute(contactId: number, queueId: string | null) {
  const params = new URLSearchParams({
    tab: 'leads',
    filter: 'warm',
    id: String(contactId),
    contactId: String(contactId),
  })
  if (queueId) params.set('queueId', queueId)
  return `/admin/outreach?${params.toString()}#warm-gmail-operating-loop`
}

function contactReviewRoute(contactId: number) {
  return `/admin/contacts/${contactId}#warm-response-lifecycle`
}

function stateFor(input: BuildWarmGmailOperatingLoopInput): WarmGmailOperatingLoopState {
  const sent = input.submittedEvidenceRecorded || input.executionState === 'sent'
  if (sent) {
    return input.responseMonitoringAttached ? 'response_monitoring' : 'sent'
  }
  if (input.authorizationStatus === 'approved') return 'send_authorized'
  if (input.approvalRequestStatus === 'pending' || input.executionState === 'approval_requested') {
    return 'send_approval_requested'
  }
  if (input.draftTracked) return 'draft_created'
  return 'ready_for_draft'
}

function approvalAuthority(
  input: BuildWarmGmailOperatingLoopInput,
): WarmGmailOperatingLoop['authority']['sendApproval'] {
  if (input.authorizationStatus === 'approved') return 'authorized'
  if (input.authorizationStatus === 'rejected') return 'rejected'
  if (input.authorizationStatus === 'revision_requested') return 'revision_requested'
  if (input.approvalRequestStatus === 'pending') return 'requested'
  return 'not_requested'
}

function draftBlockers(input: BuildWarmGmailOperatingLoopInput) {
  return unique([
    ...(input.hardBlockers ?? []),
    input.internalDraftReady ? null : 'The local warm draft packet is not ready.',
    input.providerConfigured ? null : 'The connected Gmail provider is not ready for draft creation.',
    input.senderMatched ? null : 'The connected Gmail sender is missing or does not match the required sender.',
  ])
}

function nextAction(
  input: BuildWarmGmailOperatingLoopInput,
  state: WarmGmailOperatingLoopState,
  blockers: string[],
): WarmGmailOperatingLoop['nextAction'] {
  const portfolioRoute = portfolioReviewRoute(input.contactId, input.queueId)
  const contactRoute = contactReviewRoute(input.contactId)

  if (state === 'ready_for_draft') {
    if (blockers.length > 0) {
      return {
        key: 'resolve_draft_readiness',
        label: 'Resolve draft blocker',
        detail: blockers[0],
        route: portfolioRoute,
        enabledOnThisSurface: false,
        recovery: 'Open the warm queue row, repair the named readiness gate, then return to this same item.',
      }
    }
    return {
      key: 'create_gmail_draft',
      label: 'Create Gmail draft',
      detail: 'Create one provider draft for this exact recipient and message version. This does not authorize sending.',
      route: portfolioRoute,
      enabledOnThisSurface: false,
      recovery: 'Use the existing queue-row Gmail draft action with explicit per-recipient confirmation.',
    }
  }

  if (input.authorizationStatus === 'rejected' || input.authorizationStatus === 'revision_requested') {
    return {
      key: 'revise_gmail_draft',
      label: 'Revise Gmail draft',
      detail: input.authorizationStatus === 'rejected'
        ? 'The prior send decision was rejected. Revise the exact draft before requesting another review.'
        : 'Revision was requested. Update the exact draft before requesting another review.',
      route: portfolioRoute,
      enabledOnThisSurface: false,
      recovery: 'Open the queue row, create a new message version, and rebuild the single approval request.',
    }
  }

  if (
    blockers.length > 0 &&
    (state === 'draft_created' || state === 'send_approval_requested')
  ) {
    return {
      key: 'resolve_draft_readiness',
      label: 'Resolve workflow blocker',
      detail: blockers[0],
      route: portfolioRoute,
      enabledOnThisSurface: false,
      recovery: 'Repair the named evidence mismatch on this queue row before requesting or recording send approval.',
    }
  }

  if (state === 'draft_created') {
    return {
      key: 'request_send_approval',
      label: 'Request send approval',
      detail: 'Create one Portfolio approval request and Slack review payload for this exact queue row. No Slack post or Gmail send occurs here.',
      route: input.queueId
        ? `/api/admin/outreach/${encodeURIComponent(input.queueId)}/slack-send-approval`
        : portfolioRoute,
      enabledOnThisSurface: Boolean(input.queueId),
      recovery: input.queueId
        ? 'If Slack delivery stays disabled, record approve, reject, or revise in Portfolio from the same review packet.'
        : 'Return to the warm queue row and restore the missing queue reference before requesting approval.',
    }
  }

  if (state === 'send_approval_requested') {
    return {
      key: 'record_send_decision',
      label: 'Record approval decision',
      detail: 'Review the recipient, relationship context, and exact Gmail draft once; then record approve, reject, or revise.',
      route: portfolioRoute,
      enabledOnThisSurface: false,
      recovery: 'Use the Portfolio workroom if Slack dispatch is unavailable. Approval records intent only.',
    }
  }

  if (state === 'send_authorized') {
    if (input.executionState === 'failed') {
      return {
        key: 'repair_execution_evidence',
        label: 'Repair send evidence',
        detail: 'A prior execution attempt failed. Review the failure before any exact retry.',
        route: portfolioRoute,
        enabledOnThisSurface: false,
        recovery: 'Confirm whether Gmail was called before retrying. Existing send evidence must always win over a new send attempt.',
      }
    }
    return {
      key: 'run_exact_send_gate',
      label: 'Run exact Gmail send gate',
      detail: 'Authorization is recorded, but live Gmail execution is disabled here and still requires the exact per-recipient execution approval.',
      route: input.queueId
        ? `/api/admin/outreach/${encodeURIComponent(input.queueId)}/gmail-user-send`
        : portfolioRoute,
      enabledOnThisSurface: false,
      recovery: 'The Integration Captain must verify the idempotency keys, explicitly enable the live execution gate, run one recipient, then disable it again.',
    }
  }

  if (state === 'sent') {
    return {
      key: 'attach_response_monitoring',
      label: 'Attach response monitoring',
      detail: 'Sent evidence is recorded. Attach the same queue row to the local response-monitoring view without polling Gmail.',
      route: contactRoute,
      enabledOnThisSurface: false,
      recovery: 'Keep the send idempotency key locked and use local or dry-run response evidence only.',
    }
  }

  if (input.secondaryLogRepairRequired) {
    return {
      key: 'repair_execution_evidence',
      label: 'Repair communication log',
      detail: 'Gmail send evidence exists, but the secondary Portfolio communication log needs repair. Do not resend.',
      route: contactRoute,
      enabledOnThisSurface: false,
      recovery: 'Repair the communication timeline from the queue send receipt; preserve the existing send and submitted-evidence keys.',
    }
  }

  return {
    key: 'review_response_monitoring',
    label: input.responseMonitoringStatus === 'manual_response_captured' ||
      input.responseMonitoringStatus === 'imported_response_captured'
      ? 'Review captured response'
      : 'Monitor for response',
    detail: 'The sent row now owns response follow-up. Manual capture and dry-run import are available; live Gmail polling stays disabled.',
    route: contactRoute,
    enabledOnThisSurface: false,
    recovery: 'Use the existing response lifecycle on this contact. Keep response import separate from draft and send authority.',
  }
}

function executionGate(
  input: BuildWarmGmailOperatingLoopInput,
  state: WarmGmailOperatingLoopState,
  blockers: string[],
  action: WarmGmailOperatingLoop['nextAction'],
): WarmGmailOperatingLoop['executionGate'] {
  const liveEligible =
    !input.submittedEvidenceRecorded &&
    !input.secondaryLogRepairRequired &&
    blockers.length === 0 &&
    input.authorizationStatus === 'approved' &&
    (input.executionState === 'eligible_for_execution' || input.executionState === 'approved_for_send')
  const submitted = input.submittedEvidenceRecorded || input.executionState === 'sent'

  const gateState: WarmGmailOperatingLoop['executionGate']['state'] =
    blockers.length > 0
      ? 'blocked'
      : input.responseMonitoringAttached && submitted
        ? 'response_monitoring'
        : submitted
          ? 'submitted_evidence_recorded'
          : liveEligible && input.executionState === 'eligible_for_execution'
            ? 'live_execution_eligible'
            : input.authorizationStatus === 'approved'
              ? 'live_execution_disabled'
              : state === 'send_approval_requested'
                ? 'authorization_required'
                : input.draftTracked
                  ? 'approval_request_required'
                  : 'draft_required'

  const label: Record<WarmGmailOperatingLoop['executionGate']['state'], string> = {
    draft_required: 'Draft evidence required',
    approval_request_required: 'Approval request required',
    authorization_required: 'Authorization decision required',
    live_execution_disabled: 'Live execution disabled',
    live_execution_eligible: 'Live execution eligible',
    submitted_evidence_recorded: 'Submitted evidence recorded',
    response_monitoring: 'Response monitoring active',
    blocked: 'Execution blocked',
  }

  const safeNextStep: Record<WarmGmailOperatingLoop['executionGate']['state'], string> = {
    draft_required: 'Create and track the exact Gmail draft before requesting send approval.',
    approval_request_required: 'Request approval for this exact queue row; Slack dispatch and Gmail send stay off.',
    authorization_required: 'Record approve, reject, or revise against the exact message version before any execution gate.',
    live_execution_disabled: 'Captain must first record local eligibility, then separately enable the exact live execution flag outside this UI.',
    live_execution_eligible: 'Captain may run the exact send route only with the listed authorization and evidence keys; this UI remains no-send.',
    submitted_evidence_recorded: 'Review sent evidence only; do not replay this message version.',
    response_monitoring: 'Use the contact response lifecycle; live Gmail polling remains a separate gate.',
    blocked: action.recovery,
  }

  return {
    state: gateState,
    label: label[gateState],
    blockedReason: blockers[0] ?? null,
    safeNextStep: safeNextStep[gateState],
    liveSendEligible: gateState === 'live_execution_eligible',
    liveSendActionEnabledOnThisSurface: false,
    requiredAuthorization: 'execute_warm_gmail_send_for_authorized_recipient',
    requiredEvidence: {
      messageVersionKey: input.messageVersionKey,
      sendQueueIdempotencyKey: input.sendQueueIdempotencyKey,
      submittedEvidenceKey: input.submittedEvidenceKey,
      gmailDraftId: input.gmailDraftId ?? null,
    },
  }
}

export function buildWarmGmailOperatingLoop(
  input: BuildWarmGmailOperatingLoopInput,
): WarmGmailOperatingLoop {
  const state = stateFor(input)
  const preDraftBlockers = draftBlockers(input)
  const blockedReasons = unique([
    ...(input.hardBlockers ?? []),
    ...(state === 'ready_for_draft' ? preDraftBlockers : []),
    input.authorizationStatus === 'rejected'
      ? 'The prior send approval was rejected.'
      : null,
    input.authorizationStatus === 'revision_requested'
      ? 'The exact Gmail draft requires revision before another approval request.'
      : null,
    input.executionState === 'failed'
      ? 'A prior Gmail execution attempt failed and must be reconciled before any retry.'
      : null,
  ])
  const duplicateSendBlocked = input.submittedEvidenceRecorded || input.executionState === 'sent'
  const currentIndex = WARM_GMAIL_OPERATING_LOOP_STATES.indexOf(state)
  const action = nextAction(input, state, blockedReasons)
  const gate = executionGate(input, state, blockedReasons, action)
  const portfolioDeepLink = portfolioReviewRoute(input.contactId, input.queueId)
  const responseReviewRoute = contactReviewRoute(input.contactId)

  return {
    version: 'warm-outreach-gmail-operating-loop/v1',
    contactId: input.contactId,
    queueId: input.queueId,
    state,
    label: STAGE_LABELS[state],
    blocked: blockedReasons.length > 0,
    blockedReasons,
    duplicateSendBlocked,
    stages: WARM_GMAIL_OPERATING_LOOP_STATES.map((key, index) => ({
      key,
      label: STAGE_LABELS[key],
      status: index < currentIndex
        ? 'complete'
        : index > currentIndex
          ? 'upcoming'
          : blockedReasons.length > 0
            ? 'blocked'
            : 'current',
    })),
    authority: {
      draft: input.draftTracked ? 'recorded' : 'required',
      sendApproval: approvalAuthority(input),
      liveSendExecution: duplicateSendBlocked
        ? 'complete'
        : state === 'send_authorized'
          ? 'explicit_gate_required'
          : 'disabled',
      responseImport: duplicateSendBlocked ? 'manual_or_dry_run_only' : 'not_applicable',
    },
    nextAction: action,
    audit: {
      messageVersionKey: input.messageVersionKey,
      sendQueueIdempotencyKey: input.sendQueueIdempotencyKey,
      submittedEvidenceKey: input.submittedEvidenceKey,
      submittedEvidenceRecorded: input.submittedEvidenceRecorded,
      secondaryLogRepairRequired: input.secondaryLogRepairRequired,
    },
    operatorContext: {
      recipientLabel: input.recipientLabel?.trim() || `Contact #${input.contactId}`,
      recipientEmail: input.recipientEmail?.trim() || null,
      queueLabel: input.queueId ? `Queue ${input.queueId}` : 'Queue row missing',
      messageVersionKey: input.messageVersionKey,
      gmailDraftId: input.gmailDraftId?.trim() || null,
      gmailThreadId: input.gmailThreadId?.trim() || null,
      approvalDecisionKey: input.approvalDecisionKey?.trim() || null,
    },
    executionGate: gate,
    reviewMoment: {
      kind: 'single_slack_or_portfolio_review',
      requestRoute: '/api/admin/outreach/[id]/slack-send-approval',
      portfolioDeepLink,
      slackDispatchEnabled: false,
      recordsAuthorizationIntentOnly: true,
    },
    responseImport: {
      attachedToSameOutreachItem: duplicateSendBlocked && input.responseMonitoringAttached,
      livePollingEnabled: false,
      liveProviderImportEnabled: false,
      reviewRoute: responseReviewRoute,
    },
    executionBoundary: {
      gmailDraftCreationEnabledOnThisSurface: false,
      gmailSendEnabledOnThisSurface: false,
      slackDispatchEnabled: false,
      responsePollingEnabled: false,
      genericProceedAuthorizesLiveSend: false,
      exactLiveSendAuthorization: 'execute_warm_gmail_send_for_authorized_recipient',
    },
  }
}
