import { describe, expect, it } from 'vitest'

import {
  DETERMINISTIC_VISUAL_QA_ASSET_URL,
  deterministicVisualBindingQaFixture,
} from './social-deterministic-visual-qa-fixture'

describe('deterministic visual QA fixture', () => {
  it('keeps the legacy asset visible while missing field lineage fails closed', () => {
    const item = deterministicVisualBindingQaFixture('lineage_missing')

    expect(item.image_url).toBe(DETERMINISTIC_VISUAL_QA_ASSET_URL)
    expect(item.deterministic_visual_render).toMatchObject({
      state: 'blocked',
      code: 'field_lineage_blocked',
      can_render: false,
      receipt: {
        status: 'current',
        provider_receipt: {
          provider: 'none',
          external_call: false,
        },
      },
    })
    expect(item.deterministic_visual_render?.inputs.lineage_status).toBe('blocked')
    expect(item.deterministic_visual_render?.inputs.field_lineage.some(
      (field) => field.derivation === 'source_backed' && field.proof_status === 'blocked',
    )).toBe(true)
    expect(item.deterministic_visual_render?.inputs.field_lineage.some(
      (field) => field.derivation === 'template_derived' && field.proof_status === 'passed',
    )).toBe(true)
  })
})
