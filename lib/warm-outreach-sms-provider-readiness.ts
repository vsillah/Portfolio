export const warmSmsProviderReadinessStates = [
  'provider_not_configured',
  'provider_configured_disabled',
  'consent_or_suppression_not_satisfied',
  'eligible_for_human_approved_draft_creation',
  'provider_activation_requirements_not_satisfied',
  'eligible_for_future_explicit_send_authorization',
] as const

export type WarmSmsProviderReadinessState = (typeof warmSmsProviderReadinessStates)[number]

export const warmSmsProviderCapabilityRequirements = [
  {
    key: 'outbound_message_submission',
    label: 'Outbound message submission',
    detail: 'Document the provider endpoint, sender identity rules, and fail-closed error contract.',
  },
  {
    key: 'delivery_status_callbacks',
    label: 'Delivery status callbacks',
    detail: 'Verify durable provider message IDs plus delivered, failed, and unknown outcome handling.',
  },
  {
    key: 'inbound_opt_out_ingestion',
    label: 'Inbound stop / opt-out ingestion',
    detail: 'Verify STOP-style replies update suppression before another SMS prompt can appear.',
  },
  {
    key: 'sender_identity_compliance',
    label: 'Sender identity and compliance',
    detail: 'Document the approved sender, registration requirements, geography, and recipient rules.',
  },
  {
    key: 'idempotent_submission',
    label: 'Idempotent submission',
    detail: 'Verify a stable request key or equivalent provider-safe duplicate prevention mechanism.',
  },
  {
    key: 'sandbox_or_no_send_test',
    label: 'Sandbox or no-send test',
    detail: 'Identify a provider-supported test path that cannot contact a real recipient.',
  },
] as const

export type WarmSmsProviderCapabilityKey =
  (typeof warmSmsProviderCapabilityRequirements)[number]['key']

export const warmSmsProviderSetupCandidates = [
  {
    key: 'twilio_messaging',
    label: 'Twilio Messaging',
    capabilityFit: 'candidate',
    setupWork:
      'Map account reference, sender identity, delivery callback, STOP webhook, and no-send test mode.',
  },
  {
    key: 'telnyx_messaging',
    label: 'Telnyx Messaging',
    capabilityFit: 'candidate',
    setupWork:
      'Map messaging profile, sender identity, webhook signing, opt-out handling, and sandbox constraints.',
  },
  {
    key: 'messagebird_messaging',
    label: 'MessageBird / Bird',
    capabilityFit: 'candidate',
    setupWork:
      'Map channel identity, delivery report callbacks, inbound STOP handling, and no-send validation.',
  },
  {
    key: 'custom_disabled_adapter',
    label: 'Custom disabled adapter',
    capabilityFit: 'review_only',
    setupWork:
      'Keep the adapter inert while provider contracts, approvals, and audit requirements are reviewed.',
  },
] as const

export type WarmSmsProviderSetupCandidateKey =
  (typeof warmSmsProviderSetupCandidates)[number]['key']

export type WarmSmsProviderSetupReadinessState =
  | 'recipient_evidence_required'
  | 'provider_path_required'
  | 'disabled_configuration_review_required'
  | 'capability_mapping_required'
  | 'setup_audit_required'
  | 'setup_ready_activation_disabled'

export type WarmSmsProviderTransportReadinessState =
  | 'not_configured'
  | 'configured_disabled'
  | 'configured_ready'
  | 'blocked'
  | 'unavailable'

export type WarmSmsProviderSetupConfigurationKey =
  | 'SMS_PROVIDER_ADAPTER'
  | 'SMS_PROVIDER_CREDENTIAL_REFERENCE'
  | 'SMS_PROVIDER_SENDER_REFERENCE'
  | 'SMS_PROVIDER_DELIVERY_CALLBACK'
  | 'SMS_PROVIDER_OPT_OUT_CALLBACK'
  | 'ENABLE_WARM_SMS_PROVIDER_EXECUTION'

export type WarmSmsProviderTransportConfigurationKey =
  | WarmSmsProviderSetupConfigurationKey
  | 'WARM_SMS_MESSAGE_VERSION_KEY'
  | 'WARM_SMS_IDEMPOTENCY_NAMESPACE'
  | 'WARM_SMS_AUDIT_KEY'
  | 'WARM_SMS_DELIVERY_CONFIRMATION_STORE'
  | 'SMS_PROVIDER_UNAVAILABLE_REASON'

export type WarmSmsProviderSetupConfigurationStatus =
  | 'missing'
  | 'review_required'
  | 'disabled_verified'

export type WarmSmsProviderSetupConfigurationItem = {
  key: WarmSmsProviderSetupConfigurationKey
  label: string
  status: WarmSmsProviderSetupConfigurationStatus
  rawValueReturned: false
  detail: string
}

export type WarmSmsProviderTransportConfigInput = Partial<
  Record<WarmSmsProviderTransportConfigurationKey, string | boolean | null | undefined>
>

export type WarmSmsProviderTransportConfigSnapshot = {
  version: 'warm-outreach-sms-transport-config/v1'
  state: WarmSmsProviderTransportReadinessState
  selectedProvider: {
    key: WarmSmsProviderSetupCandidateKey | null
    label: string
    configured: boolean
    unavailable: boolean
    rawValueReturned: false
  }
  senderReferenceRecorded: boolean
  credentialReferenceRecorded: boolean
  deliveryCallbackRecorded: boolean
  optOutCallbackRecorded: boolean
  executionFlagEnabled: boolean
  messageVersionKey: string
  idempotencyNamespace: string
  auditKey: string
  deliveryConfirmationStoreMapped: boolean
  unavailableReason: string | null
  blockers: string[]
  configItems: Array<{
    key: WarmSmsProviderTransportConfigurationKey
    label: string
    status: 'present_redacted' | 'missing' | 'disabled' | 'blocked'
    rawValueReturned: false
    detail: string
  }>
  externalRequests: []
}

