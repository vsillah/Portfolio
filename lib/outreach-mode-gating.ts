export type OutreachTemperature = 'cold' | 'warm'
export type OutreachAudienceMode = 'one_to_one' | 'one_to_many'
export type OutreachModeKey = 'cold_1_to_1' | 'cold_1_to_many' | 'warm_1_to_1' | 'warm_1_to_many'

export type OutreachModePolicy = {
  key: OutreachModeKey
  label: string
  temperature: OutreachTemperature
  audienceMode: OutreachAudienceMode
  canonicalSurface: '/admin/outreach'
  allowedInternalActions: string[]
  requiredGates: string[]
  externalExecutionEnabled: false
}

export const OUTREACH_MODE_POLICIES: Record<OutreachModeKey, OutreachModePolicy> = {
  cold_1_to_1: {
    key: 'cold_1_to_1',
    label: 'Cold 1:1',
    temperature: 'cold',
    audienceMode: 'one_to_one',
    canonicalSurface: '/admin/outreach',
    allowedInternalActions: ['lead review', 'evidence enrichment', 'draft preparation', 'human approval packet'],
    requiredGates: ['source evidence', 'do-not-contact check', 'offer fit', 'human approval before send'],
    externalExecutionEnabled: false,
  },
  cold_1_to_many: {
    key: 'cold_1_to_many',
    label: 'Cold 1:many',
    temperature: 'cold',
    audienceMode: 'one_to_many',
    canonicalSurface: '/admin/outreach',
    allowedInternalActions: ['segment review', 'evidence sampling', 'campaign draft preparation', 'human approval packet'],
    requiredGates: ['segment source evidence', 'suppression list check', 'message QA', 'human approval before scheduling'],
    externalExecutionEnabled: false,
  },
  warm_1_to_1: {
    key: 'warm_1_to_1',
    label: 'Warm 1:1',
    temperature: 'warm',
    audienceMode: 'one_to_one',
    canonicalSurface: '/admin/outreach',
    allowedInternalActions: ['relationship context review', 'meeting/action-item lookup', 'draft preparation', 'human approval packet'],
    requiredGates: ['relationship basis', 'recent context check', 'privacy review', 'human approval before send'],
    externalExecutionEnabled: false,
  },
  warm_1_to_many: {
    key: 'warm_1_to_many',
    label: 'Warm 1:many',
    temperature: 'warm',
    audienceMode: 'one_to_many',
    canonicalSurface: '/admin/outreach',
    allowedInternalActions: ['audience context review', 'relationship-safe segmentation', 'draft preparation', 'human approval packet'],
    requiredGates: ['audience relationship basis', 'suppression list check', 'privacy review', 'human approval before scheduling'],
    externalExecutionEnabled: false,
  },
}

export const OUTREACH_MODE_GATING_NOTE = [
  'These modes are model and review classifications only.',
  'They do not enable provider calls, external sends, scheduling, publication, or Slack/provider side effects.',
].join(' ')
