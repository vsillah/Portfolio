type JsonRecord = Record<string, unknown>

type WarmSmsCandidateReadinessInput = {
  contactId: string
  contactName: string | null
  state: string
  phoneReadiness: {
    present: boolean
  }
  relationshipRationale: {
    status: 'present' | 'missing'
    detail: string
  }
  consentAndSuppression: {
    status: 'clear_for_manual_review' | 'blocked' | 'relationship_rationale_required'
    rationale: string
    blockers: string[]
  }
  draft: {
    preview: string
  }
}

export type WarmSmsCandidateQueueRow = {
  id: string
  contact_submission_id?: number | string | null
  channel: string | null
  status: string | null
  subject?: string | null
  sequence_step?: number | null
  thread_id?: string | null
  message_id?: string | null
  sent_at?: string | null
  replied_at?: string | null
  generation_inputs?: JsonRecord | null
  created_at?: string | null
}

export type WarmSmsCandidateQueueArtifact = {
  id: string
  channel: 'sms' | 'phone_contact'
  status: string
  createdAt: string | null
  messageVersionKey: string
  smsSendIdempotencyKey: string
  submittedEvidenceKey: string
  approvalState: 'missing' | 'pending' | 'approved' | 'rejected' | 'revision_requested'
  submittedEvidenceRecorded: boolean
  rawPhoneReturned: false
  rawMessageBodyReturned: false
}

export type WarmSmsCandidateReview = {
  version: 'warm-outreach-sms-candidate-review/v1'
  state: 'candidate_exists' | 'ready_to_prepare' | 'blocked_missing_prerequisites'
  label: string
  detail: string
  queueArtifact: WarmSmsCandidateQueueArtifact | null
  prerequisites: Array<{
    key:
      | 'phone_present'
      | 'relationship_basis'
      | 'suppression_clear'
      | 'draft_text_available'
      | 'candidate_row'
    label: string
    status: 'passed' | 'blocked' | 'missing'
    detail: string
  }>
  blockedReasons: string[]
  prepareAction: {
    route: '/api/admin/outreach/leads/[id]/sms-candidate'
    method: 'POST'
    enabledOnThisSurface: boolean
    label: string
    detail: string
  }
  executionBoundary: {
    createsQueueArtifact: boolean
    providerCallsEnabled: false
    smsDeliveryEnabled: false
    telnyxApiCalled: false
    externalSendEnabled: false
    slackDispatchEnabled: false
    gmailActionEnabled: false
    n8nDispatchEnabled: false
    rawPhoneReturned: false
    rawMessageBodyReturned: false
    externalRequests: []
  }
}

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {}
}

function clean(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || null
}

function approvalState(value: unknown): WarmSmsCandidateQueueArtifact['approvalState'] {
  const state = clean(record(value).status)?.toLowerCase()
  if (state === 'pending') return 'pending'
  if (state === 'approved') return 'approved'
  if (state === 'rejected') return 'rejected'
  if (state === 'revision_requested') return 'revision_requested'
  return 'missing'
}

export function warmSmsMessageVersionKey(contactId: string | number, templateFamily: string) {
  return `warm-sms-message:v1:${contactId}:${templateFamily}`
}

export function warmSmsCandidateIdempotencyKey(input: {
  contactId: string | number
  queueId?: string | null
  messageVersionKey: string
}) {
  const queueSegment = clean(input.queueId) ?? 'pending'
  return `warm-sms-send:v1:${queueSegment}:${input.contactId}:${input.messageVersionKey}`
}

export function warmSmsSubmittedEvidenceKey(input: {
  contactId: string | number
  queueId?: string | null
  messageVersionKey: string
}) {
  const queueSegment = clean(input.queueId) ?? 'pending'
  return `warm-sms-audit:v1:submitted:${queueSegment}:${input.contactId}:${input.messageVersionKey}`
}

