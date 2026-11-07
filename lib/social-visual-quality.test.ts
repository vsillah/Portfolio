import { describe, expect, it } from 'vitest'
import {
  SOCIAL_VISUAL_QUALITY_STANDARD_VERSION,
  evaluateSocialVisualQualityCandidate,
  type SocialVisualQualityCandidate,
} from './social-content-intelligence'

const PRODUCT_EVIDENCE_BLOCKER = 'Product-centered visuals require at least one privacy-safe screenshot, gameplay capture, or inspectable product image; a logo or icon is not sufficient.'
const SOURCE_BINDING_BLOCKER = 'Every customer-facing section requires a field-level source binding and claim boundary.'
const COMPOSITION_REUSE_BLOCKER = 'A recently approved dominant composition cannot be reused without a content-specific rationale.'

const passed = {
  standard_version: SOCIAL_VISUAL_QUALITY_STANDARD_VERSION,
  status: 'passed' as const,
  pass_to_human: true,
  blockers: [] as string[],
}

function passingCandidate(
  overrides: Partial<SocialVisualQualityCandidate> = {},
): SocialVisualQualityCandidate {
  return {
    subject_kind: 'framework',
    public_subject_assets: [{ asset_id: 'framework-mark', asset_type: 'logo' }],
    detail_sections: ['Decision', 'Tradeoff', 'Next step'],
    value_statement: 'Shows which choice to make before the work starts.',
    required_customer_facing_fields: ['headline', 'decision'],
    source_bindings: [
      { field: ' headline ', source_id: 'brief-1', boundary: 'approved public claim' },
      { field: 'decision', source_id: 'brief-1', boundary: 'bounded paraphrase' },
    ],
    dominant_composition: 'process_rail',
    recent_approved_compositions: ['process_rail'],
    composition_reuse_rationale: 'The rail matches the three-step decision this brief has to show.',
    desktop_legibility_verified: true,
    mobile_legibility_verified: true,
    ...overrides,
  }
}

describe('evaluateSocialVisualQualityCandidate gates', () => {
  it('allows a non-product visual to reuse a composition when rationale and trimmed bindings are present', () => {
    expect(evaluateSocialVisualQualityCandidate(passingCandidate())).toEqual(passed)
  })

  it.each([
    'product_screenshot',
    'workflow_capture',
    'product_image',
  ] as const)('accepts a product visual backed only by a %s', (assetType) => {
    expect(evaluateSocialVisualQualityCandidate(passingCandidate({
      subject_kind: 'product',
      public_subject_assets: [{ asset_id: 'evidence-1', asset_type: assetType }],
      dominant_composition: 'evidence_frame',
      recent_approved_compositions: [],
      composition_reuse_rationale: null,
    }))).toEqual(passed)
  })

  it('does not treat a blank inspectable asset id as product evidence', () => {
    const evaluation = evaluateSocialVisualQualityCandidate(passingCandidate({
      subject_kind: 'product',
      public_subject_assets: [
        { asset_id: ' ', asset_type: 'product_screenshot' },
        { asset_id: 'mark', asset_type: 'logo' },
      ],
      dominant_composition: 'evidence_frame',
      recent_approved_compositions: [],
    }))

    expect(evaluation).toMatchObject({
      standard_version: SOCIAL_VISUAL_QUALITY_STANDARD_VERSION,
      status: 'blocked',
      pass_to_human: false,
    })
    expect(evaluation.blockers).toEqual([PRODUCT_EVIDENCE_BLOCKER])
  })

  it('blocks a complete field set when any binding has a blank source id or claim boundary', () => {
    for (const broken of [
      { field: 'aside', source_id: ' ', boundary: 'approved public claim' },
      { field: 'aside', source_id: 'brief-2', boundary: '   ' },
    ]) {
      const evaluation = evaluateSocialVisualQualityCandidate(passingCandidate({
        source_bindings: [
          { field: 'headline', source_id: 'brief-1', boundary: 'approved public claim' },
          { field: 'decision', source_id: 'brief-1', boundary: 'bounded paraphrase' },
          broken,
        ],
        dominant_composition: 'evidence_frame',
        recent_approved_compositions: [],
      }))

      expect(evaluation.blockers).toEqual([SOURCE_BINDING_BLOCKER])
      expect(evaluation.pass_to_human).toBe(false)
    }
  })

  it('blocks a candidate that names no customer-facing fields', () => {
    const evaluation = evaluateSocialVisualQualityCandidate(passingCandidate({
      required_customer_facing_fields: [],
      source_bindings: [
        { field: 'headline', source_id: 'brief-1', boundary: 'approved public claim' },
      ],
      dominant_composition: 'evidence_frame',
      recent_approved_compositions: [],
    }))

    expect(evaluation.blockers).toEqual([SOURCE_BINDING_BLOCKER])
    expect(evaluation.status).toBe('blocked')
  })

  it('does not accept a whitespace reuse rationale for a repeated composition', () => {
    const evaluation = evaluateSocialVisualQualityCandidate(passingCandidate({
      composition_reuse_rationale: '   ',
    }))

    expect(evaluation.blockers).toEqual([COMPOSITION_REUSE_BLOCKER])
    expect(evaluation.pass_to_human).toBe(false)
  })
})
