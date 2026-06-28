import { describe, expect, it } from 'vitest'
import {
  ACCELERATED_MODULE0_DRAFT_MARKER,
  buildAcceleratedModule0VideoDraft,
} from './accelerated-module0-video-draft'

describe('buildAcceleratedModule0VideoDraft', () => {
  it('builds a provider-locked Video Generation draft from the Module 0 packet', () => {
    const draft = buildAcceleratedModule0VideoDraft()

    expect(draft.title).toBe('Accelerated Module 0: Why Accelerated Exists')
    expect(draft.source).toBe('manual')
    expect(draft.status).toBe('pending')
    expect(draft.custom_prompt).toBe(ACCELERATED_MODULE0_DRAFT_MARKER)
    expect(draft.script_text).toContain('AI can now make the first version look finished')
    expect(draft.script_outline).toMatchObject({
      pain_point: expect.stringContaining('polished artifacts'),
      cta: expect.stringContaining('Accelerated Workshop interest path'),
    })
    expect(draft.script_scorecard.blockers).toEqual([])
    expect(draft.script_scorecard.cta_clarity).toBeGreaterThanOrEqual(80)
    expect(draft.storyboard_json.safety.external_side_effects).toMatchObject({
      heygen: false,
      elevenlabs: false,
      render: false,
      upload: false,
      publish: false,
      apify: false,
    })
  })
})
