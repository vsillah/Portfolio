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

  it.each([
    ['copy', 'hold', 'hold_copy'],
    ['copy', 'request_revision', 'request_copy_revision'],
    ['copy_review', 'hold', 'hold_copy_review'],
    ['submit', 'approve', 'approve_platform_submission'],
    ['submit', 'request_revision', 'request_platform_submission_revision'],
    ['submit', 'hold', 'hold_submit'],
    ['platform_submission', 'request_revision', 'request_platform_submission_revision'],
    ['asset_packet', 'approve', 'approve_asset_packet'],
    ['asset_packet', 'hold', 'hold_asset_packet'],
    ['privacy', 'request_revision', 'reject_privacy'],
    ['visual_review', 'request_revision', 'reject_visual_review'],
    ['visual_assets', 'hold', 'hold_visual_assets'],
  ])('binds %s %s to %s without turning hold or revision into approval', (gate, decision, command) => {
    expect(socialContentCanonicalCommand(gate, decision)).toBe(command)
  })

  it.each([
    ['Asset_Packet', 'approve'],
    ['privacy ', 'approve'],
    ['privacy', 'Approve'],
    ['privacy', 'reject'],
    ['privacy', 'hold '],
    ['', 'approve'],
    ['visuals', 'hold'],
  ])('does not invent a command for %s / %s', (gate, decision) => {
    expect(socialContentCanonicalCommand(gate, decision)).toBeNull()
  })

  it('encodes the content id and work item before opening the decision route', () => {
    expect(socialContentDecisionHref({
      contentId: 'content/1',
      workItemId: 'work item/1',
      gate: 'asset_packet',
    })).toBe('/admin/social-content/content%2F1?step=visuals&review=mobile&proposal=work+item%2F1#social-asset-packet-gate')
  })

  it('does not route a packet that is not an internal review or is missing its gate binding', () => {
    const packet = { content_id: 'content-1', work_item_id: 'work-1', current_gate: 'privacy' }
    expect(socialContentDecisionHrefFromApproval({
      approvalType: 'other',
      metadata: { review_packet: packet },
    })).toBeNull()
    expect(socialContentDecisionHrefFromApproval({
      approvalType: 'social_content_internal_review',
      metadata: null,
    })).toBeNull()
    expect(socialContentDecisionHrefFromApproval({
      approvalType: 'social_content_internal_review',
      metadata: [],
    })).toBeNull()
    expect(socialContentDecisionHrefFromApproval({
      approvalType: 'social_content_internal_review',
      metadata: { review_packet: { ...packet, content_id: ' ' } },
    })).toBeNull()
    expect(socialContentDecisionHrefFromApproval({
      approvalType: 'social_content_internal_review',
      metadata: { review_packet: { ...packet, current_gate: 'Asset_Packet' } },
    })).toBeNull()
    expect(socialContentDecisionHrefFromWorkItem({
      id: 'work-1',
      source_type: 'social_content_calendar_item',
      source_id: 'content-1',
      metadata: { current_gate: 'privacy' },
    })).toBeNull()
    expect(socialContentDecisionHrefFromWorkItem({
      id: 'work-1',
      source_type: 'social_content_internal_review',
      source_id: null,
      metadata: { current_gate: 'privacy' },
    })).toBeNull()
    expect(socialContentDecisionHrefFromWorkItem({
      id: 'work-1',
      source_type: 'social_content_internal_review',
      source_id: 'content-1',
      metadata: {
        review_packet: { current_gate: 'nope' },
        current_gate: 'privacy',
      },
    })).toBeNull()
  })

  it('uses the work-item gate only when the packet gate is blank', () => {
    expect(socialContentDecisionHrefFromWorkItem({
      id: 'work-1',
      source_type: 'social_content_internal_review',
      source_id: 'content/1',
      metadata: {
        review_packet: { current_gate: ' ' },
        current_gate: 'copy',
      },
    })).toBe('/admin/social-content/content%2F1?step=copy&review=mobile&proposal=work-1#social-copy-gate')
  })
})
