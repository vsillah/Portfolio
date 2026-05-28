import { describe, expect, it } from 'vitest'
import { buildVideoRenderReadinessReport, VIDEO_RENDER_SCRIPT_MAX } from './video-render-readiness'

describe('video render readiness', () => {
  it('marks a pending draft with template config as ready', () => {
    const report = buildVideoRenderReadinessReport({
      title: 'The Receipt Every Agent Needs',
      status: 'pending',
      scriptText: 'A receipt is the difference between motion and trust.',
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
      scriptText: 'Ready for review.',
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
