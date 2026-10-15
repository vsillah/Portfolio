import { describe, expect, it } from 'vitest'
import contract from '../artifacts/human-qa/social-video-production-controls-2026-10-15-revision/jev-completeness-contract.json'
import audioReceipt from '../artifacts/human-qa/artifact-video-review-2026-10-14/jev-youtube-presenter-first/jev-youtube-moderate-music-audio-validation.receipt.json'
import { evaluateJevCompleteness, type JevCompletenessContract, type JevAudioGate } from './jev-social-video-completeness'

const validContract = () => {
  const value = structuredClone(contract) as JevCompletenessContract
  value.status = 'passed'
  value.story.cta_semantic_transcript_present = true
  return value
}
const validAudio = () => {
  const value = structuredClone(audioReceipt.mix_validation) as JevAudioGate
  value.cta_semantic_transcript_present = true
  value.cta_spoken_track_passed = true
  return value
}

describe('Jev social-video completeness', () => {
  it('accepts one teaching asset per frame and a spoken CTA window', () => {
    expect(evaluateJevCompleteness(validContract(), validAudio())).toEqual({ ready: true, blockers: [], observedMaxConcurrentTeachingAssets: 1 })
  })

  it('fails closed when teaching assets overlap', () => {
    const value = validContract()
    value.native_scene_bindings[1].timeline_start_seconds = value.native_scene_bindings[0].timeline_end_seconds - 0.04
    expect(evaluateJevCompleteness(value, validAudio()).blockers).toContain('At most one teaching asset may be visible in every frame.')
  })

  it('fails closed when the CTA window is silent', () => {
    const audio = validAudio()
    audio.cta_spoken_track_passed = false
    audio.cta_voice_integrated_lufs = -70
    expect(evaluateJevCompleteness(validContract(), audio).blockers).toContain('CTA transcript must contain the exact approved line: Subscribe to the channel for more practical ways to govern AI decisions.')
  })

  it('fails closed when audio is present but the CTA words are absent', () => {
    const audio = validAudio()
    audio.cta_semantic_transcript_present = false
    const value = validContract()
    value.accepted_exceptions = []
    expect(evaluateJevCompleteness(value, audio).blockers).toContain('CTA transcript must contain the exact approved line: Subscribe to the channel for more practical ways to govern AI decisions.')
  })

  it('accepts only the exact version-bound Jev visual-CTA exception', () => {
    expect(evaluateJevCompleteness(structuredClone(contract) as JevCompletenessContract, structuredClone(audioReceipt.mix_validation) as JevAudioGate)).toEqual({ ready: true, blockers: [], observedMaxConcurrentTeachingAssets: 1 })
    const value = structuredClone(contract) as JevCompletenessContract
    value.input_version = 'sha256:different'
    expect(evaluateJevCompleteness(value, structuredClone(audioReceipt.mix_validation) as JevAudioGate).ready).toBe(false)
  })
})
