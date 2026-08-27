import { describe, expect, it } from 'vitest'

import { evaluateWarmOutreachReadiness, type WarmOutreachRelationshipPacket } from './warm-outreach-relationship-intelligence'
import {
  buildWarmOutreachResponseMonitoring,
  buildWarmOutreachSendReadiness,
} from './warm-outreach-response-monitoring'

function packet(overrides: Partial<WarmOutreachRelationshipPacket> = {}): WarmOutreachRelationshipPacket {
  return {
    version: 'warm-outreach-relationship/v1',
    contactId: 42,
    contactName: 'Amina Example',
    objective: 'Review warm outreach follow-up.',
    relationshipBasis: 'Prior meeting context and a local outreach history support a warm follow-up.',
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
    ],
    relationshipSignals: ['prior meeting context'],
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
        available: true,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: false,
        reason: 'LinkedIn remains draft-only.',
      },
      facebook: {
        available: true,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: true,
        reason: 'Facebook remains manual-only.',
      },
      phone_contact: {
        available: true,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: true,
        reason: 'Phone remains manual-only.',
      },
    },
    preferredChannel: 'email',
    ...overrides,
  }
}

describe('warm outreach response monitoring', () => {
  it('derives manual response monitoring state from local communication evidence', () => {
    const inputPacket = packet()
    const readiness = evaluateWarmOutreachReadiness(inputPacket)
    const monitoring = buildWarmOutreachResponseMonitoring({
      contactId: 42,
      packet: inputPacket,
      readiness,
      rows: {
        contactCommunications: [
          {
            id: 'comm-1',
            channel: 'email',
            direction: 'inbound',
            message_type: 'reply',
            subject: 'Re: hello',
            status: 'captured',
            sent_at: '2026-08-24T12:00:00.000Z',
            source_system: 'manual',
            source_id: 'warm-outreach:reply:manual:abc123',
            metadata: { provider: 'manual' },
          },
        ],
        outreachQueue: [
          {
            id: 'queue-1',
            channel: 'email',
            status: 'sent',
            subject: 'Hello',
            sent_at: '2026-08-20T12:00:00.000Z',
          },
        ],
      },
      now: new Date('2026-08-26T12:00:00.000Z'),
    })

    expect(monitoring).toMatchObject({
      version: 'warm-outreach-response-monitoring/v1',
      contactId: 42,
      mode: 'manual',
      status: 'manual_response_captured',
      latestResponseAt: '2026-08-24T12:00:00.000Z',
      proposedFollowUp: {
        state: 'review_response',
        requiresHumanApproval: true,
      },
      executionBoundary: {
        localRowsOnly: true,
        manualImportEnabled: true,
        providerPollingEnabled: false,
        externalMonitoringEnabled: false,
        externalSendEnabled: false,
        gmailDraftCreationEnabled: false,
        n8nDispatchEnabled: false,
      },
    })
    expect(monitoring.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'contact_communications',
          evidenceType: 'manual_response',
          sourceId: 'comm-1',
        }),
        expect.objectContaining({
          sourceType: 'outreach_queue',
          evidenceType: 'expected_reply',
          sourceId: 'queue-1',
        }),
      ]),
    )
  })

  it('derives imported response monitoring state without enabling provider polling', () => {
    const inputPacket = packet()
    const monitoring = buildWarmOutreachResponseMonitoring({
      contactId: 42,
      packet: inputPacket,
      readiness: evaluateWarmOutreachReadiness(inputPacket),
      rows: {
        emailMessages: [
          {
            id: 'email-1',
            channel: 'email',
            direction: 'inbound',
            email_kind: 'reply',
            status: 'imported',
            subject: 'Re: follow-up',
            sent_at: '2026-08-25T09:00:00.000Z',
            source_system: 'gmail_import',
            source_id: 'gmail-message-1',
          },
        ],
      },
      now: new Date('2026-08-26T12:00:00.000Z'),
    })

    expect(monitoring.mode).toBe('imported')
    expect(monitoring.status).toBe('imported_response_captured')
    expect(monitoring.evidence).toContainEqual(
      expect.objectContaining({
        sourceType: 'email_messages',
        evidenceType: 'imported_response',
        sourceId: 'email-1',
      }),
    )
    expect(monitoring.executionBoundary.providerResponseImportEnabled).toBe(false)
    expect(monitoring.executionBoundary.providerPollingEnabled).toBe(false)
  })

  it('detects stale no-response state from the latest local outreach row', () => {
    const inputPacket = packet()
    const monitoring = buildWarmOutreachResponseMonitoring({
      contactId: 42,
      packet: inputPacket,
      readiness: evaluateWarmOutreachReadiness(inputPacket),
      staleAfterDays: 7,
      now: new Date('2026-08-26T12:00:00.000Z'),
      rows: {
        outreachQueue: [
          {
            id: 'queue-1',
            channel: 'email',
            status: 'sent',
            subject: 'Warm note',
            sent_at: '2026-08-10T12:00:00.000Z',
          },
        ],
      },
    })

    expect(monitoring.status).toBe('stale_no_response')
    expect(monitoring.mode).toBe('pending')
    expect(monitoring.expectedReplyBy).toBe('2026-08-17T12:00:00.000Z')
    expect(monitoring.proposedFollowUp).toMatchObject({
      state: 'stale_follow_up_review',
      requiresHumanApproval: true,
    })
  })

  it('fails closed for suppressed contacts before send-readiness state', () => {
    const suppressed = packet({
      suppression: {
        doNotContact: true,
        unsubscribed: false,
        removedAt: null,
        suppressionReason: 'Manual DNC review is active.',
      },
    })
    const monitoring = buildWarmOutreachResponseMonitoring({
      contactId: 42,
      packet: suppressed,
      readiness: evaluateWarmOutreachReadiness(suppressed),
      rows: {},
    })

    expect(monitoring.status).toBe('blocked')
    expect(monitoring.mode).toBe('blocked')
    expect(monitoring.blockedReasons).toContain('Manual DNC review is active.')
    for (const channel of monitoring.sendReadiness.modes.warm_1_to_1) {
      expect(channel.state === 'blocked' || channel.state === 'unavailable').toBe(true)
      expect(channel.sendReady).toBe(false)
      expect(channel.externalSendEnabled).toBe(false)
      expect(channel.providerExecutionEnabled).toBe(false)
    }
  })

  it('keeps per-recipient idempotency stable and distinct for warm 1:many recipients', () => {
    const firstPacket = packet({ contactId: 42 })
    const secondPacket = packet({ contactId: 77, contactName: 'Second Contact' })
    const first = buildWarmOutreachSendReadiness({
      contactId: 42,
      packet: firstPacket,
      readiness: evaluateWarmOutreachReadiness(firstPacket),
    })
    const firstAgain = buildWarmOutreachSendReadiness({
      contactId: 42,
      packet: firstPacket,
      readiness: evaluateWarmOutreachReadiness(firstPacket),
    })
    const second = buildWarmOutreachSendReadiness({
      contactId: 77,
      packet: secondPacket,
      readiness: evaluateWarmOutreachReadiness(secondPacket),
    })

    expect(first.perRecipientIdempotencyKey).toBe(firstAgain.perRecipientIdempotencyKey)
    expect(first.perRecipientIdempotencyKey).not.toBe(second.perRecipientIdempotencyKey)
    expect(first.modes.warm_1_to_many.map((item) => item.idempotencyKey)).toHaveLength(4)
    expect(new Set(first.modes.warm_1_to_many.map((item) => item.idempotencyKey)).size).toBe(4)
  })

  it('exposes explicit send-disabled readiness for every mode and channel', () => {
    const inputPacket = packet()
    const readiness = buildWarmOutreachSendReadiness({
      contactId: 42,
      packet: inputPacket,
      readiness: evaluateWarmOutreachReadiness(inputPacket),
    })

    expect(Object.keys(readiness.modes)).toEqual(['warm_1_to_1', 'warm_1_to_many'])
    for (const mode of Object.values(readiness.modes)) {
      expect(mode.map((item) => item.channel)).toEqual(['email', 'linkedin', 'facebook', 'phone_contact'])
      for (const item of mode) {
        expect(item.sendReady).toBe(false)
        expect(item.externalSendEnabled).toBe(false)
        expect(item.providerExecutionEnabled).toBe(false)
        expect(item.humanApprovalRequired).toBe(true)
        expect(item.gatesRemaining).toEqual(
          expect.arrayContaining([
            'human_reply_or_draft_approval',
            'external_send_authority',
            'provider_execution_gate',
          ]),
        )
        if (item.channel === 'email') {
          expect(item.emailSendLifecycle).toMatchObject({
            version: 'warm-outreach-email-send-lifecycle/v1',
            channel: 'email',
            firstCandidateChannel: true,
            sendReady: false,
            externalSendEnabled: false,
            providerExecutionEnabled: false,
            gmailDraftCreationEnabled: false,
            schedulingEnabled: false,
            auditState: {
              status: 'scaffold_only',
              notes: expect.arrayContaining([
                'No Gmail draft, Gmail send, provider smoke, schedule, or submitted evidence mutation is enabled.',
              ]),
            },
          })
        } else {
          expect(item.emailSendLifecycle).toBeNull()
        }
      }
    }
    expect(readiness.executionBoundary).toEqual({
      gmailEmailSend: false,
      linkedinAction: false,
      facebookAction: false,
      phoneAction: false,
      providerExecution: false,
      scheduling: false,
      externalMonitoring: false,
      gmailDraftCreation: false,
      outcomeTracking: false,
    })
  })

  it('builds governed send-authority gates without approving external sends', () => {
    const inputPacket = packet()
    const readiness = buildWarmOutreachSendReadiness({
      contactId: 42,
      packet: inputPacket,
      readiness: evaluateWarmOutreachReadiness(inputPacket),
    })
    const emailAuthority = readiness.modes.warm_1_to_1.find((item) => item.channel === 'email')?.sendAuthority
    const emailLifecycle = readiness.modes.warm_1_to_1.find((item) => item.channel === 'email')?.emailSendLifecycle
    const facebookAuthority = readiness.modes.warm_1_to_1.find((item) => item.channel === 'facebook')?.sendAuthority
    const batchEmailAuthority = readiness.modes.warm_1_to_many.find((item) => item.channel === 'email')?.sendAuthority
    const batchEmailLifecycle = readiness.modes.warm_1_to_many.find((item) => item.channel === 'email')?.emailSendLifecycle

    expect(emailAuthority).toMatchObject({
      version: 'warm-outreach-send-authority/v1',
      mode: 'warm_1_to_1',
      channel: 'email',
      state: 'eligible_for_future_activation',
      futureActivationEligible: true,
      externalSendApproved: false,
      externalSendEnabled: false,
      providerExecutionEnabled: false,
      gmailDraftCreationEnabled: false,
      schedulingEnabled: false,
      outcomeTrackingEnabled: false,
      humanApprovalRequired: true,
    })
    expect(emailAuthority?.gates.map((gate) => gate.key)).toEqual([
      'target_source_provenance',
      'relationship_basis',
      'consent_suppression',
      'personalization',
      'human_approval',
      'provider_capability',
      'idempotency',
      'send_scheduling',
      'outcome_tracking',
      'response_follow_up',
    ])
    expect(emailAuthority?.gates.find((gate) => gate.key === 'provider_capability')).toMatchObject({
      status: 'future_gate',
      externalExecutionEnabled: false,
    })
    expect(emailAuthority?.idempotencyKey).toMatch(/^warm-outreach:send-readiness:v1:/)
    expect(emailLifecycle).toMatchObject({
      state: 'blocked_before_provider_activation',
      label: 'Email is first candidate, provider/send activation blocked',
      suppressionCheck: { status: 'clear' },
      relationshipProvenance: {
        status: 'present',
        sourceCount: 1,
        signalCount: 1,
      },
      personalizationProvenance: {
        status: 'present',
        safeToMentionCount: 1,
        summarizeOnlyCount: 1,
        commonalityCount: 1,
      },
      duplicatePrevention: {
        scope: 'contact_channel_message_version',
        duplicateDetected: false,
      },
    })
    expect(emailLifecycle?.messageVersionKey).toMatch(/^warm-outreach:email-message-version:v1:/)
    expect(emailLifecycle?.sendQueueIdempotencyKey).toMatch(/^warm-outreach:email-send-queue:v1:/)
    expect(emailLifecycle?.providerCapabilitySmokeKey).toMatch(/^warm-outreach:gmail-capability-smoke:v1:/)
    expect(emailLifecycle?.submittedEvidenceKey).toMatch(/^warm-outreach:email-submitted-evidence:v1:/)
    expect(emailLifecycle?.stages.map((stage) => stage.key)).toEqual([
      'draft_packet',
      'human_reply_or_draft_approval',
      'send_authority_review',
      'provider_capability_smoke',
      'scheduled_send_queue',
      'submitted_sent_evidence',
    ])
    expect(emailLifecycle?.stages.find((stage) => stage.key === 'draft_packet')).toMatchObject({
      status: 'ready_for_review',
      externalExecutionEnabled: false,
    })
    expect(emailLifecycle?.stages.find((stage) => stage.key === 'provider_capability_smoke')).toMatchObject({
      status: 'blocked',
      externalExecutionEnabled: false,
    })

    expect(facebookAuthority).toMatchObject({
      state: 'manual_only',
      futureActivationEligible: false,
      manualSteps: expect.arrayContaining([
        'Review the relationship packet in Portfolio.',
        'Record the outcome back into local Portfolio rows.',
      ]),
    })
    expect(facebookAuthority?.gates.find((gate) => gate.key === 'provider_capability')).toMatchObject({
      status: 'manual_required',
    })

    expect(batchEmailAuthority).toMatchObject({
      mode: 'warm_1_to_many',
      state: 'blocked',
      futureActivationEligible: false,
      externalSendEnabled: false,
    })
    expect(batchEmailAuthority?.blockers).toContain(
      'Batch recipients require per-contact review before any send-readiness state.',
    )
    expect(batchEmailAuthority?.blockers).toContain(
      'Batch email sends require individual readiness and future explicit send authority per recipient.',
    )
    expect(batchEmailLifecycle).toMatchObject({
      mode: 'warm_1_to_many',
      state: 'per_recipient_gate_required',
      sendReady: false,
    })
  })

  it('detects duplicate local email queue states without enabling Gmail execution', () => {
    const inputPacket = packet()
    const monitoring = buildWarmOutreachResponseMonitoring({
      contactId: 42,
      packet: inputPacket,
      readiness: evaluateWarmOutreachReadiness(inputPacket),
      rows: {
        outreachQueue: [
          {
            id: 'queue-scheduled',
            channel: 'email',
            status: 'scheduled',
            subject: 'Warm note',
          },
        ],
      },
    })
    const lifecycle = monitoring.sendReadiness.modes.warm_1_to_1.find((item) => item.channel === 'email')
      ?.emailSendLifecycle

    expect(lifecycle).toMatchObject({
      duplicatePrevention: {
        duplicateDetected: true,
        existingEvidenceIds: ['queue-scheduled'],
      },
      externalSendEnabled: false,
      providerExecutionEnabled: false,
      gmailDraftCreationEnabled: false,
    })
    expect(lifecycle?.stages.find((stage) => stage.key === 'scheduled_send_queue')).toMatchObject({
      status: 'blocked',
      externalExecutionEnabled: false,
    })
  })

  it('blocks send authority when provenance, personalization, or suppression gates fail', () => {
    const weakSuppressed = packet({
      relationshipBasis: 'Limited local relationship evidence is available.',
      sourceRefs: [
        {
          sourceType: 'portfolio_contact',
          summary: 'Contact row only.',
          privateSource: false,
          sourceStatus: 'present',
        },
      ],
      relationshipSignals: [],
      commonalities: [],
      sourceInventory: {
        sourceStatus: [{ sourceType: 'contact_submissions', status: 'present' }],
        safeToMention: [],
        summarizeOnly: [],
        doNotMention: [],
      },
      suppression: {
        doNotContact: true,
        unsubscribed: false,
        removedAt: null,
        suppressionReason: 'Manual DNC review is active.',
      },
    })
    const readiness = buildWarmOutreachSendReadiness({
      contactId: 42,
      packet: weakSuppressed,
      readiness: evaluateWarmOutreachReadiness(weakSuppressed),
    })
    const authority = readiness.modes.warm_1_to_1.find((item) => item.channel === 'email')?.sendAuthority

    expect(authority).toMatchObject({
      state: 'blocked',
      futureActivationEligible: false,
      externalSendApproved: false,
      externalSendEnabled: false,
      providerExecutionEnabled: false,
    })
    expect(authority?.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'target_source_provenance', status: 'blocked' }),
        expect.objectContaining({ key: 'relationship_basis', status: 'blocked' }),
        expect.objectContaining({ key: 'consent_suppression', status: 'blocked' }),
        expect.objectContaining({ key: 'personalization', status: 'blocked' }),
      ]),
    )
  })
})
