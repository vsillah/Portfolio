import { describe, expect, it } from 'vitest'
import {
  buildWarmSmsProviderReadiness,
  type WarmSmsProviderReadinessInput,
} from './warm-outreach-sms-provider-readiness'

function input(
  overrides: Partial<WarmSmsProviderReadinessInput> = {},
): WarmSmsProviderReadinessInput {
  const base: WarmSmsProviderReadinessInput = {
    provider: {
      name: 'Synthetic SMS provider',
      configured: true,
      enabled: true,
    },
    consent: {
      knownRelationshipBasis: true,
      relationshipBasisNote: 'The contact requested a one-to-one follow-up after a prior working session.',
      phoneProvenance: 'known',
      phoneProvenanceNote: 'The contact supplied this number in a direct Portfolio form submission.',
      permissionStatus: 'documented',
      permissionNote: 'The contact explicitly invited a short SMS follow-up.',
      optOutStop: false,
      wrongNumber: false,
      doNotContact: false,
      lastContactAt: '2026-08-01T12:00:00.000Z',
      cooldownDays: 7,
      auditedAt: '2026-08-29T12:00:00.000Z',
    },
    draftApproval: {
      approvedForProviderDraftCreation: false,
    },
    now: '2026-08-29T13:00:00.000Z',
  }

  return {
    ...base,
    ...overrides,
    provider: {
      ...base.provider,
      ...overrides.provider,
    },
    consent: {
      ...base.consent,
      ...overrides.consent,
    },
    draftApproval: {
      ...base.draftApproval,
      ...overrides.draftApproval,
    },
  }
}

