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
    })

    const disabled = buildWarmSmsProviderReadiness(input({
      provider: { name: 'Synthetic SMS provider', configured: true, enabled: false },
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
})