export type WarmSmsProviderTransportReadiness = {
  version: 'warm-outreach-sms-provider-transport-readiness/v1'
  state: WarmSmsProviderTransportReadinessState
  label: string
  selectedProvider: WarmSmsProviderTransportConfigSnapshot['selectedProvider']
  senderReadiness: {
    status: 'missing' | 'ready' | 'blocked' | 'unavailable'
    senderReferenceRecorded: boolean
    rawSenderReturned: false
    detail: string
  }
  capabilityReadiness: {
    status: 'missing' | 'partial' | 'ready' | 'blocked'
    verified: number
    total: number
    required: WarmSmsProviderCapabilityKey[]
    detail: string
  }
  consentSuppressionRequirements: {
    required: true
    met: boolean
    suppressionClear: boolean
    phoneProvenanceVerified: boolean
    permissionDocumented: boolean
    auditTimestampValid: boolean
  }
  auditAndIdempotency: {
    messageVersionKey: string
    idempotencyNamespace: string
    auditKey: string
    idempotencyKeyPreview: string
    rawPhoneStored: false
    rawMessageBodyStored: false
    recordBeforeProviderAttempt: true
    duplicatePolicy: 'return_existing_attempt_evidence_without_resend'
    requiredBeforeAttempt: [
      'consent_snapshot',
      'suppression_snapshot',
      'current_per_recipient_approval',
      'message_version',
      'idempotency_key',
    ]
  }
  deliveryConfirmation: {
    status: 'placeholder_only'
    deliveryStoreMapped: boolean
    providerMessageId: null
    deliveryStatus: null
    requiredAfterFutureAttempt: [
      'attempt_timestamp',
      'provider_message_id',
      'delivery_status',
      'result_classification',
    ]
    detail: string
  }
  blockedReasons: string[]
  nextAction: string
  executionBoundary: {
    providerCallsEnabled: false
    smsDeliveryEnabled: false
    providerActivationEnabled: false
    routeImplemented: false
    featureFlagEnabled: false
    credentialsRead: false
    environmentVariablesChanged: false
    externalRequests: []
  }
}

export type WarmSmsProviderSetupReadiness = {
  version: 'warm-outreach-sms-provider-setup-readiness/v1'
  state: WarmSmsProviderSetupReadinessState
  label: string
  selectedPath: {
    candidateKey: WarmSmsProviderSetupCandidateKey | null
    label: string
    selectionStatus: WarmSmsProviderActivationInput['providerSelectionStatus']
    selectionNote: string
    availableCandidates: Array<{
      key: WarmSmsProviderSetupCandidateKey
      label: string
      capabilityFit: string
      setupWork: string
      externalCallsEnabled: false
    }>
  }
  configurationValidation: {
    status: WarmSmsProviderActivationInput['configurationStatus']
    label: string
    credentialsRead: false
    environmentVariablesChanged: false
    providerSettingsChanged: false
    featureFlagEnabled: false
    requiredEnvironment: WarmSmsProviderSetupConfigurationItem[]
  }
  operatorPath: {
    canReviewNow: string[]
    blockedByProviderSetup: string[]
    requiredBeforeAnyLiveSend: string[]
    nextAction: string
  }
  executionBoundary: {
    providerCallsEnabled: false
    smsDeliveryEnabled: false
    credentialsRead: false
    environmentChanges: false
    featureFlagEnabled: false
    routeImplemented: false
  }
}

export type WarmSmsProviderActivationInput = {
  providerSelectionStatus: 'not_selected' | 'candidate' | 'selected'
  providerSelectionNote: string | null
  providerSetupCandidate?: WarmSmsProviderSetupCandidateKey | null
  configurationStatus: 'not_reviewed' | 'planned_disabled' | 'verified_disabled'
  configurationNote: string | null
  capabilityEvidence: Partial<Record<WarmSmsProviderCapabilityKey, {
    status: 'verified' | 'gap' | 'not_verified'
    evidence: string | null
  }>>
  reviewedAt: string | null
}

export type WarmSmsProviderReadinessInput = {
  provider: {
    name: string | null
    configured: boolean
    enabled: boolean
  }
  consent: {
    knownRelationshipBasis: boolean
    relationshipBasisNote: string | null
    phoneProvenance: 'known' | 'unverified' | 'missing'
    phoneProvenanceNote: string | null
    permissionStatus: 'documented' | 'relationship_basis_only' | 'missing'
    permissionNote: string | null
    optOutStop: boolean
    wrongNumber: boolean
    doNotContact: boolean
    lastContactAt: string | null
    cooldownDays: number
    auditedAt: string | null
  }
  draftApproval: {
    approvedForProviderDraftCreation: boolean
  }
  activation?: WarmSmsProviderActivationInput
  transportConfig?: WarmSmsProviderTransportConfigInput
  now: string
}

type WarmSmsProviderCheckStatus = 'passed' | 'blocked' | 'review_required'

