import { describe, expect, it } from 'vitest'
import {
  filterSocialCommentInboxItems,
  getSocialCommentInboxItem,
  getSocialCommentInboxItems,
  summarizeSocialCommentInbox,
  type SocialCommentCanonicalRow,
  type SocialCommentInboxItem,
  type SocialCommentPostProjection,
} from './social-comment-inbox-ui'

function row(overrides: SocialCommentCanonicalRow = {}): SocialCommentCanonicalRow {
  return {
    id: 'comment-1',
    content_id: 'content-1',
    platform: 'linkedin',
    provider: 'linkedin_organization',
    provider_comment_id: 'provider-1',
    author_display_name: 'Operator One',
    body: 'Can this help intake?',
    comment_url: 'https://linkedin.example/comment/1',
    classification_status: 'unreviewed',
    classification_reason: null,
    priority: 'normal',
    response_approval_state: 'not_required',
    reply_submission_state: 'not_applicable',
    proposed_reply_text: null,
    approved_reply_text: null,
    captured_at: '2026-08-06T12:00:00.000Z',
    updated_at: '2026-08-06T12:00:00.000Z',
    metadata: {},
    ...overrides,
  }
}

function item(overrides: Partial<SocialCommentInboxItem> = {}): SocialCommentInboxItem {
  return {
    id: 'comment-1',
    socialContentId: 'content-1',
    platform: 'linkedin',
    providerCommentId: 'provider-1',
    providerPermalink: 'https://linkedin.example/comment/1',
    authorDisplayName: 'Operator One',
    body: 'Can this help intake?',
    status: 'new',
    classification: { label: 'unreviewed', priority: 'medium', reason: null },
    draftReply: '',
    approvalState: 'not_started',
    providerCapability: {
      provider: 'linkedin_organization',
      automaticReply: false,
      verified: false,
      humanGateSatisfied: false,
      blocker: 'Human approval is required before any reply can be submitted.',
      recoveryPath: 'Use the provider permalink to handle this comment manually, then return here to record the local decision.',
    },
    actionHistory: [],
    createdAt: '2026-08-06T12:00:00.000Z',
    updatedAt: '2026-08-06T12:00:00.000Z',
    campaignId: 'campaign-1',
    campaignLabel: 'Launch campaign',
    postLabel: 'Comment inbox launch',
    postExcerpt: 'Original post copy',
    ...overrides,
  }
}

