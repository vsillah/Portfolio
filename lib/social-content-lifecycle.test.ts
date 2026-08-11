import { describe, expect, it } from 'vitest'
import {
  deriveSocialContentLifecycleProjection,
  isDurableCopyApprovedStatus,
  lifecyclePrerequisiteFailure,
} from './social-content-lifecycle'

const completeRagContext = {
  source: 'agent_ops_social_outreach_goal',
  goal_id: 'goal-1',
  platform: 'linkedin',
  approval_boundary: 'human gated',
  pass_to_human: true,
  production_assets: {
    video_redaction_manifest: { status: 'ready' },
  },
  section_gate_reviews: {
    visual_assets: { status: 'approved' },
    asset_packet: { status: 'approved' },
    privacy: { status: 'approved' },
  },
  platform_submission_gate: {
    status: 'approved',
    platforms: ['linkedin'],
  },
}

describe('social content lifecycle projection', () => {
  it('projects a published legacy record with complete canonical evidence as sequentially approved', () => {
    const projection = deriveSocialContentLifecycleProjection({
      item: {
        status: 'published',
        target_platforms: ['linkedin'],
        image_url: 'https://cdn.example.com/image.png',
        published_at: '2026-08-01T10:00:00.000Z',
        rag_context: completeRagContext,
        publishes: [{ status: 'published', platform_post_url: 'https://linkedin.com/posts/1' }],
      },
    })

    expect(Object.values(projection.steps).map((step) => step.state)).toEqual([
      'approved',
      'approved',
      'approved',
      'approved',
      'approved',
      'approved',
    ])
    expect(projection.mismatches).toEqual([])
  })

  it('treats scheduled and published queue status as durable copy approval', () => {
    expect(isDurableCopyApprovedStatus('scheduled')).toBe(true)
    expect(isDurableCopyApprovedStatus('published')).toBe(true)
    expect(isDurableCopyApprovedStatus('draft')).toBe(false)
  })

  it('blocks downstream evidence when an upstream prerequisite is missing', () => {
    const projection = deriveSocialContentLifecycleProjection({
      item: {
        status: 'draft',
        image_url: 'https://cdn.example.com/image.png',
        rag_context: {
          platform_submission_gate: { status: 'approved' },
        },
        publishes: [{ status: 'published', platform_post_url: 'https://linkedin.com/posts/1' }],
      },
    })

    expect(projection.steps.copy.state).toBe('pending')
    expect(projection.steps.submit.state).toBe('blocked')
    expect(projection.steps.status.state).toBe('blocked')
    expect(projection.steps.submit.mismatch?.message).toContain('Context is not approved')
  })

  it('returns structured prerequisite failures for out-of-order actions', () => {
    const projection = deriveSocialContentLifecycleProjection({
      item: {
        status: 'approved',
        rag_context: null,
      },
    })

    expect(lifecyclePrerequisiteFailure(projection, 'draft')).toEqual(expect.objectContaining({
      error: 'Social Content lifecycle prerequisite blocked.',
      lifecycle_step: 'draft',
      missing_prerequisite: 'context',
      recovery_action: 'Approve or recover Context before continuing.',
    }))
  })
})
