import { describe, expect, it } from 'vitest'
import {
  buildWarmSmsProviderReadiness,
  parseWarmSmsProviderTransportConfig,
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
  it('parses transport config into redacted fail-closed readiness states', () => {
    expect(parseWarmSmsProviderTransportConfig()).toMatchObject({
      state: 'not_configured',
      selectedProvider: {
        key: null,
        configured: false,
        rawValueReturned: false,
      },
      executionFlagEnabled: false,
      blockers: expect.arrayContaining(['SMS provider adapter is not configured.']),
      externalRequests: [],
    })

    const disabled = parseWarmSmsProviderTransportConfig({
      SMS_PROVIDER_ADAPTER: 'twilio',
      SMS_PROVIDER_CREDENTIAL_REFERENCE: 'infisical:/warm-sms/twilio',
      ENABLE_WARM_SMS_PROVIDER_EXECUTION: false,
    })
    expect(disabled).toMatchObject({
      state: 'configured_disabled',
      selectedProvider: {
        key: 'twilio_messaging',
        label: 'Twilio Messaging',
        rawValueReturned: false,
      },
      credentialReferenceRecorded: true,
      senderReferenceRecorded: false,
      blockers: expect.arrayContaining([
        'Sender identity reference is not recorded.',
        'Delivery callback mapping is not recorded.',
        'Opt-out callback mapping is not recorded.',
        'Delivery confirmation store mapping is not recorded.',
      ]),
      configItems: expect.arrayContaining([
        expect.objectContaining({
          key: 'SMS_PROVIDER_CREDENTIAL_REFERENCE',
          status: 'present_redacted',
          rawValueReturned: false,
        }),
      ]),
    })

    const ready = parseWarmSmsProviderTransportConfig({
      SMS_PROVIDER_ADAPTER: 'telnyx_messaging',
      SMS_PROVIDER_CREDENTIAL_REFERENCE: 'infisical:/warm-sms/telnyx',
      SMS_PROVIDER_SENDER_REFERENCE: 'telnyx-profile-ref',
      SMS_PROVIDER_DELIVERY_CALLBACK: '/api/provider/sms/delivery',
      SMS_PROVIDER_OPT_OUT_CALLBACK: '/api/provider/sms/stop',
      WARM_SMS_DELIVERY_CONFIRMATION_STORE: 'outreach_delivery_attempts',
      WARM_SMS_MESSAGE_VERSION_KEY: 'message-v1',
      WARM_SMS_IDEMPOTENCY_NAMESPACE: 'warm-sms-send:v2',
      WARM_SMS_AUDIT_KEY: 'audit-v1',
      ENABLE_WARM_SMS_PROVIDER_EXECUTION: false,
    })
    expect(ready).toMatchObject({
      state: 'configured_ready',
      selectedProvider: {
        key: 'telnyx_messaging',
        label: 'Telnyx Messaging',
      },
      senderReferenceRecorded: true,
      deliveryConfirmationStoreMapped: true,
      messageVersionKey: 'message-v1',
      idempotencyNamespace: 'warm-sms-send:v2',
      auditKey: 'audit-v1',
      blockers: [],
      externalRequests: [],
    })

    expect(parseWarmSmsProviderTransportConfig({
      SMS_PROVIDER_ADAPTER: 'unknown_sms_vendor',
      SMS_PROVIDER_UNAVAILABLE_REASON: 'Provider is not approved for Portfolio.',
    })).toMatchObject({
      state: 'unavailable',
      selectedProvider: {
        key: null,
        unavailable: true,
      },
      blockers: expect.arrayContaining([
        'Provider is not approved for Portfolio.',
      ]),
    })

    expect(parseWarmSmsProviderTransportConfig({
      SMS_PROVIDER_ADAPTER: 'twilio_messaging',
      SMS_PROVIDER_CREDENTIAL_REFERENCE: 'present',
      SMS_PROVIDER_SENDER_REFERENCE: 'present',
      SMS_PROVIDER_DELIVERY_CALLBACK: 'present',
      SMS_PROVIDER_OPT_OUT_CALLBACK: 'present',
      WARM_SMS_DELIVERY_CONFIRMATION_STORE: 'present',
      ENABLE_WARM_SMS_PROVIDER_EXECUTION: 'true',
    })).toMatchObject({
      state: 'blocked',
      executionFlagEnabled: true,
      blockers: expect.arrayContaining([
        'ENABLE_WARM_SMS_PROVIDER_EXECUTION is enabled; this readiness phase fails closed and does not send SMS.',
      ]),
      configItems: expect.arrayContaining([
        expect.objectContaining({
          key: 'ENABLE_WARM_SMS_PROVIDER_EXECUTION',
          status: 'blocked',
          rawValueReturned: false,
        }),
      ]),
    })
  })

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
      providerSelectionPlan: {
        version: 'warm-outreach-sms-provider-selection-plan/v1',
        recommendedProvider: {
          key: 'telnyx_messaging',
          label: 'Telnyx Messaging',
          status: 'recommended_for_disabled_setup_review',
          configuredInSnapshot: false,
        },
        decisionGate: {
          currentDecision: 'provider_selection_and_configuration_planning_only',
          nextRequiredApproval: 'explicit_sms_provider_activation_approval',
          activationEnabled: false,
          providerCallsEnabled: false,
          smsDeliveryEnabled: false,
          environmentVariablesChanged: false,
          externalRequests: [],
        },
      },
      transportReadiness: {
        version: 'warm-outreach-sms-provider-transport-readiness/v1',
        state: 'not_configured',
        selectedProvider: {
          configured: false,
          rawValueReturned: false,
        },
        executionBoundary: {
          providerCallsEnabled: false,
          smsDeliveryEnabled: false,
          providerActivationEnabled: false,
          credentialsRead: false,
          environmentVariablesChanged: false,
          externalRequests: [],
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
      transportReadiness: {
        state: 'configured_disabled',
        selectedProvider: {
          key: 'custom_disabled_adapter',
          label: 'Custom disabled adapter',
        },
        senderReadiness: {
          status: 'missing',
          rawSenderReturned: false,
        },
        deliveryConfirmation: {
          status: 'placeholder_only',
          providerMessageId: null,
          deliveryStatus: null,
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
    expect(readiness.transportReadiness).toMatchObject({
      state: 'blocked',
      consentSuppressionRequirements: {
        required: true,
        met: false,
        suppressionClear: false,
      },
      blockedReasons: expect.arrayContaining([
        'Stop or opt-out evidence suppresses SMS.',
        'Wrong-number evidence suppresses SMS.',
        'The contact is marked do not contact.',
      ]),
      executionBoundary: {
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
        externalRequests: [],
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
    expect(readiness.providerSelectionPlan).toMatchObject({
      version: 'warm-outreach-sms-provider-selection-plan/v1',
      recommendedProvider: {
        key: 'telnyx_messaging',
        label: 'Telnyx Messaging',
        configuredInSnapshot: false,
      },
      remainingVambahOwnedSetupStep: expect.stringContaining('redacted references'),
      mustRemainDisabledUntilExplicitActivation: [
        'ENABLE_WARM_SMS_PROVIDER_EXECUTION',
        'provider API requests',
        'live SMS delivery',
        'production env changes',
        'contact-data transmission',
      ],
      telnyxReferencePlan: {
        version: 'warm-outreach-sms-telnyx-provider-reference/v1',
        providerKey: 'telnyx_messaging',
        status: 'planning_reference_only',
        plannedAdapterValue: 'telnyx_messaging',
        plannedEnvironment: expect.arrayContaining([
          expect.objectContaining({
            key: 'SMS_PROVIDER_ADAPTER',
            plannedValue: 'telnyx_messaging planned',
            rawValueReturned: false,
            environmentMutated: false,
          }),
          expect.objectContaining({
            key: 'SMS_PROVIDER_CREDENTIAL_REFERENCE',
            rawValueReturned: false,
            environmentMutated: false,
          }),
          expect.objectContaining({ key: 'SMS_PROVIDER_SENDER_REFERENCE' }),
          expect.objectContaining({ key: 'SMS_PROVIDER_DELIVERY_CALLBACK' }),
          expect.objectContaining({ key: 'SMS_PROVIDER_OPT_OUT_CALLBACK' }),
          expect.objectContaining({ key: 'WARM_SMS_MESSAGE_VERSION_KEY' }),
          expect.objectContaining({ key: 'WARM_SMS_IDEMPOTENCY_NAMESPACE' }),
          expect.objectContaining({ key: 'WARM_SMS_AUDIT_KEY' }),
          expect.objectContaining({ key: 'WARM_SMS_DELIVERY_CONFIRMATION_STORE' }),
          expect.objectContaining({
            key: 'ENABLE_WARM_SMS_PROVIDER_EXECUTION',
            plannedValue: 'false',
          }),
        ]),
        executionBoundary: {
          providerCallsEnabled: false,
          smsDeliveryEnabled: false,
          credentialsRead: false,
          environmentVariablesChanged: false,
          migrationsApplied: false,
          productionDataMutation: false,
          externalRequests: [],
        },
      },
      decisionGate: {
        currentDecision: 'provider_selection_and_configuration_planning_only',
        nextRequiredApproval: 'explicit_sms_provider_activation_approval',
        activationEnabled: false,
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
        environmentVariablesChanged: false,
        externalRequests: [],
      },
    })
    expect(readiness.providerSelectionPlan.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'twilio_messaging',
          recommendation: 'fallback',
          consentSuppressionCompatibility: expect.stringContaining('consent'),
          deliveryCallbackRequirements: expect.stringContaining('delivered'),
          optOutHandling: expect.stringContaining('STOP'),
          idempotencySupport: expect.stringContaining('Portfolio-side'),
          expectedCredentialReferences: expect.arrayContaining([
            'SMS_PROVIDER_CREDENTIAL_REFERENCE',
            'SMS_PROVIDER_DELIVERY_CALLBACK',
            'SMS_PROVIDER_OPT_OUT_CALLBACK',
            'ENABLE_WARM_SMS_PROVIDER_EXECUTION',
          ]),
          providerCallsEnabled: false,
          smsDeliveryEnabled: false,
          rawCredentialsReturned: false,
        }),
        expect.objectContaining({
          key: 'telnyx_messaging',
          recommendation: 'recommended',
          blockers: expect.arrayContaining([
            expect.stringContaining('Vambah must confirm the owned provider account'),
          ]),
        }),
        expect.objectContaining({
          key: 'messagebird_messaging',
          recommendation: 'fallback',
        }),
        expect.objectContaining({
          key: 'custom_disabled_adapter',
          recommendation: 'review_only',
          blockers: expect.arrayContaining(['Not acceptable for live SMS activation.']),
        }),
      ]),
    )
    expect(readiness.providerSelectionPlan.telnyxReferencePlan.setupGates.map((gate) => gate.key)).toEqual([
      'confirm_telnyx_account',
      'register_sender',
      'configure_delivery_callback',
      'configure_opt_out_callback',
      'store_secret_references',
      'update_vercel_later',
      'run_no_send_canary',
      'enable_provider_later',
      'per_recipient_send_approval',
      'live_sms_canary',
    ])
    expect(readiness.providerSelectionPlan.telnyxReferencePlan.workflowSeparation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: 'manual_sms' }),
        expect.objectContaining({ channel: 'gmail' }),
        expect.objectContaining({ channel: 'slack' }),
        expect.objectContaining({ channel: 'provider_activation' }),
        expect.objectContaining({ channel: 'external_send' }),
      ]),
    )
    expect(readiness.transportReadiness).toMatchObject({
      state: 'configured_disabled',
      selectedProvider: {
        key: 'twilio_messaging',
        label: 'Twilio Messaging',
      },
      capabilityReadiness: {
        status: 'partial',
        verified: 1,
        total: 6,
      },
      auditAndIdempotency: {
        rawPhoneStored: false,
        rawMessageBodyStored: false,
        recordBeforeProviderAttempt: true,
        duplicatePolicy: 'return_existing_attempt_evidence_without_resend',
      },
      deliveryConfirmation: {
        status: 'placeholder_only',
        providerMessageId: null,
        deliveryStatus: null,
      },
      executionBoundary: {
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
        externalRequests: [],
      },
    })
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
      transportConfig: {
        SMS_PROVIDER_ADAPTER: 'telnyx_messaging',
        SMS_PROVIDER_CREDENTIAL_REFERENCE: 'infisical:/warm-sms/telnyx',
        SMS_PROVIDER_SENDER_REFERENCE: 'telnyx-sender-ref',
        SMS_PROVIDER_DELIVERY_CALLBACK: '/api/provider/sms/delivery',
        SMS_PROVIDER_OPT_OUT_CALLBACK: '/api/provider/sms/stop',
        WARM_SMS_DELIVERY_CONFIRMATION_STORE: 'outreach_delivery_attempts',
        WARM_SMS_MESSAGE_VERSION_KEY: 'message-v1',
        WARM_SMS_IDEMPOTENCY_NAMESPACE: 'warm-sms-send:v1',
        WARM_SMS_AUDIT_KEY: 'audit-v1',
        ENABLE_WARM_SMS_PROVIDER_EXECUTION: false,
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
    expect(readiness.transportReadiness).toMatchObject({
      state: 'configured_ready',
      label: 'SMS transport configured-ready; send remains off',
      selectedProvider: {
        key: 'telnyx_messaging',
        label: 'Telnyx Messaging',
        rawValueReturned: false,
      },
      senderReadiness: {
        status: 'ready',
        senderReferenceRecorded: true,
        rawSenderReturned: false,
      },
      capabilityReadiness: {
        status: 'ready',
        verified: 6,
        total: 6,
      },
      consentSuppressionRequirements: {
        met: true,
        suppressionClear: true,
        phoneProvenanceVerified: true,
        permissionDocumented: true,
        auditTimestampValid: true,
      },
      auditAndIdempotency: {
        messageVersionKey: 'message-v1',
        idempotencyNamespace: 'warm-sms-send:v1',
        auditKey: 'audit-v1',
        idempotencyKeyPreview: 'warm-sms-send:v1:contact:{contact_id}:sms:message-v1:approval:{approval_key}',
      },
      deliveryConfirmation: {
        status: 'placeholder_only',
        deliveryStoreMapped: true,
        providerMessageId: null,
        deliveryStatus: null,
      },
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
    })
    expect(readiness.providerSelectionPlan.recommendedProvider).toMatchObject({
      key: 'telnyx_messaging',
      label: 'Telnyx Messaging',
      configuredInSnapshot: true,
    })
    expect(readiness.activationChecklist).toEqual([
      expect.objectContaining({
        key: 'transport_configured',
        status: 'passed',
      }),
      expect.objectContaining({
        key: 'provider_disabled',
        status: 'blocked',
      }),
      expect.objectContaining({
        key: 'provider_enabled',
        status: 'review_required',
      }),
      expect.objectContaining({
        key: 'consent_suppression_clear',
        status: 'passed',
      }),
      expect.objectContaining({
        key: 'canary_eligible',
        status: 'blocked',
      }),
      expect.objectContaining({
        key: 'live_send_eligible',
        status: 'blocked',
      }),
    ])
    expect(readiness.noSendCanary).toMatchObject({
      version: 'warm-outreach-sms-no-send-canary-readiness/v1',
      state: 'blocked_by_readiness',
      prerequisiteSummary: {
        transportConfigured: true,
        providerDisabled: false,
        providerEnabled: true,
        consentSuppressionClear: true,
        canaryEligible: false,
        liveSendEligible: false,
      },
      result: {
        status: 'blocked',
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
        providerActivationEnabled: false,
        environmentVariablesChanged: false,
        providerMessageId: null,
        deliveryStatus: null,
        deliveryConfirmationStatus: 'placeholder_only',
        externalRequests: [],
      },
      executionBoundary: {
        simulationOnly: true,
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
        credentialsRead: false,
        databaseWritesEnabled: false,
        externalRequests: [],
      },
    })
  })

  it('marks a disabled fully mapped transport as eligible for a no-send canary simulation', () => {
    const verified = {
      status: 'verified' as const,
      evidence: 'Synthetic contract evidence.',
    }
    const readiness = buildWarmSmsProviderReadiness(input({
      provider: {
        name: 'Synthetic SMS provider',
        configured: true,
        enabled: false,
      },
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
      transportConfig: {
        SMS_PROVIDER_ADAPTER: 'telnyx_messaging',
        SMS_PROVIDER_CREDENTIAL_REFERENCE: 'infisical:/warm-sms/telnyx',
        SMS_PROVIDER_SENDER_REFERENCE: 'telnyx-sender-ref',
        SMS_PROVIDER_DELIVERY_CALLBACK: '/api/provider/sms/delivery',
        SMS_PROVIDER_OPT_OUT_CALLBACK: '/api/provider/sms/stop',
        WARM_SMS_DELIVERY_CONFIRMATION_STORE: 'outreach_delivery_attempts',
        WARM_SMS_MESSAGE_VERSION_KEY: 'message-v1',
        WARM_SMS_IDEMPOTENCY_NAMESPACE: 'warm-sms-send:v1',
        WARM_SMS_AUDIT_KEY: 'audit-v1',
        ENABLE_WARM_SMS_PROVIDER_EXECUTION: false,
      },
    }))

    expect(readiness.state).toBe('provider_configured_disabled')
    expect(readiness.activationChecklist).toEqual([
      expect.objectContaining({ key: 'transport_configured', status: 'passed' }),
      expect.objectContaining({ key: 'provider_disabled', status: 'passed' }),
      expect.objectContaining({ key: 'provider_enabled', status: 'blocked' }),
      expect.objectContaining({ key: 'consent_suppression_clear', status: 'passed' }),
      expect.objectContaining({ key: 'canary_eligible', status: 'passed' }),
      expect.objectContaining({ key: 'live_send_eligible', status: 'blocked' }),
    ])
    expect(readiness.noSendCanary).toMatchObject({
      state: 'ready_no_send_simulation',
      label: 'No-send canary can route configuration without SMS delivery',
      simulatedRoute: 'existing_warm_outreach_contact_surface',
      routePlan: {
        selectedProvider: {
          key: 'telnyx_messaging',
          label: 'Telnyx Messaging',
          rawValueReturned: false,
        },
        messageVersionKey: 'message-v1',
        idempotencyKeyPreview: 'warm-sms-send:v1:contact:{contact_id}:sms:message-v1:approval:{approval_key}',
        auditKey: 'audit-v1',
        senderReferenceRecorded: true,
        deliveryCallbackRecorded: true,
        optOutCallbackRecorded: true,
        deliveryConfirmationStoreMapped: true,
        rawPhoneReturned: false,
        rawMessageBodyReturned: false,
      },
      prerequisiteSummary: {
        transportConfigured: true,
        providerDisabled: true,
        providerEnabled: false,
        consentSuppressionClear: true,
        canaryEligible: true,
        liveSendEligible: false,
      },
      result: {
        status: 'would_route_no_send',
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
        providerActivationEnabled: false,
        environmentVariablesChanged: false,
        providerMessageId: null,
        deliveryStatus: null,
        deliveryConfirmationStatus: 'placeholder_only',
        externalRequests: [],
      },
      executionBoundary: {
        simulationOnly: true,
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
        providerActivationEnabled: false,
        credentialsRead: false,
        environmentVariablesChanged: false,
        databaseWritesEnabled: false,
        slackDispatchEnabled: false,
        gmailActionEnabled: false,
        n8nDispatchEnabled: false,
        externalRequests: [],
      },
    })
  })
})
