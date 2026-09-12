import { describe, expect, it } from 'vitest'

import {
  evaluateWarmOutreachReadiness,
  type WarmOutreachRelationshipPacket,
} from './warm-outreach-relationship-intelligence'
import {
  buildWarmSmsReadiness,
  evaluateWarmSmsManualLoop,
  selectWarmSmsTemplateFamily,
} from './warm-outreach-sms-readiness'

function packet(overrides: Partial<WarmOutreachRelationshipPacket> = {}): WarmOutreachRelationshipPacket {
  return {
    version: 'warm-outreach-relationship/v1',
    contactId: 42,
    contactName: 'Amina Example',
    objective: 'Review warm SMS follow-up.',
    relationshipBasis: 'Prior meeting context and a local outreach history support a warm follow-up.',
    relationshipEventId: 'meeting-1',
    sourceRefs: [
      {
        sourceType: 'meeting_record',
        sourceId: 'meeting-1',
        summary: 'Meeting summary is available as internal context.',
        privateSource: true,
        visibility: 'private_sensitive',
        mentionSafety: 'summarize_only',
        sourceStatus: 'present',
      },
      {
        sourceType: 'prior_outreach',
        sourceId: 'queue-1',
        summary: 'Prior warm email follow-up exists.',
        privateSource: false,
        visibility: 'portfolio_internal',
        mentionSafety: 'safe_to_mention',
        sourceStatus: 'present',
      },
    ],
    relationshipSignals: ['prior meeting context', 'prior email follow-up'],
    commonalities: ['operations follow-up'],
    riskFlags: [],
    sourceInventory: {
      sourceStatus: [{ sourceType: 'meeting_records', status: 'present' }],
      safeToMention: ['company context'],
      summarizeOnly: ['meeting notes'],
      doNotMention: [],
    },
    suggestedNextStep: 'Review the next follow-up.',
    avoidContext: [],
    responseMonitoringPlan: {
      enabled: false,
      plan: 'Provider monitoring requires a later activation gate.',
      externalActivationRequired: true,
    },
    confidence: 'high',
    suppression: {
      doNotContact: false,
      unsubscribed: false,
      removedAt: null,
    },
    channelCapabilities: {
      email: {
        available: true,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: false,
        reason: 'Email remains draft-only.',
      },
      linkedin: {
        available: false,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: false,
      },
      facebook: {
        available: false,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: true,
      },
      phone_contact: {
        available: true,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: true,
        reason: 'Phone number is present on the Portfolio contact record.',
      },
    },
    preferredChannel: 'phone_contact',
    ...overrides,
  }
}

