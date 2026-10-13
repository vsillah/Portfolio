import { describe, expect, it } from 'vitest'
import {
  isBoundSocialContentDecisionRoute,
  socialContentCanonicalCommand,
  socialContentDecisionHref,
  socialContentDecisionHrefFromApproval,
  socialContentDecisionHrefFromWorkItem,
} from './social-content-decision-routing'

describe('Social Content canonical decision routing', () => {
  it.each([
    ['copy_review', 'approve', 'approve_copy'],
    ['visual_review', 'approve', 'approve_visual_review'],
    ['visual_assets', 'approve', 'approve_visual_assets'],
    ['asset_packet', 'request_revision', 'reject_asset_packet'],
    ['privacy', 'approve', 'approve_privacy'],
    ['platform_submission', 'approve', 'approve_platform_submission'],
  ])('binds %s %s to %s', (gate, decision, command) => {
    expect(socialContentCanonicalCommand(gate, decision)).toBe(command)
  })

  it('builds the filtered mobile entry for the exact work item and gate', () => {
    expect(socialContentDecisionHref({
      contentId: 'content-1',
      workItemId: 'work-1',
      gate: 'privacy',
    })).toBe('/admin/social-content/content-1?step=visuals&review=mobile&proposal=work-1#social-asset-packet-gate')
  })

  it('routes the established visual_review packet to the canonical visual gate', () => {
    expect(socialContentDecisionHref({
      contentId: 'content-1',
      workItemId: 'work-1',
      gate: 'visual_review',
    })).toBe('/admin/social-content/content-1?step=visuals&review=mobile&proposal=work-1#social-visual-assets-gate')
  })

  it('projects the same canonical entry from Agent Run and Decision Queue records', () => {
    const packet = {
      content_id: 'content-1',
      work_item_id: 'work-1',
      current_gate: 'platform_submission',
    }
    const expected = '/admin/social-content/content-1?step=submit&review=mobile&proposal=work-1#social-platform-submission-gate'
    expect(socialContentDecisionHrefFromApproval({
      approvalType: 'social_content_internal_review',
      metadata: { review_packet: packet },
    })).toBe(expected)
    expect(socialContentDecisionHrefFromWorkItem({
      id: 'work-1',
      source_type: 'social_content_internal_review',
      source_id: 'content-1',
      metadata: { review_packet: packet },
    })).toBe(expected)
  })

  it('requires the filtered proposal binding before showing the action panel', () => {
    expect(isBoundSocialContentDecisionRoute({ review: 'mobile', proposal: 'work-1', workItemId: 'work-1' })).toBe(true)
    expect(isBoundSocialContentDecisionRoute({ review: 'mobile', proposal: null, workItemId: 'work-1' })).toBe(false)
    expect(isBoundSocialContentDecisionRoute({ review: 'mobile', proposal: 'other', workItemId: 'work-1' })).toBe(false)
    expect(isBoundSocialContentDecisionRoute({ review: null, proposal: 'work-1', workItemId: 'work-1' })).toBe(false)
  })
})
