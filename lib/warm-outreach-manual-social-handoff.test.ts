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

  it('locks a channel when durable manual evidence is read back from Portfolio rows', () => {
    const readiness = evaluateWarmOutreachReadiness(packet)
    const initial = buildWarmManualSocialHandoff({ packet, readiness })
    const linkedin = initial.channels.find((channel) => channel.channel === 'linkedin')!
    const evidenceRow = {
      id: 'manual-communication-1',
      contact_submission_id: 42,
      source_system: 'manual',
      source_id: linkedin.idempotency.manualEvidenceKey,
      status: 'sent',
      sent_at: '2026-09-02T13:00:00.000Z',
      metadata: {
        version: 'warm-outreach-manual-social-evidence/v1',
        status: 'manual_sent_recorded',
        contact_submission_id: 42,
        channel: 'linkedin',
        manual_channel: 'linkedin',
        message_version_key: linkedin.idempotency.messageVersionKey,
        manual_handoff_key: linkedin.idempotency.manualHandoffKey,
        manual_evidence_key: linkedin.idempotency.manualEvidenceKey,
        operator_note: 'Copied manually after relationship review.',
        recorded_at: '2026-09-02T13:00:00.000Z',
        provider_calls_enabled: false,
        external_send_enabled: false,
        linkedin_api_called: false,
        facebook_api_called: false,
        phone_access_called: false,
        sms_delivery_enabled: false,
        gmail_draft_created: false,
        slack_dispatch_enabled: false,
        n8n_dispatch_enabled: false,
        raw_message_body_stored: false,
        raw_contact_details_stored: false,
        screenshot_stored: false,
        provider_identifiers_stored: false,
        external_requests: [],
      },
    }
    const reloaded = buildWarmManualSocialHandoff({
      packet,
      readiness,
      evidenceRows: [evidenceRow],
    })

    expect(reloaded.channels.find((channel) => channel.channel === 'linkedin')).toMatchObject({
      state: 'manual_sent_recorded',
      durableEvidence: {
        status: 'manual_sent_recorded',
        contactId: '42',
        channel: 'linkedin',
        messageVersionKey: linkedin.idempotency.messageVersionKey,
        manualEvidenceKey: linkedin.idempotency.manualEvidenceKey,
        operatorNote: 'Copied manually after relationship review.',
        privacyBoundary: {
          storesRawMessageBody: false,
          storesRawContactDetails: false,
          storesScreenshot: false,
          storesProviderIdentifiers: false,
        },
        executionBoundary: {
          providerCallsEnabled: false,
          externalSendEnabled: false,
          linkedinApiEnabled: false,
          externalRequests: [],
        },
      },
      evidenceLock: {
        locked: true,
      },
    })
    expect(reloaded.currentCta.channel).toBe('facebook')
  })

  it('ignores evidence rows that fail privacy or provider boundary checks', () => {
    const readiness = evaluateWarmOutreachReadiness(packet)
    const initial = buildWarmManualSocialHandoff({ packet, readiness })
    const linkedin = initial.channels.find((channel) => channel.channel === 'linkedin')!
    const reloaded = buildWarmManualSocialHandoff({
      packet,
      readiness,
      evidenceRows: [{
        id: 'unsafe-communication-1',
        contact_submission_id: 42,
        source_system: 'manual',
        source_id: linkedin.idempotency.manualEvidenceKey,
        status: 'sent',
        sent_at: '2026-09-02T13:00:00.000Z',
        metadata: {
          version: 'warm-outreach-manual-social-evidence/v1',
          status: 'manual_sent_recorded',
          contact_submission_id: 42,
          channel: 'linkedin',
          message_version_key: linkedin.idempotency.messageVersionKey,
          manual_handoff_key: linkedin.idempotency.manualHandoffKey,
          manual_evidence_key: linkedin.idempotency.manualEvidenceKey,
          provider_calls_enabled: true,
          external_send_enabled: false,
          linkedin_api_called: false,
          facebook_api_called: false,
          phone_access_called: false,
          sms_delivery_enabled: false,
          gmail_draft_created: false,
          slack_dispatch_enabled: false,
          n8n_dispatch_enabled: false,
          raw_message_body_stored: false,
          raw_contact_details_stored: false,
          screenshot_stored: false,
          provider_identifiers_stored: false,
          external_requests: [],
        },
      }],
    })

    expect(reloaded.channels.find((channel) => channel.channel === 'linkedin')).toMatchObject({
      state: 'ready_for_manual_copy',
      durableEvidence: null,
      evidenceLock: {
        locked: false,
      },
    })
  })
})