describe('warm SMS readiness', () => {
  it('classifies a relationship-backed phone contact as manual-ready without enabling delivery', () => {
    const input = packet()
    const readiness = buildWarmSmsReadiness({
      packet: input,
      readiness: evaluateWarmOutreachReadiness(input),
    })

    expect(readiness).toMatchObject({
      version: 'warm-outreach-sms-readiness/v1',
      contactId: '42',
      channel: 'phone_contact',
      state: 'manual_review_required',
      phoneReadiness: {
        present: true,
        source: 'contact_submissions.phone_number',
        rawPhoneReturned: false,
      },
      relationshipRationale: {
        status: 'present',
        sourceCount: 2,
        signalCount: 2,
      },
      consentAndSuppression: {
        status: 'clear_for_manual_review',
      },
      approval: {
        state: 'not_reviewed',
        recordsManualReadinessOnly: true,
        smsDeliveryEnabled: false,
        providerCallsEnabled: false,
        externalSendEnabled: false,
        genericProceedAccepted: false,
      },
      executionBoundary: {
        manualOnly: true,
        smsProviderConfigured: false,
        smsProviderCalls: false,
        smsDelivery: false,
        phoneImport: false,
        slackDispatch: false,
        gmailAction: false,
        n8nDispatch: false,
        productionDataMutation: false,
      },
    })
    expect(readiness.draft.preview.length).toBeLessThanOrEqual(240)
    expect(readiness.consentAndSuppression.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'phone_present', status: 'passed' }),
        expect.objectContaining({ key: 'opt_out', status: 'review_required' }),
        expect.objectContaining({ key: 'manual_only', status: 'review_required' }),
      ]),
    )
  })

  it('fails closed when the phone number is missing', () => {
    const input = packet({
      channelCapabilities: {
        ...packet().channelCapabilities,
        phone_contact: {
          available: false,
          providerConfigured: false,
          supportsExternalSend: false,
          manualOnly: true,
          reason: 'No phone number is present.',
        },
      },
    })
    const readiness = buildWarmSmsReadiness({
      packet: input,
      readiness: evaluateWarmOutreachReadiness(input),
    })

    expect(readiness.state).toBe('blocked')
    expect(readiness.phoneReadiness).toMatchObject({
      present: false,
      source: 'missing',
    })
    expect(readiness.consentAndSuppression.blockers).toContain(
      'No phone number is present in the Portfolio contact record.',
    )
    expect(readiness.recoveryStep).toBe('No phone number is present in the Portfolio contact record.')
  })

  it('fails closed for suppression and opt-out evidence', () => {
    const input = packet({
      suppression: {
        doNotContact: true,
        unsubscribed: true,
        removedAt: null,
        suppressionReason: 'Manual SMS opt-out review is active.',
      },
    })
    const readiness = buildWarmSmsReadiness({
      packet: input,
      readiness: evaluateWarmOutreachReadiness(input),
    })

    expect(readiness.state).toBe('blocked')
    expect(readiness.consentAndSuppression.status).toBe('blocked')
    expect(readiness.consentAndSuppression.blockers).toEqual(
      expect.arrayContaining([
        'Manual SMS opt-out review is active.',
        'Contact is unsubscribed.',
        'Contact is marked do not contact.',
        'Contact is unsubscribed or opted out.',
      ]),
    )
    expect(readiness.consentAndSuppression.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'suppression', status: 'blocked' }),
        expect.objectContaining({ key: 'opt_out', status: 'blocked' }),
      ]),
    )
    expect(readiness.executionBoundary.smsDelivery).toBe(false)
    expect(readiness.executionBoundary.smsProviderCalls).toBe(false)
  })

  it('requires relationship provenance before SMS review', () => {
    const input = packet({
      relationshipBasis: 'Portfolio has limited local relationship evidence for this contact.',
      sourceRefs: [
        {
          sourceType: 'portfolio_contact',
          sourceId: '42',
          summary: 'Contact record exists.',
          privateSource: false,
          visibility: 'portfolio_internal',
          mentionSafety: 'summarize_only',
          sourceStatus: 'present',
        },
      ],
      relationshipSignals: [],
      commonalities: [],
    })
    const readiness = buildWarmSmsReadiness({
      packet: input,
      readiness: evaluateWarmOutreachReadiness(input),
    })

    expect(readiness.state).toBe('blocked')
    expect(readiness.relationshipRationale.status).toBe('missing')
    expect(readiness.consentAndSuppression.status).toBe('relationship_rationale_required')
    expect(readiness.consentAndSuppression.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'relationship_basis', status: 'blocked' }),
      ]),
    )
  })

  it('selects SMS template families from relationship evidence', () => {
    expect(selectWarmSmsTemplateFamily(packet()).family).toBe('prior_email_follow_up')
    expect(selectWarmSmsTemplateFamily(packet({
      relationshipBasis: 'A board mentor and advisor asked for an update.',
      sourceRefs: [],
      relationshipSignals: ['advisor relationship'],
    })).family).toBe('advisor_investor')
    expect(selectWarmSmsTemplateFamily(packet({
      relationshipBasis: 'A mutual referral introduced us.',
      sourceRefs: [],
      relationshipSignals: ['common connection intro'],
    })).family).toBe('referral_common_connection')
    expect(selectWarmSmsTemplateFamily(packet({
      relationshipBasis: 'We met through a community nonprofit event.',
      sourceRefs: [],
      relationshipSignals: ['community event'],
    })).family).toBe('community_relationship')
    expect(selectWarmSmsTemplateFamily(packet({
      relationshipBasis: 'Dormant lead with a long time since the last touch.',
      sourceRefs: [],
      relationshipSignals: ['reconnect'],
    })).family).toBe('dormant_lead')
    expect(selectWarmSmsTemplateFamily(packet({
      objective: 'Review warm SMS note.',
      relationshipBasis: 'Worked together before on operations.',
      sourceRefs: [],
      relationshipSignals: ['collaborator'],
      commonalities: [],
    })).family).toBe('prior_collaborator')
  })

  it('evaluates manual SMS loop transitions without enabling provider gates', () => {
    const base = {
      readinessState: 'manual_ready' as const,
      approvalState: 'approved_manual_ready' as const,
      draftText: 'Hi Amina, worth a quick check-in this week?',
      draftRevised: false,
      manualSendPrepared: false,
      evidenceRecorded: false,
      evidence: {
        sentAt: null,
        channel: 'manual_sms' as const,
        operatorNote: '',
        outcome: 'no_response_yet' as const,
      },
    }

    expect(evaluateWarmSmsManualLoop(base)).toMatchObject({
      state: 'readiness_reviewed',
      gates: {
        canCopyApprovedDraft: true,
        canPrepareManualSend: true,
        smsDeliveryEnabled: false,
        externalProviderCallsEnabled: false,
        genericProceedAccepted: false,
      },
    })
    expect(evaluateWarmSmsManualLoop({
      ...base,
      draftRevised: true,
      approvalState: 'revision_requested',
    }).state).toBe('draft_revised')
    expect(evaluateWarmSmsManualLoop({
      ...base,
      manualSendPrepared: true,
    }).state).toBe('manual_send_prepared')
    expect(evaluateWarmSmsManualLoop({
      ...base,
      manualSendPrepared: true,
      evidenceRecorded: true,
    })).toMatchObject({
      state: 'manual_send_evidence_recorded',
      evidenceComplete: false,
      missingEvidence: ['timestamp', 'operator note'],
    })
    expect(evaluateWarmSmsManualLoop({
      ...base,
      manualSendPrepared: true,
      evidenceRecorded: true,
      evidence: {
        sentAt: '2026-08-29T12:00:00.000Z',
        channel: 'manual_sms',
        operatorNote: 'Sent manually from phone after review.',
        outcome: 'no_response_yet',
      },
    })).toMatchObject({
      state: 'response_expected',
      evidenceComplete: true,
      response: {
        responseReceived: false,
        followUpDraftNeeded: false,
        suppressesFutureSms: false,
      },
    })
  })

  it('classifies manual SMS outcomes and suppresses future prompts on stop states', () => {
    const base = {
      readinessState: 'manual_ready' as const,
      approvalState: 'approved_manual_ready' as const,
      draftText: 'Hi Amina, worth a quick check-in this week?',
      draftRevised: false,
      manualSendPrepared: true,
      evidenceRecorded: true,
      evidence: {
        sentAt: '2026-08-29T12:00:00.000Z',
        channel: 'manual_sms' as const,
        operatorNote: 'Sent manually from phone after review.',
        outcome: 'interested' as const,
      },
    }

    expect(evaluateWarmSmsManualLoop(base)).toMatchObject({
      state: 'follow_up_draft_needed',
      response: {
        responseReceived: true,
        followUpDraftNeeded: true,
        suppressesFutureSms: false,
      },
    })
    expect(evaluateWarmSmsManualLoop({
      ...base,
      evidence: {
        ...base.evidence,
        outcome: 'not_now',
      },
    })).toMatchObject({
      state: 'response_received',
      response: {
        responseReceived: true,
        followUpDraftNeeded: false,
        suppressesFutureSms: false,
      },
    })
    expect(evaluateWarmSmsManualLoop({
      ...base,
      evidence: {
        ...base.evidence,
        outcome: 'stop_opt_out',
      },
    })).toMatchObject({
      state: 'suppressed_stop',
      response: {
        suppressesFutureSms: true,
      },
      gates: {
        canCopyApprovedDraft: false,
        canPrepareManualSend: false,
        smsPromptsSuppressed: true,
      },
    })
    expect(evaluateWarmSmsManualLoop({
      ...base,
      evidence: {
        ...base.evidence,
        outcome: 'wrong_number',
      },
    }).state).toBe('suppressed_stop')
  })
})