describe('warm SMS provider readiness', () => {
  it('distinguishes missing and disabled provider states without enabling calls', () => {
    const missing = buildWarmSmsProviderReadiness(input({
      provider: { name: null, configured: false, enabled: false },
    }))
    expect(missing).toMatchObject({
      state: 'provider_not_configured',
      provider: {
        configured: false,
        enabled: false,
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
      },
      eligibility: {
        liveProviderSend: false,
      },
      activationReadiness: {
        state: 'provider_selection_required',
        providerSummary: {
          selectionStatus: 'not_selected',
          configurationStatus: 'not_reviewed',
          credentialsRead: false,
          environmentChanges: false,
        },
      },
      setupReadiness: {
        version: 'warm-outreach-sms-provider-setup-readiness/v1',
        state: 'provider_path_required',
        selectedPath: {
          candidateKey: null,
          selectionStatus: 'not_selected',
        },
        configurationValidation: {
          credentialsRead: false,
          environmentVariablesChanged: false,
          providerSettingsChanged: false,
          featureFlagEnabled: false,
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
    })

    const disabled = buildWarmSmsProviderReadiness(input({
      provider: { name: 'Synthetic SMS provider', configured: true, enabled: false },
      activation: {
        providerSelectionStatus: 'selected',
        providerSelectionNote: 'Synthetic provider selected for setup review.',
        providerSetupCandidate: 'custom_disabled_adapter',
        configurationStatus: 'planned_disabled',
        configurationNote: 'Disabled configuration is modeled only.',
        capabilityEvidence: {},
        reviewedAt: null,
      },
    }))
    expect(disabled).toMatchObject({
      state: 'provider_configured_disabled',
      provider: {
        configured: true,
        enabled: false,
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
      },
      authorizationBoundary: {
        providerFlagEnabled: false,
        externalSendEnabled: false,
      },
      activationReadiness: {
        state: 'provider_configuration_review_required',
        providerSummary: {
          selectionStatus: 'selected',
          configurationStatus: 'planned_disabled',
        },
      },
      setupReadiness: {
        state: 'disabled_configuration_review_required',
        label: 'Disabled provider configuration review required',
        selectedPath: {
          candidateKey: 'custom_disabled_adapter',
          label: 'Custom disabled adapter',
          selectionStatus: 'selected',
        },
        configurationValidation: {
          status: 'planned_disabled',
          credentialsRead: false,
          environmentVariablesChanged: false,
          featureFlagEnabled: false,
        },
      },
    })
  })

  it('blocks missing permission and phone provenance before provider eligibility', () => {
    const readiness = buildWarmSmsProviderReadiness(input({
      consent: {
        ...input().consent,
        phoneProvenance: 'unverified',
        phoneProvenanceNote: 'A phone number exists, but its source has not been verified.',
        permissionStatus: 'relationship_basis_only',
        permissionNote: null,
        auditedAt: null,
      },
    }))

    expect(readiness.state).toBe('consent_or_suppression_not_satisfied')
    expect(readiness.consentAndSuppression.status).toBe('needs_evidence')
    expect(readiness.consentAndSuppression.blockers).toEqual(expect.arrayContaining([
      'Verified phone provenance and a source note are required.',
      'A specific permission or consent note is required; relationship context alone is insufficient.',
      'A valid consent and suppression audit timestamp is required.',
    ]))
    expect(readiness.consentAndSuppression.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'phone_provenance', status: 'blocked' }),
      expect.objectContaining({ key: 'permission_consent_note', status: 'blocked' }),
      expect.objectContaining({ key: 'audit_timestamp', status: 'blocked' }),
    ]))
  })

  it('gives stop, wrong-number, and do-not-contact suppression precedence', () => {
    const readiness = buildWarmSmsProviderReadiness(input({
      provider: { name: null, configured: false, enabled: false },
      consent: {
        ...input().consent,
        optOutStop: true,
        wrongNumber: true,
        doNotContact: true,
      },
    }))

    expect(readiness.state).toBe('consent_or_suppression_not_satisfied')
    expect(readiness.consentAndSuppression).toMatchObject({
      status: 'suppressed',
      suppressionPrecedence: true,
    })
    expect(readiness.consentAndSuppression.blockers.slice(0, 3)).toEqual([
      'Stop or opt-out evidence suppresses SMS.',
      'Wrong-number evidence suppresses SMS.',
      'The contact is marked do not contact.',
    ])
    expect(readiness.operatorNextAction).toMatch(/Preserve the suppression evidence/)
    expect(readiness.activationReadiness).toMatchObject({
      state: 'consent_or_suppression_required',
      consentPrerequisites: {
        required: true,
        met: false,
        suppressionClear: false,
      },
      executionBoundary: {
        activationEnabled: false,
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
      },
    })
  })

  it('enforces the last-contact cooldown and exposes its audit boundary', () => {
    const readiness = buildWarmSmsProviderReadiness(input({
      consent: {
        ...input().consent,
        lastContactAt: '2026-08-27T13:00:00.000Z',
        cooldownDays: 7,
      },
    }))

    expect(readiness.state).toBe('consent_or_suppression_not_satisfied')
    expect(readiness.consentAndSuppression).toMatchObject({
      status: 'cooldown_active',
      auditedAt: '2026-08-29T12:00:00.000Z',
      cooldown: {
        active: true,
        until: '2026-09-03T13:00:00.000Z',
      },
    })
  })

  it('separates draft eligibility from future send-authorization eligibility', () => {
    const draftEligible = buildWarmSmsProviderReadiness(input())
    expect(draftEligible).toMatchObject({
      state: 'eligible_for_human_approved_draft_creation',
      eligibility: {
        humanApprovedDraftCreation: true,
        futureExplicitSendAuthorization: false,
        liveProviderSend: false,
      },
    })

    const futureAuthorizationEligible = buildWarmSmsProviderReadiness(input({
      draftApproval: { approvedForProviderDraftCreation: true },
      activation: {
        providerSelectionStatus: 'selected',
        providerSelectionNote: 'Synthetic provider selected.',
        configurationStatus: 'verified_disabled',
        configurationNote: 'Disabled configuration contract reviewed.',
        capabilityEvidence: {
          outbound_message_submission: { status: 'verified', evidence: 'Reviewed.' },
          delivery_status_callbacks: { status: 'verified', evidence: 'Reviewed.' },
          inbound_opt_out_ingestion: { status: 'verified', evidence: 'Reviewed.' },
          sender_identity_compliance: { status: 'verified', evidence: 'Reviewed.' },
          idempotent_submission: { status: 'verified', evidence: 'Reviewed.' },
          sandbox_or_no_send_test: { status: 'verified', evidence: 'Reviewed.' },
        },
        reviewedAt: '2026-08-29T12:30:00.000Z',
      },
    }))
    expect(futureAuthorizationEligible).toMatchObject({
      state: 'eligible_for_future_explicit_send_authorization',
      eligibility: {
        humanApprovedDraftCreation: true,
        futureExplicitSendAuthorization: true,
        liveProviderSend: false,
      },
      authorizationBoundary: {
        currentPerRecipientApprovalRequired: true,
        requiredApproval: 'authorize_warm_sms_send_for_specific_recipient',
        providerFlagRequired: true,
        providerFlagEnabled: true,
        genericProceedAccepted: false,
        sendRouteImplemented: false,
        externalSendEnabled: false,
      },
    })
  })

  it('models provider capabilities and an exact recovery path without reading credentials', () => {
    const readiness = buildWarmSmsProviderReadiness(input({
      activation: {
        providerSelectionStatus: 'selected',
        providerSelectionNote: 'Synthetic provider selected for contract review.',
        providerSetupCandidate: 'twilio_messaging',
        configurationStatus: 'verified_disabled',
        configurationNote: 'Disabled configuration contract reviewed without provider access.',
        capabilityEvidence: {
          outbound_message_submission: {
            status: 'verified',
            evidence: 'Submission boundary documented.',
          },
          delivery_status_callbacks: {
            status: 'gap',
            evidence: 'Delivery callbacks are not yet mapped.',
          },
        },
        reviewedAt: '2026-08-29T12:30:00.000Z',
      },
    }))

    expect(readiness.activationReadiness).toMatchObject({
      version: 'warm-outreach-sms-provider-activation-readiness/v1',
      state: 'capability_evidence_required',
      providerSummary: {
        selectionStatus: 'selected',
        configurationStatus: 'verified_disabled',
        credentialsRead: false,
        environmentChanges: false,
      },
      capabilitySummary: {
        verified: 1,
        total: 6,
        status: 'gaps_remain',
      },
      idempotencyModel: {
        status: 'contract_only',
        implemented: false,
        namespace: 'warm-sms-send:v1',
        recordBeforeProviderAttempt: true,
        duplicatePolicy: 'return_existing_attempt_evidence_without_resend',
      },
      sendAuthority: {
        genericProceedAccepted: false,
        currentPerRecipientApprovalRequired: true,
        requiredApproval: 'authorize_warm_sms_send_for_specific_recipient',
        liveSendEnabled: false,
      },
      auditEvidence: {
        storesRawPhone: false,
        storesRawMessageBody: false,
      },
    })
    expect(readiness.activationReadiness.capabilitySummary.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'outbound_message_submission', status: 'verified' }),
        expect.objectContaining({ key: 'delivery_status_callbacks', status: 'gap' }),
        expect.objectContaining({ key: 'inbound_opt_out_ingestion', status: 'not_verified' }),
        expect.objectContaining({ key: 'idempotent_submission', status: 'not_verified' }),
      ]),
    )
    expect(readiness.activationReadiness.blockedRecovery.nextStep).toMatch(
      /delivery status callbacks/i,
    )
    expect(readiness.activationReadiness.blockedRecovery.steps).toHaveLength(5)
    expect(readiness.setupReadiness).toMatchObject({
      state: 'capability_mapping_required',
      selectedPath: {
        candidateKey: 'twilio_messaging',
        label: 'Twilio Messaging',
        selectionStatus: 'selected',
      },
      configurationValidation: {
        status: 'verified_disabled',
        credentialsRead: false,
        environmentVariablesChanged: false,
        providerSettingsChanged: false,
        featureFlagEnabled: false,
        requiredEnvironment: expect.arrayContaining([
          expect.objectContaining({
            key: 'SMS_PROVIDER_CREDENTIAL_REFERENCE',
            status: 'disabled_verified',
            rawValueReturned: false,
          }),
          expect.objectContaining({
            key: 'ENABLE_WARM_SMS_PROVIDER_EXECUTION',
            status: 'disabled_verified',
            rawValueReturned: false,
          }),
        ]),
      },
      operatorPath: {
        blockedByProviderSetup: expect.arrayContaining([
          'Provider API calls',
          'Live SMS delivery',
        ]),
        requiredBeforeAnyLiveSend: expect.arrayContaining([
          'All capability evidence verified',
          'Current per-recipient approval matched to contact, SMS channel, message version, and idempotency key',
        ]),
      },
      executionBoundary: {
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
        credentialsRead: false,
        environmentChanges: false,
      },
    })
    expect(readiness.setupReadiness.selectedPath.availableCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'twilio_messaging', externalCallsEnabled: false }),
        expect.objectContaining({ key: 'telnyx_messaging', externalCallsEnabled: false }),
        expect.objectContaining({ key: 'custom_disabled_adapter', externalCallsEnabled: false }),
      ]),
    )
  })

  it('keeps provider calls and sends disabled when every activation contract is reviewed', () => {
    const verified = {
      status: 'verified' as const,
      evidence: 'Synthetic contract evidence.',
    }
    const readiness = buildWarmSmsProviderReadiness(input({
      activation: {
        providerSelectionStatus: 'selected',
        providerSelectionNote: 'Synthetic provider selected.',
        providerSetupCandidate: 'telnyx_messaging',
        configurationStatus: 'verified_disabled',
        configurationNote: 'Disabled configuration contract reviewed.',
        capabilityEvidence: {
          outbound_message_submission: verified,
          delivery_status_callbacks: verified,
          inbound_opt_out_ingestion: verified,
          sender_identity_compliance: verified,
          idempotent_submission: verified,
          sandbox_or_no_send_test: verified,
        },
        reviewedAt: '2026-08-29T12:30:00.000Z',
      },
    }))

    expect(readiness.activationReadiness).toMatchObject({
      state: 'architecture_ready_activation_disabled',
      capabilitySummary: {
        verified: 6,
        total: 6,
        status: 'complete',
      },
      auditEvidence: {
        status: 'complete',
        reviewedAt: '2026-08-29T12:30:00.000Z',
      },
      executionBoundary: {
        activationEnabled: false,
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
        routeImplemented: false,
        featureFlagEnabled: false,
      },
    })
    expect(readiness.setupReadiness).toMatchObject({
      state: 'setup_ready_activation_disabled',
      label: 'Provider setup reviewed; activation remains disabled',
      selectedPath: {
        candidateKey: 'telnyx_messaging',
        label: 'Telnyx Messaging',
      },
      configurationValidation: {
        credentialsRead: false,
        environmentVariablesChanged: false,
        providerSettingsChanged: false,
        featureFlagEnabled: false,
      },
      executionBoundary: {
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
        routeImplemented: false,
      },
    })
    expect(readiness.authorizationBoundary).toMatchObject({
      genericProceedAccepted: false,
      sendRouteImplemented: false,
      externalSendEnabled: false,
    })
  })
})