export type WarmSmsProviderReadiness = {
  version: 'warm-outreach-sms-provider-readiness/v1'
  state: WarmSmsProviderReadinessState
  label: string
  provider: {
    name: string | null
    configured: boolean
    enabled: boolean
    providerCallsEnabled: false
    smsDeliveryEnabled: false
  }
  consentAndSuppression: {
    status: 'clear' | 'needs_evidence' | 'suppressed' | 'cooldown_active'
    suppressionPrecedence: true
    auditedAt: string | null
    blockers: string[]
    checks: Array<{
      key:
        | 'known_relationship_basis'
        | 'phone_provenance'
        | 'permission_consent_note'
        | 'opt_out_stop'
        | 'wrong_number'
        | 'do_not_contact'
        | 'last_contact_cooldown'
        | 'audit_timestamp'
      label: string
      status: WarmSmsProviderCheckStatus
      detail: string
    }>
    cooldown: {
      lastContactAt: string | null
      days: number
      active: boolean
      until: string | null
    }
  }
  eligibility: {
    humanApprovedDraftCreation: boolean
    futureExplicitSendAuthorization: boolean
    liveProviderSend: false
  }
  authorizationBoundary: {
    currentPerRecipientApprovalRequired: true
    requiredApproval: 'authorize_warm_sms_send_for_specific_recipient'
    providerFlagRequired: true
    providerFlagEnabled: boolean
    genericProceedAccepted: false
    sendRouteImplemented: false
    externalSendEnabled: false
  }
  setupReadiness: WarmSmsProviderSetupReadiness
  transportReadiness: WarmSmsProviderTransportReadiness
  activationReadiness: {
    version: 'warm-outreach-sms-provider-activation-readiness/v1'
    state:
      | 'consent_or_suppression_required'
      | 'provider_selection_required'
      | 'provider_configuration_review_required'
      | 'capability_evidence_required'
      | 'activation_audit_required'
      | 'architecture_ready_activation_disabled'
    label: string
    providerSummary: {
      name: string | null
      selectionStatus: WarmSmsProviderActivationInput['providerSelectionStatus']
      selectionNote: string
      configurationStatus: WarmSmsProviderActivationInput['configurationStatus']
      configurationNote: string
      credentialsRead: false
      environmentChanges: false
    }
    capabilitySummary: {
      verified: number
      total: number
      status: 'complete' | 'gaps_remain'
      requirements: Array<{
        key: WarmSmsProviderCapabilityKey
        label: string
        detail: string
        status: 'verified' | 'gap' | 'not_verified'
        evidence: string
      }>
    }
    consentPrerequisites: {
      required: true
      met: boolean
      suppressionClear: boolean
      phoneProvenanceVerified: boolean
      permissionDocumented: boolean
      auditTimestampValid: boolean
    }
    sendAuthority: {
      genericProceedAccepted: false
      currentPerRecipientApprovalRequired: true
      requiredApproval: 'authorize_warm_sms_send_for_specific_recipient'
      approvalMustMatch: ['contact_id', 'channel_sms', 'message_version', 'idempotency_key']
      liveSendEnabled: false
    }
    idempotencyModel: {
      status: 'contract_only'
      implemented: false
      namespace: 'warm-sms-send:v1'
      keyParts: ['contact_id', 'channel_sms', 'message_version', 'current_per_recipient_approval_key']
      recordBeforeProviderAttempt: true
      duplicatePolicy: 'return_existing_attempt_evidence_without_resend'
      providerMessageIdRequiredAfterAttempt: true
    }
    auditEvidence: {
      status: 'complete' | 'incomplete'
      reviewedAt: string | null
      requiredBeforeActivation: [
        'provider_selection_record',
        'disabled_configuration_review',
        'capability_evidence_review',
      ]
      requiredBeforeFutureSend: [
        'consent_snapshot',
        'suppression_snapshot',
        'phone_provenance',
        'current_per_recipient_approval',
        'message_version',
        'idempotency_key',
      ]
      requiredAfterProviderAttempt: [
        'attempt_timestamp',
        'provider_message_id',
        'delivery_status',
        'result_classification',
      ]
      storesRawPhone: false
      storesRawMessageBody: false
    }
    blockedRecovery: {
      reason: string
      nextStep: string
      steps: [string, string, string, string, string]
    }
    executionBoundary: {
      activationEnabled: false
      providerCallsEnabled: false
      smsDeliveryEnabled: false
      routeImplemented: false
      featureFlagEnabled: false
    }
  }
  operatorNextAction: string
  recoveryStep: string | null
}

function normalizedNote(value: string | null) {
  const note = value?.trim()
  return note ? note : null
}

function validTimestamp(value: string | null) {
  if (!value) return false
  return Number.isFinite(Date.parse(value))
}

function providerSetupCandidateFor(
  activation: WarmSmsProviderActivationInput,
): WarmSmsProviderSetupCandidateKey | null {
  if (activation.providerSetupCandidate !== undefined) {
    return activation.providerSetupCandidate
  }
  return activation.providerSelectionStatus === 'selected'
    ? 'custom_disabled_adapter'
    : null
}

function setupCandidateLabel(candidateKey: WarmSmsProviderSetupCandidateKey | null) {
  return warmSmsProviderSetupCandidates.find((candidate) => candidate.key === candidateKey)?.label ??
    'No provider path selected'
}

function transportConfigValue(
  config: WarmSmsProviderTransportConfigInput,
  key: WarmSmsProviderTransportConfigurationKey,
) {
  const value = config[key]
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return normalizedNote(value ?? null)
}

function transportFlagEnabled(value: string | null) {
  return /^(1|true|yes|on|enabled)$/i.test(value ?? '')
}

function providerCandidateFromConfig(value: string | null) {
  if (!value) return null
  const normalized = value.toLowerCase().replace(/[\s-]+/g, '_')
  if (normalized === 'twilio') return 'twilio_messaging'
  if (normalized === 'telnyx') return 'telnyx_messaging'
  if (normalized === 'messagebird' || normalized === 'bird') return 'messagebird_messaging'
  return warmSmsProviderSetupCandidates.find((candidate) => candidate.key === normalized)?.key ?? null
}

