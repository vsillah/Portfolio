import { describe, expect, it } from 'vitest'
import {
  AGENTIC_SOCIAL_LAUNCH_DRAFTS,
  AGENTIC_SOCIAL_LAUNCH_PACKET_PATH,
  buildAgenticSocialLaunchDraftRow,
  getAgenticSocialLaunchDraftByAssetId,
} from './agentic-social-launch-drafts'

describe('agentic social launch drafts', () => {
  it('keeps the challenger-cleared Monday launch set in order', () => {
    expect(AGENTIC_SOCIAL_LAUNCH_DRAFTS.map((draft) => draft.assetId)).toEqual([
      'p0-linkedin-flagship-agentic-operating-system',
      'p0-carousel-seven-things-after-agent-demo',
      'p1-linkedin-scope-safety-model',
      'p1-linkedin-agent-qa-scorecards',
      'p2-client-one-pager-governed-agentic-operations',
    ])
    expect(AGENTIC_SOCIAL_LAUNCH_DRAFTS.map((draft) => draft.launchDate)).toEqual([
      '2026-06-08',
      '2026-06-09',
      '2026-06-10',
      '2026-06-11',
      '2026-06-12',
    ])
  })

  it('builds draft-only social content rows with source and challenger trace', () => {
    const draft = getAgenticSocialLaunchDraftByAssetId('p0-linkedin-flagship-agentic-operating-system')

    expect(draft).not.toBeNull()
    const row = buildAgenticSocialLaunchDraftRow(draft!, 'admin-user-1')

    expect(row.platform).toBe('linkedin')
    expect(row.status).toBe('draft')
    expect(row.post_text).toContain('Anyone can launch an agent now.')
    expect(row.rag_context).toMatchObject({
      source: 'agentic_sales_outreach_launch_draft',
      launch_draft_asset_id: 'p0-linkedin-flagship-agentic-operating-system',
      launch_packet_path: AGENTIC_SOCIAL_LAUNCH_PACKET_PATH,
      challenger_agent: 'Amina',
      challenger_status: 'passed',
      approval_status: 'human_review_ready',
      pass_to_human: true,
      seeded_by_user_id: 'admin-user-1',
      approval_required_for: ['schedule', 'publish', 'outbound_send', 'visual_build', 'provider_execution'],
    })
    expect(row.admin_notes).toContain('Draft only.')
    expect(row.admin_notes).toContain('Residual human decision:')
  })

  it('keeps carousel seed data renderable without provider execution', () => {
    const draft = getAgenticSocialLaunchDraftByAssetId('p0-carousel-seven-things-after-agent-demo')

    expect(draft).not.toBeNull()
    const row = buildAgenticSocialLaunchDraftRow(draft!, 'admin-user-1')

    expect(row.content_format).toBe('carousel')
    expect(row.carousel_slides).toHaveLength(9)
    expect(row.video_generation_method).toBe('none')
    expect(row.rag_context).toMatchObject({
      launch_draft_asset_id: 'p0-carousel-seven-things-after-agent-demo',
      approval_required_for: expect.arrayContaining(['visual_build', 'publish']),
    })
  })
})
