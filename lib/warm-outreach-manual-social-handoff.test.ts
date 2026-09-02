import { describe, expect, it } from 'vitest'

import { evaluateWarmOutreachReadiness, type WarmOutreachRelationshipPacket } from './warm-outreach-relationship-intelligence'
import { buildWarmManualSocialHandoff } from './warm-outreach-manual-social-handoff'

const packet: WarmOutreachRelationshipPacket = {
  version: 'warm-outreach-relationship/v1',
  contactId: 42,
  contactName: 'Amina Example',
  objective: 'Prepare a manual warm outreach handoff.',
  relationshipBasis: 'Prior AmaduTown strategy conversation and a local meeting follow-up.',
  sourceRefs: [
    {
      sourceType: 'meeting_record',
      sourceId: 'meeting-42',
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
    safeToMention: ['public operations context'],
    summarizeOnly: ['meeting notes'],
    doNotMention: ['raw transcript'],
  },
  openingPitchGuidance: {
    safeCommonalities: ['operations follow-up'],
    openingAngle: 'Reconnect around the meeting follow-up.',
    channelNotes: {},
  },
  suggestedNextStep: 'compare notes on a small operations review',
  avoidContext: ['Do not quote private notes.'],
  confidence: 'medium',
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
      reason: 'Email draft only.',
    },
    linkedin: {
      available: true,
      providerConfigured: false,
      supportsExternalSend: false,
      manualOnly: false,
      reason: 'LinkedIn copy only.',
    },
    facebook: {
      available: true,
      providerConfigured: false,
      supportsExternalSend: false,
      manualOnly: true,
      reason: 'Facebook manual only.',
    },
    phone_contact: {
      available: true,
      providerConfigured: false,
      supportsExternalSend: false,
      manualOnly: true,
      reason: 'Phone contact manual only.',
    },
  },
  preferredChannel: 'linkedin',
}

describe('warm manual social handoff', () => {
  it('builds LinkedIn, Facebook, and phone handoffs without provider execution', () => {
    const readiness = evaluateWarmOutreachReadiness(packet)
    const handoff = buildWarmManualSocialHandoff({ packet, readiness })

    expect(handoff).toMatchObject({
      version: 'warm-outreach-manual-social-handoff/v1',
      contactId: '42',
      state: 'ready',
      currentCta: {
        key: 'copy_manual_text',
        label: 'Copy LinkedIn text',
        enabled: true,
        channel: 'linkedin',
      },
      executionBoundary: {
        manualCopyOnly: true,
        providerCallsEnabled: false,
        externalSendEnabled: false,
        gmailDraftCreationEnabled: false,
        slackDispatchEnabled: false,
        smsDeliveryEnabled: false,
        n8nDispatchEnabled: false,
        productionDataMutation: false,
        externalRequests: [],
      },
    })
    expect(handoff.channels.map((channel) => channel.channel)).toEqual([
      'linkedin',
      'facebook',
      'phone_contact',
    ])
    expect(handoff.channels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: 'facebook',
          state: 'ready_for_manual_copy',
          executionBoundary: expect.objectContaining({
            facebookApiEnabled: false,
            externalRequests: [],
          }),
          evidencePolicy: expect.objectContaining({
            storesRawMessageBody: false,
            storesRawContactDetails: false,
          }),
        }),
        expect.objectContaining({
          channel: 'phone_contact',
          preview: expect.stringContaining('Hi Amina'),
          executionBoundary: expect.objectContaining({
            phoneAccessEnabled: false,
            smsDeliveryEnabled: false,
          }),
        }),
      ]),
    )
    for (const channel of handoff.channels) {
      expect(channel.idempotency.manualEvidenceKey).toMatch(/^warm-outreach:manual-evidence:v1:/)
      expect(channel.checklist).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'record_minimal_evidence' }),
          expect.objectContaining({ key: 'no_provider_automation' }),
        ]),
      )
    }
  })

  it('blocks manual handoff copy when relationship readiness is blocked', () => {
    const blockedPacket: WarmOutreachRelationshipPacket = {
      ...packet,
      suppression: {
        doNotContact: true,
        unsubscribed: false,
        suppressionReason: 'Operator marked this contact do not contact.',
      },
    }
    const readiness = evaluateWarmOutreachReadiness(blockedPacket)
    const handoff = buildWarmManualSocialHandoff({ packet: blockedPacket, readiness })

    expect(handoff.state).toBe('blocked')
    expect(handoff.currentCta).toMatchObject({
      key: 'review_blocker',
      enabled: false,
    })
    expect(handoff.channels[0]).toMatchObject({
      state: 'blocked',
      blocker: 'Operator marked this contact do not contact.',
      preview: '',
    })
  })
})
