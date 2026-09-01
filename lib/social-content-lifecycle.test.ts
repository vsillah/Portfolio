import { describe, expect, it } from 'vitest'
import {
  deriveSocialContentLifecycleProjection,
  hasActualPublishedEvidence,
  hasSocialContentVisualPrerequisites,
  hasSubmissionOrPublishEvidence,
  isDurableCopyApprovedStatus,
  lifecyclePrerequisiteFailure,
  socialContentFinalCopyQualityFailure,
  validateSocialContentFinalCopyQuality,
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

const completeTextOnlyXRagContext = {
  source_packet_path: 'docs/content-strategy/x-source-packet.md',
  platform: 'x',
  approval_boundary: 'human gated',
  x_batch_approval: {
    status: 'approved',
    approved_scope: ['copy', 'source_distance_review', 'privacy_review'],
  },
  privacy_review: { status: 'approved' },
  source_distance_review: { status: 'approved' },
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

  it('keeps scheduled evidence valid for draft and submit without approving final status', () => {
    const scheduledItem = {
      status: 'scheduled' as const,
      target_platforms: ['linkedin' as const],
      image_url: 'https://cdn.example.com/image.png',
      rag_context: completeRagContext,
      publishes: [{ status: 'pending' as const }],
    }
    const projection = deriveSocialContentLifecycleProjection({ item: scheduledItem })

    expect(hasSubmissionOrPublishEvidence(scheduledItem)).toBe(true)
    expect(hasActualPublishedEvidence(scheduledItem)).toBe(false)
    expect(projection.steps.copy.state).toBe('approved')
    expect(projection.steps.draft.state).toBe('approved')
    expect(projection.steps.submit.state).toBe('approved')
    expect(projection.steps.status.state).toBe('pending')
  })

  it('approves Visuals for text-only X when the complete explicit review evidence exists', () => {
    const projection = deriveSocialContentLifecycleProjection({
      item: {
        status: 'approved',
        target_platforms: ['x'],
        rag_context: completeTextOnlyXRagContext,
      },
    })

    expect(projection.steps.visuals.state).toBe('approved')
    expect(projection.steps.visuals.rawState).toBe('approved')
  })

  it.each([
    ['approved batch status', { x_batch_approval: { status: 'pending' } }],
    ['copy approval scope', { x_batch_approval: { approved_scope: ['source_distance_review', 'privacy_review'] } }],
    ['source-distance approval scope', { x_batch_approval: { approved_scope: ['copy', 'privacy_review'] } }],
    ['privacy approval scope', { x_batch_approval: { approved_scope: ['copy', 'source_distance_review'] } }],
    ['approved privacy review', { privacy_review: { status: 'pending' } }],
    ['approved source-distance review', { source_distance_review: { status: 'pending' } }],
  ])('keeps text-only X Visuals pending without %s', (_condition, override) => {
    const ragContext = {
      ...completeTextOnlyXRagContext,
      ...override,
      x_batch_approval: {
        ...completeTextOnlyXRagContext.x_batch_approval,
        ...('x_batch_approval' in override ? override.x_batch_approval : {}),
      },
    }

    expect(hasSocialContentVisualPrerequisites({
      target_platforms: ['x'],
      rag_context: ragContext,
    })).toBe(false)
  })

  it('keeps text-only mixed-platform Visuals pending despite complete X evidence', () => {
    expect(hasSocialContentVisualPrerequisites({
      target_platforms: ['x', 'linkedin'],
      rag_context: completeTextOnlyXRagContext,
    })).toBe(false)
  })

  it('preserves existing Visuals approval behavior for other platforms', () => {
    expect(hasSocialContentVisualPrerequisites({
      target_platforms: ['linkedin'],
      rag_context: completeRagContext,
    })).toBe(true)
  })

  it('preserves sequential mismatch blocking for approved text-only X evidence', () => {
    const projection = deriveSocialContentLifecycleProjection({
      item: {
        status: 'draft',
        target_platforms: ['x'],
        rag_context: completeTextOnlyXRagContext,
      },
    })

    expect(projection.steps.visuals.rawState).toBe('approved')
    expect(projection.steps.visuals.state).toBe('blocked')
    expect(projection.steps.visuals.mismatch?.missingStep).toBe('copy')
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

  it('blocks final copy when prompt and agent instruction leakage appears in public fields', () => {
    const qualityGate = validateSocialContentFinalCopyQuality({
      status: 'draft',
      post_text: [
        'System prompt: You are Codex working inside Portfolio.',
        'Rewrite as Vambah and do not include this Captain QA block in the final answer.',
        '- [ ] Check the operator approval surface.',
      ].join('\n'),
      cta_text: 'Join the build.',
      rag_context: completeRagContext,
    })

    expect(qualityGate.status).toBe('blocked')
    expect(qualityGate.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      'role_prompt_fragment',
      'rewrite_instruction',
      'forbidden_content_instruction',
      'checkbox_scaffold',
    ]))
    expect(socialContentFinalCopyQualityFailure(qualityGate)).toEqual(expect.objectContaining({
      error: 'Final copy quality gate blocked prompt leakage before human approval.',
      current_gate: 'final_copy_quality',
      revision_state: 'revision_needed',
    }))
  })

  it('projects leaked copy as blocked before downstream human approval readiness', () => {
    const projection = deriveSocialContentLifecycleProjection({
      item: {
        status: 'draft',
        post_text: 'Captain QA block: do not include internal instructions in final copy.',
        target_platforms: ['linkedin'],
        rag_context: completeRagContext,
      },
      rawStates: {
        copy: 'in_review',
      },
    })

    expect(projection.steps.context.state).toBe('approved')
    expect(projection.steps.copy.state).toBe('blocked')
    expect(projection.firstIncompleteStep).toBe('copy')
  })

  it('passes clean final copy that talks about approval gates without internal prompt scaffolding', () => {
    const qualityGate = validateSocialContentFinalCopyQuality({
      post_text: 'Approval gates matter because public work needs a receipt. The operator should see the source, the claim, and the decision before anything leaves the system.',
      cta_text: 'Build the receipt before the workflow scales.',
      youtube_description: 'A practical walkthrough of content review gates and safer automation.',
      rag_context: {
        approval_boundary: 'Internal metadata should not be scanned as final copy.',
        blocked_actions: ['Do not publish from this test.'],
      },
    })

    expect(qualityGate.status).toBe('passed')
    expect(qualityGate.findings).toEqual([])
  })
})
