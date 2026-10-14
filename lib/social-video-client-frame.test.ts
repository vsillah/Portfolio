import { describe, expect, it } from 'vitest'
import {
  SOCIAL_VIDEO_INTERNAL_FRAME_MARKERS,
  assertSocialVideoClientFacingText,
  buildSocialVideoClientFrameSvg,
} from './social-video-client-frame.mjs'

describe('social video customer-facing frame', () => {
  it('renders only approved public copy and AmaduTown branding', () => {
    const svg = buildSocialVideoClientFrameSvg({
      title: 'Jev: what the artifact makes visible',
      onScreenText: 'Who owns the decision after the score?',
      narration: 'A typed probability makes uncertainty visible, but a human still owns the exception.',
      progress: 1,
      total: 3,
    })

    expect(svg).toContain('AMADUTOWN ADVISORY SOLUTIONS')
    expect(svg).toContain('Who owns the decision after the')
    expect(svg).toContain('score?')
    for (const marker of SOCIAL_VIDEO_INTERNAL_FRAME_MARKERS) expect(svg).not.toMatch(marker)
  })

  it.each([
    'PROVIDER-FREE REVIEW CUT',
    'LOCAL RENDER',
    'SHOT 1 OF 3',
    'short-hook-shot-1',
    'MOTION / SHOT DIRECTION',
    'Input sha256:e6fc9ae4',
    'source:jev:approved-composite-20261014',
    'jev-operator-field-guide.png',
    'No media provider · no upload · no platform draft · no publish',
    'artifact_video_adaptation',
    'render_gate: explicit_approval_required',
  ])('fails closed before an internal marker can enter a customer frame: %s', (marker) => {
    expect(() => assertSocialVideoClientFacingText(['Approved title', marker])).toThrow(
      'Customer-facing video text contains an internal QA marker',
    )
  })
})