export function parseWarmSmsProviderTransportConfig(
  config: WarmSmsProviderTransportConfigInput = {},
): WarmSmsProviderTransportConfigSnapshot {
  const adapterValue = transportConfigValue(config, 'SMS_PROVIDER_ADAPTER')
  const providerKey = providerCandidateFromConfig(adapterValue)
  const senderReferenceRecorded = Boolean(transportConfigValue(config, 'SMS_PROVIDER_SENDER_REFERENCE'))
  const credentialReferenceRecorded = Boolean(transportConfigValue(config, 'SMS_PROVIDER_CREDENTIAL_REFERENCE'))
  const deliveryCallbackRecorded = Boolean(transportConfigValue(config, 'SMS_PROVIDER_DELIVERY_CALLBACK'))
  const optOutCallbackRecorded = Boolean(transportConfigValue(config, 'SMS_PROVIDER_OPT_OUT_CALLBACK'))
  const deliveryConfirmationStoreMapped = Boolean(
    transportConfigValue(config, 'WARM_SMS_DELIVERY_CONFIRMATION_STORE'),
  )
  const executionFlagEnabled = transportFlagEnabled(
    transportConfigValue(config, 'ENABLE_WARM_SMS_PROVIDER_EXECUTION'),
  )
  const unavailableReason = transportConfigValue(config, 'SMS_PROVIDER_UNAVAILABLE_REASON')
  const messageVersionKey =
    transportConfigValue(config, 'WARM_SMS_MESSAGE_VERSION_KEY') ?? 'pending-message-version'
  const idempotencyNamespace =
    transportConfigValue(config, 'WARM_SMS_IDEMPOTENCY_NAMESPACE') ?? 'warm-sms-send:v1'
  const auditKey =
    transportConfigValue(config, 'WARM_SMS_AUDIT_KEY') ?? 'warm-sms-transport-audit:v1:pending'
  const missingRequired = [
    ...(!credentialReferenceRecorded ? ['Credential reference is not recorded.'] : []),
    ...(!senderReferenceRecorded ? ['Sender identity reference is not recorded.'] : []),
    ...(!deliveryCallbackRecorded ? ['Delivery callback mapping is not recorded.'] : []),
    ...(!optOutCallbackRecorded ? ['Opt-out callback mapping is not recorded.'] : []),
    ...(!deliveryConfirmationStoreMapped ? ['Delivery confirmation store mapping is not recorded.'] : []),
  ]
  const unavailable = Boolean(adapterValue && !providerKey) || Boolean(unavailableReason)
  const blockers = [
    ...(!adapterValue ? ['SMS provider adapter is not configured.'] : []),
    ...(adapterValue && !providerKey ? [`SMS provider adapter "${adapterValue}" is not supported by this readiness model.`] : []),
    ...(unavailableReason ? [unavailableReason] : []),
    ...(executionFlagEnabled
      ? ['ENABLE_WARM_SMS_PROVIDER_EXECUTION is enabled; this readiness phase fails closed and does not send SMS.']
      : []),
    ...missingRequired,
  ]

  let state: WarmSmsProviderTransportReadinessState
  if (!adapterValue) {
    state = 'not_configured'
  } else if (unavailable) {
    state = 'unavailable'
  } else if (executionFlagEnabled) {
    state = 'blocked'
  } else if (missingRequired.length > 0) {
    state = 'configured_disabled'
  } else {
    state = 'configured_ready'
  }

  function configItem(
    key: WarmSmsProviderTransportConfigurationKey,
    label: string,
    present: boolean,
    detail: string,
    statusOverride?: 'disabled' | 'blocked',
  ) {
    return {
      key,
      label,
      status: statusOverride ?? (present ? 'present_redacted' as const : 'missing' as const),
      rawValueReturned: false as const,
      detail,
    }
  }

  return {
    version: 'warm-outreach-sms-transport-config/v1',
    state,
    selectedProvider: {
      key: providerKey,
      label: setupCandidateLabel(providerKey),
      configured: Boolean(providerKey),
      unavailable,
      rawValueReturned: false,
    },
    senderReferenceRecorded,
    credentialReferenceRecorded,
    deliveryCallbackRecorded,
    optOutCallbackRecorded,
    executionFlagEnabled,
    messageVersionKey,
    idempotencyNamespace,
    auditKey,
    deliveryConfirmationStoreMapped,
    unavailableReason,
    blockers,
    configItems: [
      configItem(
        'SMS_PROVIDER_ADAPTER',
        'Provider adapter',
        Boolean(providerKey),
        'Only the selected provider label is returned; raw adapter values stay out of the UI.',
        unavailable ? 'blocked' : undefined,
      ),
      configItem('SMS_PROVIDER_CREDENTIAL_REFERENCE', 'Credential reference', credentialReferenceRecorded, 'Presence only. This parser never reads or returns provider credentials.'),
      configItem('SMS_PROVIDER_SENDER_REFERENCE', 'Sender identity reference', senderReferenceRecorded, 'Presence only. Sender identity details stay in the provider setup record.'),
      configItem('SMS_PROVIDER_DELIVERY_CALLBACK', 'Delivery callback mapping', deliveryCallbackRecorded, 'Presence only. Future delivery callbacks remain disabled.'),
      configItem('SMS_PROVIDER_OPT_OUT_CALLBACK', 'Opt-out callback mapping', optOutCallbackRecorded, 'Presence only. Future STOP ingestion remains disabled.'),
      configItem('WARM_SMS_DELIVERY_CONFIRMATION_STORE', 'Delivery confirmation store', deliveryConfirmationStoreMapped, 'Presence only. This phase adds a placeholder, not provider reconciliation.'),
      configItem('WARM_SMS_MESSAGE_VERSION_KEY', 'Message version key', Boolean(transportConfigValue(config, 'WARM_SMS_MESSAGE_VERSION_KEY')), 'Stable key required before any future per-recipient send authorization.'),
      configItem('WARM_SMS_IDEMPOTENCY_NAMESPACE', 'Idempotency namespace', Boolean(transportConfigValue(config, 'WARM_SMS_IDEMPOTENCY_NAMESPACE')), 'Stable namespace for duplicate prevention before provider attempts.'),
      configItem('WARM_SMS_AUDIT_KEY', 'Audit key', Boolean(transportConfigValue(config, 'WARM_SMS_AUDIT_KEY')), 'Stable audit key for consent, suppression, and future delivery evidence.'),
      configItem('ENABLE_WARM_SMS_PROVIDER_EXECUTION', 'Execution feature flag', !executionFlagEnabled, 'Must remain disabled in this readiness phase.', executionFlagEnabled ? 'blocked' : 'disabled'),
    ],
    externalRequests: [],
  }
}

function cooldownSnapshot(lastContactAt: string | null, cooldownDays: number, now: string) {
  const days = Number.isFinite(cooldownDays) ? Math.max(0, Math.floor(cooldownDays)) : 0
  if (!lastContactAt || !validTimestamp(lastContactAt)) {
    return {
      lastContactAt,
      days,
      active: false,
      until: null,
      invalid: Boolean(lastContactAt),
    }
  }

  const untilMs = Date.parse(lastContactAt) + days * 24 * 60 * 60 * 1000
  const nowMs = Date.parse(now)
  return {
    lastContactAt,
    days,
    active: Number.isFinite(nowMs) && nowMs < untilMs,
    until: new Date(untilMs).toISOString(),
    invalid: false,
  }
}