export function warmSmsCandidateMetadata(input: {
  contactId: string | number
  contactName: string | null
  messageVersionKey: string
  smsSendIdempotencyKey: string
  submittedEvidenceKey: string
  templateFamily: string
  templateLabel: string
  preparedBy: string
  preparedAt: string
}) {
  return {
    version: 'warm-outreach-sms-candidate-review/v1',
    template_key: 'warm_sms_candidate_review',
    template_family: input.templateFamily,
    template_label: input.templateLabel,
    channel: 'sms',
    contact_submission_id: input.contactId,
    contact_name_reference: input.contactName ? 'contact_submissions.name' : null,
    warm_sms_candidate: {
      status: 'prepared_for_review',
      prepared_by: input.preparedBy,
      prepared_at: input.preparedAt,
      records_queue_artifact_only: true,
      provider_calls_enabled: false,
      sms_delivery_enabled: false,
      telnyx_api_called: false,
      external_send_enabled: false,
      raw_phone_returned: false,
      raw_message_body_returned: false,
    },
    warm_sms_message_version_key: input.messageVersionKey,
    sms_send_idempotency_key: input.smsSendIdempotencyKey,
    submitted_evidence_key: input.submittedEvidenceKey,
    execution_boundary: {
      provider_calls_enabled: false,
      sms_delivery_enabled: false,
      telnyx_api_called: false,
      external_send_enabled: false,
      slack_dispatch_enabled: false,
      gmail_action_enabled: false,
      n8n_dispatch_enabled: false,
      raw_phone_returned: false,
      raw_message_body_returned: false,
      external_requests: [],
    },
  }
}

export function warmSmsCandidateArtifact(
  row: WarmSmsCandidateQueueRow,
  contactId: string | number,
): WarmSmsCandidateQueueArtifact | null {
  if (row.channel !== 'sms' && row.channel !== 'phone_contact') return null
  if (!row.id) return null

  const generationInputs = record(row.generation_inputs)
  const candidate = record(generationInputs.warm_sms_candidate)
  const messageVersionKey =
    clean(generationInputs.warm_sms_message_version_key) ??
    clean(candidate.message_version_key) ??
    warmSmsMessageVersionKey(contactId, clean(candidate.template_family) ?? 'candidate')
  const smsSendIdempotencyKey =
    clean(generationInputs.sms_send_idempotency_key) ??
    clean(candidate.sms_send_idempotency_key) ??
    warmSmsCandidateIdempotencyKey({ contactId, queueId: row.id, messageVersionKey })
  const submittedEvidenceKey =
    clean(generationInputs.submitted_evidence_key) ??
    clean(candidate.submitted_evidence_key) ??
    warmSmsSubmittedEvidenceKey({ contactId, queueId: row.id, messageVersionKey })

  return {
    id: row.id,
    channel: row.channel,
    status: row.status ?? 'draft',
    createdAt: row.created_at ?? null,
    messageVersionKey,
    smsSendIdempotencyKey,
    submittedEvidenceKey,
    approvalState: approvalState(generationInputs.warm_sms_send_authorization),
    submittedEvidenceRecorded: Boolean(
      clean(row.message_id) ||
      clean(row.sent_at) ||
      clean(record(generationInputs.warm_sms_telnyx_execution).provider_message_id),
    ),
    rawPhoneReturned: false,
    rawMessageBodyReturned: false,
  }
}

