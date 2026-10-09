import { describe, expect, it } from 'vitest'
import { normalizePractitionerEvidence, practitionerEvidenceValidation } from './research-practitioner-evidence'

const valid = {
  role_context: 'Community operations lead',
  situation: 'A recurring handoff was creating avoidable delays for the team.',
  action_taken: 'The practitioner introduced a short evidence review before assignment.',
  observed_outcome: 'The team caught missing context earlier and reduced repeated follow-up.',
  limitations: 'Observed in one bounded workflow; no causal claim is made.',
  public_use_boundary: 'anonymized_public_summary',
  redaction_receipt: { direct_identifiers_removed: true, indirect_identifiers_reviewed: true, sensitive_details_removed: true, review_note: 'Names and unique organizational details were generalized.' },
  framework_receipt: { selected_framework_key: 'framework', application_note: 'Apply the scene-to-lesson structure without using source language.', source_use_confirmed: true },
  revision_note: 'Initial authoring receipt.',
}

describe('practitioner evidence authoring', () => {
  it('accepts complete anonymized evidence bound to an existing packet framework', () => {
    expect(practitionerEvidenceValidation(valid, { framework: 'Scene to lesson' })).toEqual({ valid: true, issues: [] })
  })

  it('returns actionable privacy, boundary, and framework blockers', () => {
    const result = practitionerEvidenceValidation({
      ...valid,
      public_use_boundary: 'internal_only',
      redaction_receipt: { ...valid.redaction_receipt, indirect_identifiers_reviewed: false },
      framework_receipt: { ...valid.framework_receipt, selected_framework_key: 'missing' },
    }, { framework: 'Scene to lesson' })
    expect(result.valid).toBe(false)
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.stringContaining('Internal-only evidence'),
      expect.stringContaining('indirect identifiers'),
      expect.stringContaining('Select a framework'),
    ]))
  })

  it('normalizes unknown input without retaining arbitrary private fields', () => {
    const normalized = normalizePractitionerEvidence({ ...valid, private_name: 'must not survive' })
    expect(normalized).not.toHaveProperty('private_name')
    expect(normalized.role_context).toBe(valid.role_context)
  })

  it('fails closed on oversized evidence that bypasses browser limits', () => {
    const result = practitionerEvidenceValidation({ ...valid, situation: 'x'.repeat(1201) }, { framework: 'Scene to lesson' })
    expect(result.issues).toContain('Keep the anonymized situation within 1,200 characters.')
  })
})
