import { describe, expect, it } from 'vitest'

import {
  buildWarmOutreachContextSummary,
  evaluateWarmOutreachReadiness,
  recommendWarmOutreachTemplate,
  type WarmOutreachRelationshipPacket,
} from './warm-outreach-relationship-intelligence'

const basePacket: WarmOutreachRelationshipPacket = {
  version: 'warm-outreach-relationship/v1',
  contactId: 42,
  contactName: 'Amina Example',
  objective: 'Reconnect about the Agentified pilot.',
  relationshipBasis: 'Met through a prior AmaduTown strategy conversation.',
  sourceRefs: [
    {
      sourceType: 'portfolio_contact',
      sourceId: '42',
      summary: 'Existing Portfolio contact with prior outreach history.',
      privateSource: false,
    },
  ],
  relationshipSignals: ['prior conversation'],
  commonalities: ['agent operations'],
  riskFlags: [],
  confidence: 'high',
  suppression: {
    doNotContact: false,
    unsubscribed: false,
  },
  channelCapabilities: {
    email: {
      available: true,
      providerConfigured: true,
      supportsExternalSend: true,
    },
  },
  preferredChannel: 'email',
}

describe('warm outreach relationship intelligence', () => {
  it('marks a high-confidence unsuppressed relationship as draft-ready', () => {
    const result = evaluateWarmOutreachReadiness(basePacket)

    expect(result).toMatchObject({
      status: 'draft_ready',
      humanReviewRequired: true,
      selectedChannel: 'email',
      recommendedTemplate: 'product_relevance',
      blockers: [],
      warnings: [],
      approvalBoundary: 'draft_only_no_external_send',
    })
  })

  it('blocks suppressed contacts before draft or send work can proceed', () => {
    const result = evaluateWarmOutreachReadiness({
      ...basePacket,
      suppression: {
        doNotContact: true,
        unsubscribed: false,
        suppressionReason: 'User marked the contact as do not contact.',
      },
    })

    expect(result.status).toBe('blocked')
    expect(result.blockers).toContain('User marked the contact as do not contact.')
  })

  it('keeps manual channels review-bound when provider send is not verified', () => {
    const result = evaluateWarmOutreachReadiness({
      ...basePacket,
      confidence: 'medium',
      preferredChannel: 'facebook',
      channelCapabilities: {
        facebook: {
          available: true,
          providerConfigured: false,
          supportsExternalSend: false,
          manualOnly: true,
          reason: 'Facebook DM is manual until provider capability is verified.',
        },
      },
    })

    expect(result.status).toBe('needs_review')
    expect(result.selectedChannel).toBe('facebook')
    expect(result.warnings).toContain('Facebook DM is manual until provider capability is verified.')
    expect(result.humanReviewRequired).toBe(true)
  })

  it('recommends follow-up when meeting evidence is present', () => {
    const template = recommendWarmOutreachTemplate({
      ...basePacket,
      sourceRefs: [
        ...basePacket.sourceRefs,
        {
          sourceType: 'meeting_record',
          sourceId: 'meeting-1',
          summary: 'Meeting discussed review burden before scaling agents.',
          privateSource: true,
        },
      ],
    })

    expect(template).toBe('follow_up')
  })

  it('recommends referral path when the relationship basis is an introduction', () => {
    const template = recommendWarmOutreachTemplate({
      ...basePacket,
      relationshipBasis: 'Introduced by a mutual AmaduTown client.',
      relationshipSignals: ['trusted referral path'],
    })

    expect(template).toBe('referral_path')
  })

  it('builds a safe context summary without clearing human review', () => {
    const summary = buildWarmOutreachContextSummary({
      ...basePacket,
      sourceRefs: [
        {
          sourceType: 'phone_contact',
          sourceId: 'ios-contact-1',
          summary: 'Saved phone contact with prior community relationship.',
          privateSource: true,
        },
      ],
    })

    expect(summary).toMatchObject({
      version: 'warm-outreach-relationship/v1',
      contact_id: '42',
      selected_channel: 'email',
      human_review_required: true,
      approval_boundary: 'draft_only_no_external_send',
    })
    expect(summary.source_summaries[0]).toMatchObject({
      source_type: 'phone_contact',
      private_source: true,
    })
    expect(summary.warnings).toContain('Private source context must be summarized, not quoted.')
  })
})