export function buildWarmSmsCandidateReview(input: {
  readiness: WarmSmsCandidateReadinessInput
  queueRows?: WarmSmsCandidateQueueRow[]
}): WarmSmsCandidateReview {
  const readiness = input.readiness
  const artifact = (input.queueRows ?? [])
    .map((row) => warmSmsCandidateArtifact(row, readiness.contactId))
    .find((row): row is WarmSmsCandidateQueueArtifact => Boolean(row)) ?? null
  const phonePresent = readiness.phoneReadiness.present
  const relationshipPresent = readiness.relationshipRationale.status === 'present'
  const suppressionClear = readiness.consentAndSuppression.status !== 'blocked'
  const draftAvailable = readiness.draft.preview.trim().length > 0
  const blockedReasons = [
    ...(!phonePresent ? ['Phone number is missing from the Portfolio contact record.'] : []),
    ...(!relationshipPresent ? ['Relationship rationale is not strong enough for SMS review.'] : []),
    ...(!suppressionClear ? readiness.consentAndSuppression.blockers : []),
    ...(!draftAvailable ? ['SMS draft text is missing.'] : []),
  ]
  const canPrepare = !artifact && blockedReasons.length === 0 && readiness.state !== 'blocked'
  const state: WarmSmsCandidateReview['state'] = artifact
    ? 'candidate_exists'
    : canPrepare
      ? 'ready_to_prepare'
      : 'blocked_missing_prerequisites'

  return {
    version: 'warm-outreach-sms-candidate-review/v1',
    state,
    label:
      state === 'candidate_exists'
        ? 'SMS candidate row exists'
        : state === 'ready_to_prepare'
          ? 'Ready to prepare SMS candidate'
          : 'SMS candidate blocked',
    detail:
      state === 'candidate_exists'
        ? 'Use the existing queue row for review. Live SMS still requires exact approval and provider activation.'
        : state === 'ready_to_prepare'
          ? 'Prepare one draft SMS queue row for review only. This does not send SMS or call Telnyx.'
          : blockedReasons[0] ?? 'Resolve SMS prerequisites before preparing a candidate row.',
    queueArtifact: artifact,
    prerequisites: [
      {
        key: 'phone_present',
        label: 'Phone present',
        status: phonePresent ? 'passed' : 'blocked',
        detail: phonePresent
          ? 'A phone reference exists on the contact record; raw phone is not returned.'
          : 'Add a phone number before SMS review.',
      },
      {
        key: 'relationship_basis',
        label: 'Relationship basis',
        status: relationshipPresent ? 'passed' : 'blocked',
        detail: readiness.relationshipRationale.detail,
      },
      {
        key: 'suppression_clear',
        label: 'Suppression clear',
        status: suppressionClear ? 'passed' : 'blocked',
        detail: readiness.consentAndSuppression.rationale,
      },
      {
        key: 'draft_text_available',
        label: 'Draft text',
        status: draftAvailable ? 'passed' : 'blocked',
        detail: draftAvailable
          ? 'A short review draft is available.'
          : 'Draft text is required before a queue artifact can be prepared.',
      },
      {
        key: 'candidate_row',
        label: 'Candidate row',
        status: artifact ? 'passed' : canPrepare ? 'missing' : 'blocked',
        detail: artifact
          ? `Review queue row ${artifact.id}.`
          : canPrepare
            ? 'No SMS queue row exists yet; prepare one for review.'
            : 'No row can be created until blockers clear.',
      },
    ],
    blockedReasons,
    prepareAction: {
      route: '/api/admin/outreach/leads/[id]/sms-candidate',
      method: 'POST',
      enabledOnThisSurface: canPrepare,
      label: artifact ? 'Candidate exists' : 'Prepare candidate',
      detail: artifact
        ? 'A candidate row already exists; select it for approval review before any future send gate.'
        : 'Creates a draft queue artifact only. Provider calls, SMS delivery, Slack, Gmail, and n8n remain off.',
    },
    executionBoundary: {
      createsQueueArtifact: canPrepare,
      providerCallsEnabled: false,
      smsDeliveryEnabled: false,
      telnyxApiCalled: false,
      externalSendEnabled: false,
      slackDispatchEnabled: false,
      gmailActionEnabled: false,
      n8nDispatchEnabled: false,
      rawPhoneReturned: false,
      rawMessageBodyReturned: false,
      externalRequests: [],
    },
  }
}
