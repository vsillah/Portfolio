export const PRACTITIONER_PUBLIC_USE_BOUNDARIES = [
  'framework_only',
  'anonymized_public_summary',
  'internal_only',
] as const

export type PractitionerPublicUseBoundary = typeof PRACTITIONER_PUBLIC_USE_BOUNDARIES[number]

export type PractitionerEvidenceAuthoring = {
  role_context: string
  situation: string
  action_taken: string
  observed_outcome: string
  limitations: string
  public_use_boundary: PractitionerPublicUseBoundary | ''
  redaction_receipt: {
    direct_identifiers_removed: boolean
    indirect_identifiers_reviewed: boolean
    sensitive_details_removed: boolean
    review_note: string
    reviewed_at?: string
    reviewed_by?: string
  }
  framework_receipt: {
    selected_framework_key: string
    selected_framework_value?: unknown
    application_note: string
    source_use_confirmed: boolean
    recorded_at?: string
    recorded_by?: string
  }
  revision_note: string
  saved_at?: string
  saved_by?: string
}

export const EMPTY_PRACTITIONER_EVIDENCE: PractitionerEvidenceAuthoring = {
  role_context: '',
  situation: '',
  action_taken: '',
  observed_outcome: '',
  limitations: '',
  public_use_boundary: '',
  redaction_receipt: {
    direct_identifiers_removed: false,
    indirect_identifiers_reviewed: false,
    sensitive_details_removed: false,
    review_note: '',
  },
  framework_receipt: {
    selected_framework_key: '',
    application_note: '',
    source_use_confirmed: false,
  },
  revision_note: '',
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizePractitionerEvidence(value: unknown): PractitionerEvidenceAuthoring {
  const input = record(value)
  const redaction = record(input.redaction_receipt)
  const framework = record(input.framework_receipt)
  const boundary = text(input.public_use_boundary)
  return {
    role_context: text(input.role_context),
    situation: text(input.situation),
    action_taken: text(input.action_taken),
    observed_outcome: text(input.observed_outcome),
    limitations: text(input.limitations),
    public_use_boundary: PRACTITIONER_PUBLIC_USE_BOUNDARIES.includes(boundary as PractitionerPublicUseBoundary)
      ? boundary as PractitionerPublicUseBoundary
      : '',
    redaction_receipt: {
      direct_identifiers_removed: redaction.direct_identifiers_removed === true,
      indirect_identifiers_reviewed: redaction.indirect_identifiers_reviewed === true,
      sensitive_details_removed: redaction.sensitive_details_removed === true,
      review_note: text(redaction.review_note),
      reviewed_at: text(redaction.reviewed_at) || undefined,
      reviewed_by: text(redaction.reviewed_by) || undefined,
    },
    framework_receipt: {
      selected_framework_key: text(framework.selected_framework_key),
      selected_framework_value: framework.selected_framework_value,
      application_note: text(framework.application_note),
      source_use_confirmed: framework.source_use_confirmed === true,
      recorded_at: text(framework.recorded_at) || undefined,
      recorded_by: text(framework.recorded_by) || undefined,
    },
    revision_note: text(input.revision_note),
    saved_at: text(input.saved_at) || undefined,
    saved_by: text(input.saved_by) || undefined,
  }
}

export function practitionerEvidenceValidation(
  value: unknown,
  patternPacket: unknown,
): { valid: boolean; issues: string[] } {
  const evidence = normalizePractitionerEvidence(value)
  const patterns = record(patternPacket)
  const issues: string[] = []
  if (evidence.role_context.length < 3) issues.push('Add an anonymized practitioner role or context (at least 3 characters).')
  if (evidence.role_context.length > 120) issues.push('Keep the practitioner role or context within 120 characters.')
  if (evidence.situation.length < 20) issues.push('Describe the anonymized situation in at least 20 characters.')
  if (evidence.situation.length > 1200) issues.push('Keep the anonymized situation within 1,200 characters.')
  if (evidence.action_taken.length < 20) issues.push('Describe the practitioner action in at least 20 characters.')
  if (evidence.action_taken.length > 1200) issues.push('Keep the practitioner action within 1,200 characters.')
  if (evidence.observed_outcome.length < 20) issues.push('Describe the observed outcome in at least 20 characters.')
  if (evidence.observed_outcome.length > 1200) issues.push('Keep the observed outcome within 1,200 characters.')
  if (evidence.limitations.length < 10) issues.push('Add a limitation or evidence boundary in at least 10 characters.')
  if (evidence.limitations.length > 1200) issues.push('Keep the limitation or evidence boundary within 1,200 characters.')
  if (!evidence.public_use_boundary) issues.push('Choose a public-use boundary.')
  if (evidence.public_use_boundary === 'internal_only') issues.push('Internal-only evidence cannot be approved for Social Insights; choose framework-only or anonymized public summary.')
  if (!evidence.redaction_receipt.direct_identifiers_removed) issues.push('Confirm direct identifiers were removed.')
  if (!evidence.redaction_receipt.indirect_identifiers_reviewed) issues.push('Confirm indirect identifiers were reviewed.')
  if (!evidence.redaction_receipt.sensitive_details_removed) issues.push('Confirm sensitive details were removed or generalized.')
  if (evidence.redaction_receipt.review_note.length < 10) issues.push('Add a redaction receipt note in at least 10 characters.')
  if (evidence.redaction_receipt.review_note.length > 1000) issues.push('Keep the redaction receipt note within 1,000 characters.')
  const frameworkKey = evidence.framework_receipt.selected_framework_key
  if (!frameworkKey || !Object.prototype.hasOwnProperty.call(patterns, frameworkKey)) issues.push('Select a framework from this research packet.')
  if (evidence.framework_receipt.application_note.length < 20) issues.push('Explain how the framework applies without copying the source (at least 20 characters).')
  if (evidence.framework_receipt.application_note.length > 1200) issues.push('Keep the framework application note within 1,200 characters.')
  if (!evidence.framework_receipt.source_use_confirmed) issues.push('Confirm the source is used as a framework, not copied wording or visual identity.')
  if (evidence.revision_note.length < 3) issues.push('Add a concise revision note (at least 3 characters).')
  if (evidence.revision_note.length > 500) issues.push('Keep the revision note within 500 characters.')
  return { valid: issues.length === 0, issues }
}