describe('getSocialCommentInboxItem', () => {
  it('falls back to safe defaults for unknown enums, blank authors, and unsupported platforms', () => {
    const projected = getSocialCommentInboxItem({
      id: '',
      content_id: 'content-1',
      platform: 'threads',
      provider_comment_id: 'provider-1',
      author_display_name: '  ',
      author_public_handle: null,
      body: 12,
      classification_status: 'mystery',
      priority: 'critical',
      response_approval_state: 'maybe',
      reply_submission_state: 'queued',
    })

    expect(projected).toMatchObject({
      id: 'provider-1',
      platform: 'linkedin',
      authorDisplayName: 'Unknown commenter',
      body: 'No comment text imported.',
      status: 'new',
      classification: { label: 'unreviewed', priority: 'medium' },
      approvalState: 'not_started',
      providerCapability: expect.objectContaining({
        automaticReply: false,
        verified: false,
        humanGateSatisfied: false,
      }),
    })
    expect(projected.providerCapability.blocker).toContain('Human approval is required')
  })

  it('maps ignored and spam classification into ignored UI status', () => {
    expect(getSocialCommentInboxItem(row({ classification_status: 'ignored' })).status).toBe('ignored')
    expect(getSocialCommentInboxItem(row({ classification_status: 'spam' })).status).toBe('ignored')
  })

  it('maps submitted replies and answered comments into responded', () => {
    expect(getSocialCommentInboxItem(row({ reply_submission_state: 'submitted' })).status).toBe('responded')
    expect(getSocialCommentInboxItem(row({ classification_status: 'answered' })).status).toBe('responded')
  })

  it('escalates blocked, urgent, provider-ambiguity, and privacy/legal QA holds', () => {
    expect(getSocialCommentInboxItem(row({ classification_status: 'blocked' })).status).toBe('escalated')
    expect(getSocialCommentInboxItem(row({ response_approval_state: 'blocked' })).status).toBe('escalated')
    expect(getSocialCommentInboxItem(row({ priority: 'urgent' })).status).toBe('escalated')
    expect(getSocialCommentInboxItem(row({
      metadata: { policy_decision: { classification: 'provider_manual_ambiguity' } },
    })).status).toBe('escalated')
    expect(getSocialCommentInboxItem(row({
      metadata: { policy_decision: { human_qa_reasons: ['contains privacy data'] } },
    })).status).toBe('escalated')
    expect(getSocialCommentInboxItem(row({
      metadata: { policy_decision: { human_qa_reasons: ['possible legal advice'] } },
    })).status).toBe('escalated')
  })

  it('promotes buying and partnership intent to lead unless an escalate rule already matched', () => {
    expect(getSocialCommentInboxItem(row({
      metadata: { policy_decision: { classification: 'buying_lead_intent' } },
    })).status).toBe('lead')
    expect(getSocialCommentInboxItem(row({
      metadata: { policy_decision: { classification: 'partnership_intent' } },
    })).status).toBe('lead')
    expect(getSocialCommentInboxItem(row({
      priority: 'urgent',
      metadata: { policy_decision: { classification: 'buying_lead_intent' } },
    })).status).toBe('escalated')
  })

  it('marks approved reply submission as auto-send pending', () => {
    expect(getSocialCommentInboxItem(row({ reply_submission_state: 'approved' })).status).toBe('auto_send_pending')
  })

  it('routes draft, failed, pending, and rejected replies into needs_qa', () => {
    expect(getSocialCommentInboxItem(row({ classification_status: 'needs_response' })).status).toBe('needs_qa')
    expect(getSocialCommentInboxItem(row({ reply_submission_state: 'draft' })).status).toBe('needs_qa')
    expect(getSocialCommentInboxItem(row({ reply_submission_state: 'failed' })).status).toBe('needs_qa')
    expect(getSocialCommentInboxItem(row({ reply_submission_state: 'blocked' })).status).toBe('needs_qa')
    expect(getSocialCommentInboxItem(row({ response_approval_state: 'pending' })).status).toBe('needs_qa')
    expect(getSocialCommentInboxItem(row({ response_approval_state: 'rejected' })).status).toBe('needs_qa')
  })

  it('maps provider priority and approval state onto the UI projection', () => {
    expect(getSocialCommentInboxItem(row({ priority: 'high' })).classification.priority).toBe('high')
    expect(getSocialCommentInboxItem(row({ priority: 'urgent' })).classification.priority).toBe('high')
    expect(getSocialCommentInboxItem(row({ priority: 'low' })).classification.priority).toBe('low')
    expect(getSocialCommentInboxItem(row({ response_approval_state: 'approved' })).approvalState).toBe('approved')
    expect(getSocialCommentInboxItem(row({ response_approval_state: 'rejected' })).approvalState).toBe('rejected')
    expect(getSocialCommentInboxItem(row({ reply_submission_state: 'draft' })).approvalState).toBe('drafted')
  })

  it('prefers policy classification labels and proposed reply text', () => {
    const projected = getSocialCommentInboxItem(row({
      proposed_reply_text: ' Draft reply. ',
      approved_reply_text: 'Approved reply',
      metadata: { policy_decision: { classification: 'buying_lead_intent' } },
    }))

    expect(projected.classification.label).toBe('buying lead intent')
    expect(projected.draftReply).toBe('Draft reply.')
  })

  it('only enables automatic reply when the provider is verified and the human gate is satisfied', () => {
    const blocked = getSocialCommentInboxItem(row({
      response_approval_state: 'approved',
      provider_capability: {
        capability_status: 'manual',
        supports_reply_submission: false,
        external_submission_enabled: false,
        gate_notes: 'Handle this comment on LinkedIn.',
      },
    }))
    expect(blocked.providerCapability).toMatchObject({
      automaticReply: false,
      verified: false,
      humanGateSatisfied: true,
      recoveryPath: 'Handle this comment on LinkedIn.',
    })
    expect(blocked.providerCapability.blocker).toContain('Reply submission is not enabled')

    const automatic = getSocialCommentInboxItem(row({
      platform: 'youtube',
      provider: 'youtube_data',
      response_approval_state: 'approved',
      provider_capability: {
        capability_status: 'verified',
        supports_reply_submission: true,
        external_submission_enabled: true,
        gate_notes: 'YouTube replies can be submitted after approval.',
      },
    }))
    expect(automatic.providerCapability).toMatchObject({
      provider: 'youtube_data',
      automaticReply: true,
      verified: true,
      humanGateSatisfied: true,
      blocker: null,
    })
  })

  it('reads UI action history and falls back to generic action history', () => {
    expect(getSocialCommentInboxItem(row({
      metadata: {
        ui_action_history: [{ action: 'approve', at: '2026-08-06T13:00:00.000Z', by: 'admin-1', note: 'ok' }],
        action_history: [{ action: 'ignore' }],
      },
    })).actionHistory).toEqual([{
      action: 'approve',
      at: '2026-08-06T13:00:00.000Z',
      by: 'admin-1',
      note: 'ok',
    }])

    expect(getSocialCommentInboxItem(row({
      metadata: { action_history: [{ action: ' ', by: '  ' }] },
    })).actionHistory).toEqual([{
      action: 'refresh_request',
      at: '1970-01-01T00:00:00.000Z',
      by: null,
      note: null,
    }])
  })

  it('projects campaign and post labels from the related social content row', () => {
    const post: SocialCommentPostProjection = {
      id: 'content-1',
      platform: 'youtube',
      post_text: 'A longer post excerpt that should be truncated if it exceeds two hundred and twenty characters. '.repeat(4),
      youtube_title: 'Video title',
      rag_context: {
        campaign_id: 'campaign-9',
        campaign_name: 'Q3 launch',
        planned_angle: 'Inbox launch angle',
      },
    }

    const projected = getSocialCommentInboxItem(row({ platform: 'youtube' }), post)
    expect(projected).toMatchObject({
      platform: 'youtube',
      campaignId: 'campaign-9',
      campaignLabel: 'Q3 launch',
      postLabel: 'Inbox launch angle',
    })
    expect(projected.postExcerpt).toHaveLength(220)
  })
})

