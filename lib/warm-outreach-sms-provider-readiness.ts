export const warmSmsProviderReadinessStates = [
  'provider_not_configured',
  'provider_configured_disabled',
  'consent_or_suppression_not_satisfied',
  'eligible_for_human_approved_draft_creation',
  'eligible_for_future_explicit_send_authorization',
] as const

export type WarmSmsProviderReadinessState = (typeof warmSmsProviderReadinessStates)[number]

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

  let state: WarmSmsProviderReadinessState
  if (suppressionBlockers.length > 0 || evidenceBlockers.length > 0) {
    state = 'consent_or_suppression_not_satisfied'
  } else if (!input.provider.configured) {
    state = 'provider_not_configured'
  } else if (!input.provider.enabled) {
    state = 'provider_configured_disabled'
  } else if (!input.draftApproval.approvedForProviderDraftCreation) {
    state = 'eligible_for_human_approved_draft_creation'
  } else {
    state = 'eligible_for_future_explicit_send_authorization'
  }

  const labels: Record<WarmSmsProviderReadinessState, string> = {
    provider_not_configured: 'No SMS provider configured',
    provider_configured_disabled: 'SMS provider configured but disabled',
    consent_or_suppression_not_satisfied: 'SMS consent or suppression checks not satisfied',
    eligible_for_human_approved_draft_creation: 'Eligible for human-approved SMS draft creation',
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
    eligible_for_future_explicit_send_authorization:
      'A future send path must still require a current per-recipient approval plus the provider flag; generic proceed is never enough.',
  }

  const consentStatus: WarmSmsProviderReadiness['consentAndSuppression']['status'] =
    suppressionBlockers.length > 0
      ? 'suppressed'
      : cooldown.active
        ? 'cooldown_active'
        : evidenceBlockers.length > 0
          ? 'needs_evidence'
          : 'clear'

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
        state === 'eligible_for_future_explicit_send_authorization',
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
    operatorNextAction: nextActions[state],
    recoveryStep: blockers[0] ?? null,
  }
}