export function buildWarmSmsProviderReadiness(
  input: WarmSmsProviderReadinessInput,
): WarmSmsProviderReadiness {
  const relationshipNote = normalizedNote(input.consent.relationshipBasisNote)
  const provenanceNote = normalizedNote(input.consent.phoneProvenanceNote)
  const permissionNote = normalizedNote(input.consent.permissionNote)
  const auditedAtValid = validTimestamp(input.consent.auditedAt)
  const cooldown = cooldownSnapshot(
    input.consent.lastContactAt,
    input.consent.cooldownDays,
    input.now,
  )

  const suppressionBlockers = [
    ...(input.consent.optOutStop ? ['Stop or opt-out evidence suppresses SMS.'] : []),
    ...(input.consent.wrongNumber ? ['Wrong-number evidence suppresses SMS.'] : []),
    ...(input.consent.doNotContact ? ['The contact is marked do not contact.'] : []),
  ]
  const evidenceBlockers = [
    ...(!input.consent.knownRelationshipBasis || !relationshipNote
      ? ['A known relationship basis and note are required.']
      : []),
    ...(input.consent.phoneProvenance !== 'known' || !provenanceNote
      ? ['Verified phone provenance and a source note are required.']
      : []),
    ...(input.consent.permissionStatus !== 'documented' || !permissionNote
      ? ['A specific permission or consent note is required; relationship context alone is insufficient.']
      : []),
    ...(cooldown.invalid ? ['The last-contact timestamp is invalid.'] : []),
    ...(cooldown.active
      ? [`The ${cooldown.days}-day contact cooldown remains active until ${cooldown.until}.`]
      : []),
    ...(!auditedAtValid ? ['A valid consent and suppression audit timestamp is required.'] : []),
  ]
  const blockers = [...suppressionBlockers, ...evidenceBlockers]

  const consentStatus: WarmSmsProviderReadiness['consentAndSuppression']['status'] =
    suppressionBlockers.length > 0
      ? 'suppressed'
      : cooldown.active
        ? 'cooldown_active'
        : evidenceBlockers.length > 0
          ? 'needs_evidence'
          : 'clear'

  const activation = input.activation ?? {
    providerSelectionStatus: normalizedNote(input.provider.name)
      ? input.provider.configured ? 'selected' as const : 'candidate' as const
      : 'not_selected' as const,
    providerSelectionNote: null,
    configurationStatus: input.provider.configured
      ? 'planned_disabled' as const
      : 'not_reviewed' as const,
    configurationNote: null,
    capabilityEvidence: {},
    reviewedAt: null,
  }
  const capabilityRequirements = warmSmsProviderCapabilityRequirements.map((requirement) => {
    const evidence = activation.capabilityEvidence[requirement.key]
    return {
      ...requirement,
      status: evidence?.status ?? 'not_verified' as const,
      evidence: normalizedNote(evidence?.evidence ?? null) ?? 'No provider-specific evidence is recorded.',
    }
  })
  const verifiedCapabilityCount = capabilityRequirements.filter(
    (requirement) => requirement.status === 'verified',
  ).length
  const capabilitiesComplete = verifiedCapabilityCount === capabilityRequirements.length
  const activationReviewedAtValid = validTimestamp(activation.reviewedAt)
  const consentPrerequisitesMet = blockers.length === 0

  let activationState: WarmSmsProviderReadiness['activationReadiness']['state']
  if (!consentPrerequisitesMet) {
    activationState = 'consent_or_suppression_required'
  } else if (activation.providerSelectionStatus !== 'selected') {
    activationState = 'provider_selection_required'
  } else if (activation.configurationStatus !== 'verified_disabled') {
    activationState = 'provider_configuration_review_required'
  } else if (!capabilitiesComplete) {
    activationState = 'capability_evidence_required'
  } else if (!activationReviewedAtValid) {
    activationState = 'activation_audit_required'
  } else {
    activationState = 'architecture_ready_activation_disabled'
  }
  const activationArchitectureReady =
    activationState === 'architecture_ready_activation_disabled'
  const activationAuditComplete =
    activation.providerSelectionStatus === 'selected' &&
    activation.configurationStatus === 'verified_disabled' &&
    capabilitiesComplete &&
    activationReviewedAtValid

  let state: WarmSmsProviderReadinessState
  if (suppressionBlockers.length > 0 || evidenceBlockers.length > 0) {
    state = 'consent_or_suppression_not_satisfied'
  } else if (!input.provider.configured) {
    state = 'provider_not_configured'
  } else if (!input.provider.enabled) {
    state = 'provider_configured_disabled'
  } else if (!input.draftApproval.approvedForProviderDraftCreation) {
    state = 'eligible_for_human_approved_draft_creation'
  } else if (!activationArchitectureReady) {
    state = 'provider_activation_requirements_not_satisfied'
  } else {
    state = 'eligible_for_future_explicit_send_authorization'
  }

  const labels: Record<WarmSmsProviderReadinessState, string> = {
    provider_not_configured: 'No SMS provider configured',
    provider_configured_disabled: 'SMS provider configured but disabled',
    consent_or_suppression_not_satisfied: 'SMS consent or suppression checks not satisfied',
    eligible_for_human_approved_draft_creation: 'Eligible for human-approved SMS draft creation',
    provider_activation_requirements_not_satisfied: 'SMS provider activation requirements not satisfied',
    eligible_for_future_explicit_send_authorization: 'Eligible for a future explicit send-authorization review',
  }
  const nextActions: Record<WarmSmsProviderReadinessState, string> = {
    provider_not_configured:
      'Select and configure an SMS provider in a later activation phase. This screen cannot create a provider draft or send SMS.',
    provider_configured_disabled:
      'Keep the provider disabled until captain review, provider-specific safeguards, and an approved activation phase are complete.',
    consent_or_suppression_not_satisfied:
      suppressionBlockers.length > 0
        ? 'Preserve the suppression evidence and do not prepare provider SMS activity for this contact.'
        : `Resolve the consent record before provider SMS review: ${evidenceBlockers[0] ?? 'consent evidence is incomplete'}`,
    eligible_for_human_approved_draft_creation:
      'Request a separate human approval for provider-bound draft creation. This state does not authorize or perform a send.',
    provider_activation_requirements_not_satisfied:
      'Complete the provider activation evidence packet before a future per-recipient send-authorization review.',
    eligible_for_future_explicit_send_authorization:
      'A future send path must still require a current per-recipient approval plus the provider flag; generic proceed is never enough.',
  }

  const activationLabels: Record<
    WarmSmsProviderReadiness['activationReadiness']['state'],
    string
  > = {
    consent_or_suppression_required: 'Activation blocked by recipient safety evidence',
    provider_selection_required: 'Provider selection decision required',
    provider_configuration_review_required: 'Disabled provider configuration review required',
    capability_evidence_required: 'Provider capability evidence required',
    activation_audit_required: 'Activation evidence review required',
    architecture_ready_activation_disabled: 'Activation architecture reviewed; execution remains disabled',
  }
  const activationNextSteps: Record<
    WarmSmsProviderReadiness['activationReadiness']['state'],
    string
  > = {
    consent_or_suppression_required:
      blockers[0] ?? 'Complete the consent, provenance, suppression, and audit record for this recipient.',
    provider_selection_required:
      'Record an operator-reviewed provider choice and source documentation; do not enter credentials here.',
    provider_configuration_review_required:
      'Document a disabled configuration review with secrets excluded and keep provider execution off.',
    capability_evidence_required: (() => {
      const nextRequirement = capabilityRequirements.find((requirement) => requirement.status !== 'verified')
      return nextRequirement
        ? `Verify ${nextRequirement.label.toLowerCase()} against the selected provider documentation or leave it recorded as a gap.`
        : 'Record the provider capability review.'
    })(),
    activation_audit_required:
      'Record when provider selection, disabled configuration, and capability evidence were last reviewed.',
    architecture_ready_activation_disabled:
      'Ask the Integration Captain to review the activation packet. Live provider calls and SMS delivery remain disabled.',
  }
  const selectionNotes: Record<WarmSmsProviderActivationInput['providerSelectionStatus'], string> = {
    not_selected: 'No provider choice is recorded. Vendor uncertainty remains an explicit activation gap.',
    candidate: 'A provider candidate is named, but the operator decision is not confirmed.',
    selected: 'A provider choice is recorded for architecture review only.',
  }
  const configurationNotes: Record<WarmSmsProviderActivationInput['configurationStatus'], string> = {
    not_reviewed: 'No provider configuration review is recorded.',
    planned_disabled: 'A disabled configuration is modeled, but provider-specific review evidence is incomplete.',
    verified_disabled: 'The disabled configuration contract was reviewed without enabling provider execution.',
  }
  const setupCandidate = providerSetupCandidateFor(activation)
  let setupState: WarmSmsProviderSetupReadinessState
  if (!consentPrerequisitesMet) {
    setupState = 'recipient_evidence_required'
  } else if (activation.providerSelectionStatus !== 'selected' || !setupCandidate) {
    setupState = 'provider_path_required'
  } else if (activation.configurationStatus !== 'verified_disabled') {
    setupState = 'disabled_configuration_review_required'
  } else if (!capabilitiesComplete) {
    setupState = 'capability_mapping_required'
  } else if (!activationReviewedAtValid) {
    setupState = 'setup_audit_required'
  } else {
    setupState = 'setup_ready_activation_disabled'
  }
  const setupLabels: Record<WarmSmsProviderSetupReadinessState, string> = {
    recipient_evidence_required: 'Recipient consent and suppression evidence required',
    provider_path_required: 'SMS provider path selection required',
    disabled_configuration_review_required: 'Disabled provider configuration review required',
    capability_mapping_required: 'Provider capability mapping incomplete',
    setup_audit_required: 'Provider setup audit timestamp required',
    setup_ready_activation_disabled: 'Provider setup reviewed; activation remains disabled',
  }
  const configurationValidationRows: WarmSmsProviderSetupConfigurationItem[] = [
    {
      key: 'SMS_PROVIDER_ADAPTER',
      label: 'Provider adapter',
      status: setupCandidate ? 'review_required' : 'missing',
      rawValueReturned: false,
      detail: setupCandidate
        ? `${setupCandidateLabel(setupCandidate)} is modeled for review only.`
        : 'Choose the provider path before any configuration review.',
    },
    {
      key: 'SMS_PROVIDER_CREDENTIAL_REFERENCE',
      label: 'Credential reference',
      status: activation.configurationStatus === 'verified_disabled' ? 'disabled_verified' : 'review_required',
      rawValueReturned: false,
      detail: 'Record only the presence of a future credential reference. Do not read, display, or write secrets here.',
    },
    {
      key: 'SMS_PROVIDER_SENDER_REFERENCE',
      label: 'Sender identity',
      status: activation.configurationStatus === 'verified_disabled' ? 'disabled_verified' : 'review_required',
      rawValueReturned: false,
      detail: 'Verify the sender identity requirement without enabling or contacting a provider.',
    },
    {
      key: 'SMS_PROVIDER_DELIVERY_CALLBACK',
      label: 'Delivery callback',
      status: activation.configurationStatus === 'verified_disabled' ? 'disabled_verified' : 'review_required',
      rawValueReturned: false,
      detail: 'Map where delivered, failed, and unknown delivery outcomes would be recorded after a future provider attempt.',
    },
    {
      key: 'SMS_PROVIDER_OPT_OUT_CALLBACK',
      label: 'Opt-out callback',
      status: activation.configurationStatus === 'verified_disabled' ? 'disabled_verified' : 'review_required',
      rawValueReturned: false,
      detail: 'Map how STOP-style replies would update suppression before another SMS prompt can appear.',
    },
    {
      key: 'ENABLE_WARM_SMS_PROVIDER_EXECUTION',
      label: 'Execution feature flag',
      status: 'disabled_verified',
      rawValueReturned: false,
      detail: 'The execution flag must stay disabled until a later captain-approved activation phase.',
    },
  ]
  const transportConfig = parseWarmSmsProviderTransportConfig(input.transportConfig ?? {
    SMS_PROVIDER_ADAPTER: setupCandidate,
    ENABLE_WARM_SMS_PROVIDER_EXECUTION: false,
  })
  const transportBlockedReasons = [
    ...(!consentPrerequisitesMet ? blockers : []),
    ...(transportConfig.state === 'not_configured' ||
      transportConfig.state === 'configured_disabled' ||
      transportConfig.state === 'blocked' ||
      transportConfig.state === 'unavailable'
      ? transportConfig.blockers
      : []),
    ...(!capabilitiesComplete ? ['All provider transport capabilities must be verified before a future send review.'] : []),
    ...(!activationReviewedAtValid ? ['Provider transport audit timestamp is missing or invalid.'] : []),
  ]
  const transportState: WarmSmsProviderTransportReadinessState =
    !consentPrerequisitesMet
      ? 'blocked'
      : transportConfig.state === 'configured_ready' && (!capabilitiesComplete || !activationReviewedAtValid)
        ? 'configured_disabled'
        : transportConfig.state
  const transportLabels: Record<WarmSmsProviderTransportReadinessState, string> = {
    not_configured: 'SMS transport not configured',
    configured_disabled: 'SMS transport configured but disabled',
    configured_ready: 'SMS transport configured-ready; send remains off',
    blocked: 'SMS transport blocked by recipient or safety gates',
    unavailable: 'Selected SMS transport unavailable',
  }
  const transportNextActions: Record<WarmSmsProviderTransportReadinessState, string> = {
    not_configured:
      'Select a provider transport and map sender, opt-out, delivery, audit, and idempotency placeholders before any future activation review.',
    configured_disabled:
      'Complete the disabled transport contract and capability evidence. This does not activate the provider or send SMS.',
    configured_ready:
      'Hold for a later captain-reviewed provider activation and a current per-recipient send authorization. This phase still sends nothing.',
    blocked:
      transportBlockedReasons[0] ?? 'Resolve recipient safety gates before provider transport review.',
    unavailable:
      transportConfig.unavailableReason ?? 'Choose a supported SMS transport or leave SMS provider delivery unavailable.',
  }
  const transportReadiness: WarmSmsProviderTransportReadiness = {
    version: 'warm-outreach-sms-provider-transport-readiness/v1',
    state: transportState,
    label: transportLabels[transportState],
    selectedProvider: transportConfig.selectedProvider,
    senderReadiness: {
      status:
        transportState === 'unavailable'
          ? 'unavailable'
          : transportState === 'blocked'
            ? 'blocked'
            : transportConfig.senderReferenceRecorded
              ? 'ready'
              : 'missing',
      senderReferenceRecorded: transportConfig.senderReferenceRecorded,
      rawSenderReturned: false,
      detail: transportConfig.senderReferenceRecorded
        ? 'A sender identity reference is recorded without exposing the sender value.'
        : 'Record the approved sender identity reference before a future provider attempt.',
    },
    capabilityReadiness: {
      status:
        transportState === 'blocked'
          ? 'blocked'
          : verifiedCapabilityCount === 0
            ? 'missing'
            : capabilitiesComplete
              ? 'ready'
              : 'partial',
      verified: verifiedCapabilityCount,
      total: capabilityRequirements.length,
      required: warmSmsProviderCapabilityRequirements.map((requirement) => requirement.key),
      detail: capabilitiesComplete
        ? 'All modeled provider capabilities are verified for architecture review only.'
        : 'Provider capability evidence is incomplete; provider calls and SMS delivery remain disabled.',
    },
    consentSuppressionRequirements: {
      required: true,
      met: consentPrerequisitesMet,
      suppressionClear: suppressionBlockers.length === 0,
      phoneProvenanceVerified:
        input.consent.phoneProvenance === 'known' && Boolean(provenanceNote),
      permissionDocumented:
        input.consent.permissionStatus === 'documented' && Boolean(permissionNote),
      auditTimestampValid: auditedAtValid,
    },
    auditAndIdempotency: {
      messageVersionKey: transportConfig.messageVersionKey,
      idempotencyNamespace: transportConfig.idempotencyNamespace,
      auditKey: transportConfig.auditKey,
      idempotencyKeyPreview:
        `${transportConfig.idempotencyNamespace}:contact:{contact_id}:sms:${transportConfig.messageVersionKey}:approval:{approval_key}`,
      rawPhoneStored: false,
      rawMessageBodyStored: false,
      recordBeforeProviderAttempt: true,
      duplicatePolicy: 'return_existing_attempt_evidence_without_resend',
      requiredBeforeAttempt: [
        'consent_snapshot',
        'suppression_snapshot',
        'current_per_recipient_approval',
        'message_version',
        'idempotency_key',
      ],
    },
    deliveryConfirmation: {
      status: 'placeholder_only',
      deliveryStoreMapped: transportConfig.deliveryConfirmationStoreMapped,
      providerMessageId: null,
      deliveryStatus: null,
      requiredAfterFutureAttempt: [
        'attempt_timestamp',
        'provider_message_id',
        'delivery_status',
        'result_classification',
      ],
      detail: transportConfig.deliveryConfirmationStoreMapped
        ? 'Delivery confirmation has a mapped placeholder; no callback is active and no provider message exists.'
        : 'Map where future delivery confirmation would be recorded before any provider activation review.',
    },
    blockedReasons: transportBlockedReasons,
    nextAction: transportNextActions[transportState],
    executionBoundary: {
      providerCallsEnabled: false,
      smsDeliveryEnabled: false,
      providerActivationEnabled: false,
      routeImplemented: false,
      featureFlagEnabled: false,
      credentialsRead: false,
      environmentVariablesChanged: false,
      externalRequests: [],
    },
  }

  return {
    version: 'warm-outreach-sms-provider-readiness/v1',
    state,
    label: labels[state],
    provider: {
      name: normalizedNote(input.provider.name),
      configured: input.provider.configured,
      enabled: input.provider.configured && input.provider.enabled,
      providerCallsEnabled: false,
      smsDeliveryEnabled: false,
    },
    consentAndSuppression: {
      status: consentStatus,
      suppressionPrecedence: true,
      auditedAt: auditedAtValid ? input.consent.auditedAt : null,
      blockers,
      checks: [
        {
          key: 'known_relationship_basis',
          label: 'Known relationship basis',
          status: input.consent.knownRelationshipBasis && relationshipNote ? 'passed' : 'blocked',
          detail: relationshipNote ?? 'Record why this is a known, appropriate one-to-one relationship.',
        },
        {
          key: 'phone_provenance',
          label: 'Phone provenance',
          status: input.consent.phoneProvenance === 'known' && provenanceNote ? 'passed' : 'blocked',
          detail: provenanceNote ?? 'Verify how the phone number entered the contact record.',
        },
        {
          key: 'permission_consent_note',
          label: 'Permission / consent note',
          status: input.consent.permissionStatus === 'documented' && permissionNote ? 'passed' : 'blocked',
          detail: permissionNote ?? 'Relationship context alone does not document permission to text.',
        },
        {
          key: 'opt_out_stop',
          label: 'Opt-out / stop',
          status: input.consent.optOutStop ? 'blocked' : 'passed',
          detail: input.consent.optOutStop
            ? 'Stop or opt-out evidence has precedence over every provider state.'
            : 'No stop or opt-out evidence is recorded in this readiness snapshot.',
        },
        {
          key: 'wrong_number',
          label: 'Wrong number',
          status: input.consent.wrongNumber ? 'blocked' : 'passed',
          detail: input.consent.wrongNumber
            ? 'Wrong-number evidence suppresses further SMS activity.'
            : 'No wrong-number evidence is recorded.',
        },
        {
          key: 'do_not_contact',
          label: 'Do not contact',
          status: input.consent.doNotContact ? 'blocked' : 'passed',
          detail: input.consent.doNotContact
            ? 'The contact-level do-not-contact state blocks SMS.'
            : 'No contact-level do-not-contact state is recorded.',
        },
        {
          key: 'last_contact_cooldown',
          label: 'Last-contact cooldown',
          status: cooldown.invalid || cooldown.active ? 'blocked' : 'passed',
          detail: cooldown.invalid
            ? 'Fix the invalid last-contact timestamp before provider review.'
            : cooldown.active
              ? `Wait until ${cooldown.until} before another SMS touch.`
              : cooldown.lastContactAt
                ? `The ${cooldown.days}-day cooldown has cleared.`
                : 'No recent SMS contact is recorded in this snapshot.',
        },
        {
          key: 'audit_timestamp',
          label: 'Consent audit timestamp',
          status: auditedAtValid ? 'passed' : 'blocked',
          detail: auditedAtValid
            ? `Consent and suppression evidence was audited at ${input.consent.auditedAt}.`
            : 'Record when consent, provenance, and suppression evidence were last reviewed.',
        },
      ],
      cooldown: {
        lastContactAt: cooldown.lastContactAt,
        days: cooldown.days,
        active: cooldown.active,
        until: cooldown.until,
      },
    },
    eligibility: {
      humanApprovedDraftCreation:
        state === 'eligible_for_human_approved_draft_creation' ||
        state === 'eligible_for_future_explicit_send_authorization',
      futureExplicitSendAuthorization:
        state === 'eligible_for_future_explicit_send_authorization' && activationArchitectureReady,
      liveProviderSend: false,
    },
    authorizationBoundary: {
      currentPerRecipientApprovalRequired: true,
      requiredApproval: 'authorize_warm_sms_send_for_specific_recipient',
      providerFlagRequired: true,
      providerFlagEnabled: input.provider.configured && input.provider.enabled,
      genericProceedAccepted: false,
      sendRouteImplemented: false,
      externalSendEnabled: false,
    },
    setupReadiness: {
      version: 'warm-outreach-sms-provider-setup-readiness/v1',
      state: setupState,
      label: setupLabels[setupState],
      selectedPath: {
        candidateKey: setupCandidate,
        label: setupCandidateLabel(setupCandidate),
        selectionStatus: activation.providerSelectionStatus,
        selectionNote:
          normalizedNote(activation.providerSelectionNote) ?? selectionNotes[activation.providerSelectionStatus],
        availableCandidates: warmSmsProviderSetupCandidates.map((candidate) => ({
          ...candidate,
          externalCallsEnabled: false,
        })),
      },
      configurationValidation: {
        status: activation.configurationStatus,
        label: configurationNotes[activation.configurationStatus],
        credentialsRead: false,
        environmentVariablesChanged: false,
        providerSettingsChanged: false,
        featureFlagEnabled: false,
        requiredEnvironment: configurationValidationRows,
      },
      operatorPath: {
        canReviewNow: [
          'Provider path candidates and tradeoffs',
          'Disabled configuration checklist',
          'Capability gaps and no-send test requirements',
          'Future per-recipient authorization contract',
        ],
        blockedByProviderSetup: [
          'Credential validation',
          'Provider API calls',
          'Delivery callback verification',
          'Inbound opt-out webhook verification',
          'Live SMS delivery',
        ],
        requiredBeforeAnyLiveSend: [
          'Provider path selected and reviewed',
          'Disabled configuration verified without exposing secrets',
          'All capability evidence verified',
          'Consent, suppression, phone provenance, and cooldown audit current for the recipient',
          'Current per-recipient approval matched to contact, SMS channel, message version, and idempotency key',
        ],
        nextAction: setupLabels[setupState],
      },
      executionBoundary: {
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
        credentialsRead: false,
        environmentChanges: false,
        featureFlagEnabled: false,
        routeImplemented: false,
      },
    },
    transportReadiness,
    activationReadiness: {
      version: 'warm-outreach-sms-provider-activation-readiness/v1',
      state: activationState,
      label: activationLabels[activationState],
      providerSummary: {
        name: normalizedNote(input.provider.name),
        selectionStatus: activation.providerSelectionStatus,
        selectionNote:
          normalizedNote(activation.providerSelectionNote) ?? selectionNotes[activation.providerSelectionStatus],
        configurationStatus: activation.configurationStatus,
        configurationNote:
          normalizedNote(activation.configurationNote) ?? configurationNotes[activation.configurationStatus],
        credentialsRead: false,
        environmentChanges: false,
      },
      capabilitySummary: {
        verified: verifiedCapabilityCount,
        total: capabilityRequirements.length,
        status: capabilitiesComplete ? 'complete' : 'gaps_remain',
        requirements: capabilityRequirements,
      },
      consentPrerequisites: {
        required: true,
        met: consentPrerequisitesMet,
        suppressionClear: suppressionBlockers.length === 0,
        phoneProvenanceVerified:
          input.consent.phoneProvenance === 'known' && Boolean(provenanceNote),
        permissionDocumented:
          input.consent.permissionStatus === 'documented' && Boolean(permissionNote),
        auditTimestampValid: auditedAtValid,
      },
      sendAuthority: {
        genericProceedAccepted: false,
        currentPerRecipientApprovalRequired: true,
        requiredApproval: 'authorize_warm_sms_send_for_specific_recipient',
        approvalMustMatch: ['contact_id', 'channel_sms', 'message_version', 'idempotency_key'],
        liveSendEnabled: false,
      },
      idempotencyModel: {
        status: 'contract_only',
        implemented: false,
        namespace: 'warm-sms-send:v1',
        keyParts: [
          'contact_id',
          'channel_sms',
          'message_version',
          'current_per_recipient_approval_key',
        ],
        recordBeforeProviderAttempt: true,
        duplicatePolicy: 'return_existing_attempt_evidence_without_resend',
        providerMessageIdRequiredAfterAttempt: true,
      },
      auditEvidence: {
        status: activationAuditComplete ? 'complete' : 'incomplete',
        reviewedAt: activationReviewedAtValid ? activation.reviewedAt : null,
        requiredBeforeActivation: [
          'provider_selection_record',
          'disabled_configuration_review',
          'capability_evidence_review',
        ],
        requiredBeforeFutureSend: [
          'consent_snapshot',
          'suppression_snapshot',
          'phone_provenance',
          'current_per_recipient_approval',
          'message_version',
          'idempotency_key',
        ],
        requiredAfterProviderAttempt: [
          'attempt_timestamp',
          'provider_message_id',
          'delivery_status',
          'result_classification',
        ],
        storesRawPhone: false,
        storesRawMessageBody: false,
      },
      blockedRecovery: {
        reason: activationLabels[activationState],
        nextStep: activationNextSteps[activationState],
        steps: [
          'Record the provider selection decision and its source documentation.',
          'Review a disabled configuration summary without exposing or changing credentials.',
          'Verify all required capabilities, including opt-out ingestion and duplicate prevention.',
          'Re-audit this recipient\'s consent, suppression, phone provenance, and cooldown evidence.',
          'Keep future send authority separate: require a current per-recipient approval matched to the message version and idempotency key.',
        ],
      },
      executionBoundary: {
        activationEnabled: false,
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
        routeImplemented: false,
        featureFlagEnabled: false,
      },
    },
    operatorNextAction: nextActions[state],
    recoveryStep: blockers[0] ?? null,
  }
}
