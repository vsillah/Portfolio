import { describe, expect, it } from 'vitest'

import { evaluateWarmOutreachReadiness } from './warm-outreach-relationship-intelligence'
import { buildWarmOutreachSourceInventoryPacket } from './warm-outreach-source-inventory'

const baseRows = {
  contactSubmission: {
    id: 42,
    name: 'Amina Example',
    email: 'amina@example.com',
    company: 'Village Ops',
    industry: 'community operations',
    source: 'warm referral',
  },
  contactCommunications: [
    {
      id: 'comm-1',
      direction: 'outbound',
      channel: 'email',
      message_type: 'follow_up',
      subject: 'Agent operations conversation',
      status: 'sent',
      body: 'Private email body should not appear in public fields.',
      sent_at: '2026-06-01T12:00:00.000Z',
    },
    {
      id: 'comm-2',
      direction: 'inbound',
      channel: 'email',
      message_type: 'reply',
      subject: 'Re: Agent operations conversation',
      status: 'replied',
      body: 'Private inbound reply should not be quoted.',
      sent_at: '2026-06-02T12:00:00.000Z',
    },
  ],
  outreachQueue: [
    {
      id: 'queue-1',
      channel: 'linkedin',
      status: 'draft',
      subject: 'Warm reconnect',
    },
  ],
  emailMessages: [
    {
      id: 'email-1',
      direction: 'inbound',
      channel: 'email',
      email_kind: 'reply',
      subject: 'Budget timing',
      body: 'Sensitive timing detail.',
    },
  ],
  meetingSummaries: [
    {
      id: 'meeting-1',
      meeting_type: 'strategy',
      meeting_date: '2026-06-03',
      title: 'Agent workflow planning',
      summary: 'Discussed review burden and safe draft approval gates.',
      transcript: 'Raw transcript should not be copied.',
    },
  ],
  actionTasks: [
    {
      id: 'task-1',
      title: 'Send human-reviewed follow-up',
      status: 'open',
      description: 'Internal task detail.',
    },
  ],
}

describe('warm outreach source inventory builder', () => {
  it('builds source refs across local Portfolio outreach and meeting rows', () => {
    const packet = buildWarmOutreachSourceInventoryPacket({
      contactId: 42,
      objective: 'Reconnect about a draft-only Agentified pilot follow-up.',
      rows: baseRows,
      preferredChannel: 'email',
    })

    expect(packet.version).toBe('warm-outreach-relationship/v1')
    expect(packet.sourceRefs.map((ref) => ref.sourceType)).toEqual([
      'portfolio_contact',
      'prior_outreach',
      'imported_reply',
      'prior_outreach',
      'imported_reply',
      'meeting_record',
      'meeting_action_task',
    ])
    expect(packet.sourceInventory?.sourceStatus).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceType: 'contact_submissions', status: 'present' }),
        expect.objectContaining({ sourceType: 'outreach_queue/contact_communications', status: 'present' }),
        expect.objectContaining({ sourceType: 'email_messages/contact_communications', status: 'present' }),
      ]),
    )
    expect(packet.sourceInventory?.safeToMention).toEqual(
      expect.arrayContaining([
        'Their company context: Village Ops.',
        'Their industry context: community operations.',
      ]),
    )
  })

  it('keeps private source material summarized and out of public-facing guidance', () => {
    const packet = buildWarmOutreachSourceInventoryPacket({
      contactId: 42,
      objective: 'Prepare a safe reconnect note.',
      rows: baseRows,
    })

    expect(packet.sourceRefs.some((ref) => ref.privateSource)).toBe(true)
    expect(packet.sourceInventory?.summarizeOnly.join(' ')).toContain('Raw notes/transcripts remain private')
    expect(packet.sourceInventory?.doNotMention.join(' ')).toContain('Private body content')
    expect(JSON.stringify(packet.openingPitchGuidance)).not.toContain('Sensitive timing detail')
    expect(JSON.stringify(packet.openingPitchGuidance)).not.toContain('Private inbound reply should not be quoted')
    expect(packet.avoidContext).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Do not quote private email bodies'),
        expect.stringContaining('Do not imply provider authorization'),
      ]),
    )
  })

  it('blocks do-not-contact, removed, and suppression rows before draft work', () => {
    const packet = buildWarmOutreachSourceInventoryPacket({
      contactId: 42,
      objective: 'Reconnect about a draft-only follow-up.',
      rows: {
        ...baseRows,
        contactSubmission: {
          ...baseRows.contactSubmission,
          do_not_contact: true,
          removed_at: '2026-06-05T12:00:00.000Z',
          unsubscribed: true,
          suppression_reason: 'Contact asked not to be contacted.',
        },
      },
    })

    const readiness = evaluateWarmOutreachReadiness(packet)

    expect(readiness.status).toBe('blocked')
    expect(readiness.blockers).toEqual(
      expect.arrayContaining([
        'Contact asked not to be contacted.',
        'Contact is unsubscribed.',
        'Contact was removed from outreach.',
      ]),
    )
  })

  it('marks Facebook and phone contact as manual-only without provider capability', () => {
    const packet = buildWarmOutreachSourceInventoryPacket({
      contactId: 42,
      objective: 'Prepare channel-aware draft context.',
      preferredChannel: 'facebook',
      rows: {
        ...baseRows,
        contactSubmission: {
          ...baseRows.contactSubmission,
          facebook_url: 'https://facebook.example/amina',
          phone: '+15555550123',
        },
      },
    })

    expect(packet.preferredChannel).toBe('facebook')
    expect(packet.channelCapabilities.facebook).toMatchObject({
      available: true,
      providerConfigured: false,
      supportsExternalSend: false,
      manualOnly: true,
    })
    expect(packet.channelCapabilities.phone_contact).toMatchObject({
      available: true,
      providerConfigured: false,
      supportsExternalSend: false,
      manualOnly: true,
    })
  })

  it('keeps email and LinkedIn draft-only and records no-provider execution boundaries', () => {
    const packet = buildWarmOutreachSourceInventoryPacket({
      contactId: 42,
      objective: 'Prepare draft context without sending.',
      preferredChannel: 'linkedin',
      rows: {
        ...baseRows,
        contactSubmission: {
          ...baseRows.contactSubmission,
          linkedin_url: 'https://linkedin.example/in/amina',
        },
      },
    })

    expect(packet.preferredChannel).toBe('linkedin')
    expect(packet.channelCapabilities.email).toMatchObject({
      providerConfigured: false,
      supportsExternalSend: false,
      manualOnly: false,
    })
    expect(packet.channelCapabilities.linkedin).toMatchObject({
      providerConfigured: false,
      supportsExternalSend: false,
      manualOnly: false,
    })
    expect(packet.responseMonitoringPlan).toMatchObject({
      enabled: false,
      externalActivationRequired: true,
    })
    expect(packet.suggestedNextStep).toContain('human-reviewed email or LinkedIn draft')
  })

  it('reports missing local source categories without inventing evidence', () => {
    const packet = buildWarmOutreachSourceInventoryPacket({
      contactId: 42,
      objective: 'Assess whether there is enough warm context.',
      rows: {
        contactSubmission: {
          id: 42,
          name: 'Amina Example',
        },
      },
    })

    expect(packet.confidence).toBe('low')
    expect(packet.relationshipBasis).toContain('limited local relationship evidence')
    expect(packet.sourceInventory?.sourceStatus).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceType: 'meeting_records', status: 'missing' }),
        expect.objectContaining({ sourceType: 'meeting_action_tasks', status: 'missing' }),
      ]),
    )
  })
})
