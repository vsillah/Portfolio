/**
 * Canonical lead_source values and helpers.
 * Single source of truth: must stay in sync with DB constraint
 * contact_submissions_lead_source_check (see migrations).
 *
 * When adding/removing values: update this file, the DB constraint,
 * and any API validation or UI dropdowns (grep for lead_source).
 */

/** All allowed lead_source values (matches DB CHECK constraint) */
export const LEAD_SOURCE_VALUES = [
  'warm_facebook_friends',
  'warm_google_contacts',
  'warm_linkedin',
  'warm_referral',
  'cold_apollo',
  'cold_hunter',
  'cold_referral',
  'cold_linkedin',
  'cold_business_card',
  'cold_event',
  'website_form',
  'other',
] as const

export type LeadSource = (typeof LEAD_SOURCE_VALUES)[number]

const WARM_PREFIX = 'warm_'
const COLD_PREFIX = 'cold_'

export function isWarmLeadSource(leadSource: string | null | undefined): boolean {
  return typeof leadSource === 'string' && leadSource.startsWith(WARM_PREFIX)
}

export function isColdLeadSource(leadSource: string | null | undefined): boolean {
  return typeof leadSource === 'string' && leadSource.startsWith(COLD_PREFIX)
}

/** For "temperature" filter: only apply when filter is warm or cold; "all" = no filter */
export type LeadTemperatureFilter = 'all' | 'warm' | 'cold'

/** Manual Add Lead form: input_type -> lead_source */
export const INPUT_TYPE_TO_LEAD_SOURCE: Record<string, LeadSource> = {
  linkedin: 'cold_linkedin',
  referral: 'cold_referral',
  business_card: 'cold_business_card',
  event: 'cold_event',
  other: 'other',
}

export function leadSourceFromInputType(inputType: string | undefined): LeadSource {
  if (inputType && inputType in INPUT_TYPE_TO_LEAD_SOURCE) {
    return INPUT_TYPE_TO_LEAD_SOURCE[inputType]
  }
  return 'cold_referral'
}

/** Reverse: lead_source from DB -> input_type for Edit lead form dropdown */
export const LEAD_SOURCE_TO_INPUT_TYPE: Record<string, string> = {
  cold_linkedin: 'linkedin',
  cold_referral: 'referral',
  cold_business_card: 'business_card',
  cold_event: 'event',
  other: 'other',
}

export function inputTypeFromLeadSource(leadSource: string | null | undefined): string {
  if (leadSource && leadSource in LEAD_SOURCE_TO_INPUT_TYPE) {
    return LEAD_SOURCE_TO_INPUT_TYPE[leadSource]
  }
  return 'other'
}

/** Valid lead_sources for ingest API (subset that ingest accepts) */
export const INGEST_ALLOWED_LEAD_SOURCES: readonly string[] = [
  ...LEAD_SOURCE_VALUES.filter((s) => s.startsWith('warm_') || s.startsWith('cold_')),
]

export function isAllowedLeadSourceForIngest(leadSource: string): boolean {
  return INGEST_ALLOWED_LEAD_SOURCES.includes(leadSource)
}

/** Relationship strength for ingest/outreach (used by ingest API) */
export type RelationshipStrength = 'strong' | 'moderate' | 'weak'

export function getRelationshipStrength(leadSource: string): RelationshipStrength {
  switch (leadSource) {
    case 'warm_facebook_friends':
    case 'warm_google_contacts':
    case 'warm_linkedin':
      return 'strong'
    case 'warm_referral':
      return 'moderate'
    default:
      return 'weak'
  }
}