describe('getSocialCommentInboxItems', () => {
  it('joins rows to post projections by content id', () => {
    const items = getSocialCommentInboxItems(
      [row({ id: 'c1', content_id: 'content-1' }), row({ id: 'c2', content_id: 'content-2' })],
      new Map([
        ['content-2', {
          id: 'content-2',
          rag_context: { campaign_label: 'Second campaign', planned_angle: 'Second post' },
        }],
      ]),
    )

    expect(items.map((entry) => entry.campaignLabel)).toEqual([null, 'Second campaign'])
    expect(items[1].postLabel).toBe('Second post')
  })
})

describe('summarizeSocialCommentInbox', () => {
  it('counts every UI status including empty lists', () => {
    expect(summarizeSocialCommentInbox([])).toEqual({
      total: 0,
      new: 0,
      needs_qa: 0,
      auto_send_pending: 0,
      lead: 0,
      escalated: 0,
      responded: 0,
      ignored: 0,
    })

    expect(summarizeSocialCommentInbox([
      item({ status: 'lead' }),
      item({ id: '2', status: 'ignored' }),
      item({ id: '3', status: 'lead' }),
      item({ id: '4', status: 'escalated' }),
    ])).toMatchObject({
      total: 4,
      lead: 2,
      ignored: 1,
      escalated: 1,
      new: 0,
    })
  })
})

describe('filterSocialCommentInboxItems', () => {
  const items = [
    item({ id: 'lead-1', status: 'lead', platform: 'linkedin', campaignLabel: 'Launch campaign' }),
    item({
      id: 'ignored-1',
      status: 'ignored',
      platform: 'youtube',
      campaignId: 'campaign-yt',
      campaignLabel: 'YouTube series',
      postLabel: 'Watch next',
      postExcerpt: 'A video excerpt',
    }),
  ]

  it('does not restrict status, platform, campaign, or post when filter is all or omitted', () => {
    expect(filterSocialCommentInboxItems(items, {})).toHaveLength(2)
    expect(filterSocialCommentInboxItems(items, {
      status: 'all',
      platform: 'all',
      campaign: 'all',
      post: 'all',
    }).map((entry) => entry.id)).toEqual(['lead-1', 'ignored-1'])
  })

  it('applies each dimension independently without hiding unmatched all-filter rows', () => {
    expect(filterSocialCommentInboxItems(items, { status: 'ignored' }).map((entry) => entry.id)).toEqual(['ignored-1'])
    expect(filterSocialCommentInboxItems(items, { platform: 'linkedin' }).map((entry) => entry.id)).toEqual(['lead-1'])
    expect(filterSocialCommentInboxItems(items, { campaign: 'youtube' }).map((entry) => entry.id)).toEqual(['ignored-1'])
    expect(filterSocialCommentInboxItems(items, { post: 'watch' }).map((entry) => entry.id)).toEqual(['ignored-1'])
    expect(filterSocialCommentInboxItems(items, { status: 'lead', platform: 'youtube' })).toEqual([])
  })
})
