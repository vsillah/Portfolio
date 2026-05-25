import { describe, expect, it } from 'vitest'
import {
  buildContentPackage,
  CONTENT_PACKAGE_APPROVAL_TYPES,
  normalizeContentPackageOutputs,
} from './content-packages'

describe('content package builder', () => {
  it('normalizes requested outputs and falls back to defaults', () => {
    expect(normalizeContentPackageOutputs(['linkedin_post', 'bogus', 'pptx_deck'])).toEqual([
      'linkedin_post',
      'pptx_deck',
    ])
    expect(normalizeContentPackageOutputs([])).toContain('linkedin_post')
  })

  it('builds a multi-format package from a voice-note transcript', () => {
    const pkg = buildContentPackage({
      title: 'Voice notes should become content systems',
      transcriptText:
        'I keep having ideas while I am moving between workstreams. The problem is that the insight stays trapped in a voice note instead of becoming a LinkedIn post, a PowerPoint, a script, and a governed approval packet.',
      topicHint: 'Voice note content workflow',
      targetOutputs: ['linkedin_post', 'pptx_deck', 'video_script', 'heygen_video', 'elevenlabs_audio'],
      frameworkIds: ['alex-hormozi-value-equation', 'nick-saraev-ai-content-engine'],
      chronicleNotes: ['Recent Portfolio work showed Agent Ops and video generation as useful proof surfaces.'],
    })

    expect(pkg.title).toBe('Voice notes should become content systems')
    expect(pkg.frameworkIds).toEqual([
      'alex-hormozi-value-equation',
      'nick-saraev-ai-content-engine',
    ])
    expect(pkg.outputs.map((output) => output.outputType)).toEqual(expect.arrayContaining([
      'linkedin_post',
      'pptx_deck',
      'video_script',
      'heygen_video',
      'elevenlabs_audio',
    ]))
    expect(pkg.researchPacket.chronicle).toMatchObject({ status: 'sanitized_notes_attached' })
    expect(pkg.presentationPlan).toMatchObject({ recommendedTool: 'codex_pptx' })
  })

  it('keeps media and publishing actions behind explicit approval types', () => {
    expect(CONTENT_PACKAGE_APPROVAL_TYPES).toEqual({
      script: 'content_package_script_packet',
      media: 'content_package_media_generation',
      publish: 'content_package_publish',
    })
  })
})
