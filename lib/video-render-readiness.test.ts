import { describe, expect, it } from 'vitest'
import { buildVideoRenderReadinessReport, VIDEO_RENDER_SCRIPT_MAX } from './video-render-readiness'

describe('video render readiness', () => {
  it('marks a pending draft with template config as ready', () => {
    const report = buildVideoRenderReadinessReport({
      title: 'The Receipt Every Agent Needs',
      status: 'pending',
      scriptText:
        'A receipt is the difference between motion and trust. The problem is that AI can produce polished work before anyone knows what decision it should improve. In the Portfolio workflow, AmaduTown keeps the proof visible through script scorecards, review gates, and render readiness checks. Join the workshop interest path when you want to build that loop in your own work.',
      scriptOutline: {
        pain_point: 'AI can produce polished work before the team knows what decision it should improve.',
        hook: 'The video can look ready while the script is still missing the point.',
        open_loop: 'By the end, the viewer should know why proof has to come before polish.',
        proof_demo: 'Portfolio and AmaduTown use script scorecards, review gates, and render readiness checks as the receipt.',
        cta: 'Join the workshop interest path when you want to build that loop in your own work.',
      },
      storyboardScenes: 5,
      videoGenerationJobId: null,
      templateId: 'template-1',
      avatarId: null,
      voiceId: null,
      channel: 'youtube',
      aspectRatio: '16:9',
      brollAssetIds: ['asset-1'],
    })

    expect(report.ready).toBe(true)
    expect(report.blockingIssues).toEqual([])
    expect(report.details.heygenMode).toBe('template')
  })

  it('blocks render when the script exceeds HeyGen limits', () => {
    const report = buildVideoRenderReadinessReport({
      title: 'Long draft',
      status: 'pending',
      scriptText: 'x'.repeat(VIDEO_RENDER_SCRIPT_MAX + 1),
      storyboardScenes: 1,
      videoGenerationJobId: null,
      templateId: 'template-1',
      avatarId: null,
      voiceId: null,
      channel: 'youtube',
      aspectRatio: '16:9',
      brollAssetIds: [],
    })

    expect(report.ready).toBe(false)
    expect(report.blockingIssues.join(' ')).toContain('Script exceeds HeyGen limit')
  })

  it('keeps approval separate from readiness', () => {
    const report = buildVideoRenderReadinessReport({
      title: 'Ready draft',
      status: 'pending',
      scriptText:
        'AI makes the first draft faster, but that speed creates a problem when nobody can explain the decision behind the artifact. The AmaduTown proof is the operating layer around the draft: script anatomy, source distance, storyboard review, and render readiness. Book an AI Quick Win discovery call if you want to turn one messy workflow into a reviewable loop.',
      scriptOutline: {
        pain_point: 'AI speed creates a problem when nobody can explain the decision behind the artifact.',
        hook: 'The first draft is faster now. The judgment still has to be designed.',
        open_loop: 'The viewer will see how readiness stays separate from approval.',
        proof_demo: 'The AmaduTown proof is the operating layer around the draft: script anatomy, source distance, storyboard review, and render readiness.',
        cta: 'Book an AI Quick Win discovery call if you want to turn one messy workflow into a reviewable loop.',
      },
      storyboardScenes: 0,
      videoGenerationJobId: null,
      templateId: null,
      avatarId: 'avatar-1',
      voiceId: 'voice-1',
      channel: 'linkedin',
      aspectRatio: '9:16',
      brollAssetIds: [],
    })

    expect(report.ready).toBe(true)
    expect(report.details.approvalBoundary).toContain('does not start a render')
    expect(report.warnings).toContain('No storyboard scenes are attached for visual direction.')
  })
})
