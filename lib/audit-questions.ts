/**
 * Standalone AI / Automation Audit — same 6 categories as chat-based diagnostic.
 * Used by the /tools/audit form and maps directly to diagnostic_audits JSONB columns.
 */

import type { DiagnosticCategory } from './n8n'

export interface AuditField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'multiline' | 'boolean' | 'select' | 'multiselect'
  placeholder?: string
  options?: { value: string; label: string }[]
  /** When type is multiline, store as string[] (one item per line). For multiselect, store as string[]. */
  multiple?: boolean
}

export interface AuditCategoryConfig {
  id: DiagnosticCategory
  title: string
  description: string
  fields: AuditField[]
}

/** Build the payload for one category from form values (key -> value or string[]) */
export function categoryFormToPayload(
  categoryId: DiagnosticCategory,
  values: Record<string, string | string[] | boolean>
): Record<string, unknown> {
  const config = AUDIT_CATEGORIES.find((c) => c.id === categoryId)
  if (!config) return {}

  const out: Record<string, unknown> = {}
  for (const field of config.fields) {
    const v = values[field.key]
    if (v === undefined || v === '') continue
    if (field.type === 'boolean') {
      out[field.key] = v === true || v === 'true' || (typeof v === 'string' && v.toLowerCase() === 'yes')
    } else if (field.type === 'multiselect' && Array.isArray(v)) {
      if (v.length) out[field.key] = v
      if (v.includes('other')) {
        const otherVal = values[`${field.key}_other`]
        if (typeof otherVal === 'string' && otherVal.trim()) out[`${field.key}_other`] = otherVal.trim()
      }
      continue
    } else if (field.multiple && Array.isArray(v)) {
      out[field.key] = v
    } else if (field.multiple && typeof v === 'string') {
      out[field.key] = v
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    } else {
      out[field.key] = v
      // When a select (dropdown) has "other" selected, include the free-text _other value
      if (field.type === 'select' && v === 'other') {
        const otherVal = values[`${field.key}_other`]
        if (typeof otherVal === 'string' && otherVal.trim()) out[`${field.key}_other`] = otherVal.trim()
      }
    }
  }
  return out
}

const PRIMARY_CHALLENGES = [
  { value: 'manual_processes', label: 'Manual, repetitive processes' },
  { value: 'data_silos', label: 'Data in silos or hard to access' },
  { value: 'slow_follow_up', label: 'Slow lead or customer follow-up' },
  { value: 'reporting_delays', label: 'Delayed or manual reporting' },
  { value: 'scaling_bottlenecks', label: 'Scaling bottlenecks' },
  { value: 'team_bandwidth', label: 'Team bandwidth limits' },
  { value: 'inconsistent_processes', label: 'Inconsistent processes across team' },
  { value: 'other', label: 'Other' },
]

const PAIN_POINTS = [
  { value: 'manual_data_entry', label: 'Manual data entry' },
  { value: 'spreadsheet_overload', label: 'Spreadsheet overload' },
  { value: 'no_single_source', label: 'No single source of truth' },
  { value: 'slow_lead_response', label: 'Slow lead response time' },
  { value: 'missed_follow_ups', label: 'Missed follow-ups' },
  { value: 'ad_hoc_reporting', label: 'Ad hoc reporting' },
  { value: 'disconnected_tools', label: 'Disconnected tools' },
  { value: 'high_admin_overhead', label: 'High admin overhead' },
  { value: 'other', label: 'Other' },
]

const CURRENT_IMPACT_OPTIONS = [
  { value: 'under_5_hrs', label: 'Under 5 hours/week lost' },
  { value: '5_10_hrs', label: '5–10 hours/week' },
  { value: '10_20_hrs', label: '10–20 hours/week' },
  { value: '20_plus_hrs', label: '20+ hours/week' },
  { value: 'delayed_decisions', label: 'Delayed decisions / missed deadlines' },
  { value: 'revenue_impact', label: 'Direct revenue or deal impact' },
  { value: 'unsure', label: 'Not sure yet' },
]

const CRM_OPTIONS = [
  { value: 'none', label: 'None / spreadsheets' },
  { value: 'hubspot', label: 'HubSpot' },
  { value: 'salesforce', label: 'Salesforce' },
  { value: 'pipedrive', label: 'Pipedrive' },
  { value: 'zoho', label: 'Zoho CRM' },
  { value: 'other', label: 'Other' },
]

const INTEGRATION_READINESS = [
  { value: 'not_connected', label: 'Not connected; mostly manual' },
  { value: 'some_apis', label: 'Some APIs or integrations' },
  { value: 'partially_connected', label: 'Partially connected' },
  { value: 'well_integrated', label: 'Well integrated' },
]

const PRIORITY_AUTOMATION_AREAS = [
  { value: 'lead_follow_up', label: 'Lead follow-up and nurturing' },
  { value: 'reporting', label: 'Reporting and dashboards' },
  { value: 'data_sync', label: 'Data sync between tools' },
  { value: 'scheduling', label: 'Scheduling and reminders' },
  { value: 'email_sequences', label: 'Email sequences and campaigns' },
  { value: 'document_handling', label: 'Document handling and approvals' },
  { value: 'customer_onboarding', label: 'Customer onboarding' },
  { value: 'other', label: 'Other' },
]

const DESIRED_OUTCOMES = [
  { value: 'same_day_follow_up', label: 'Same-day or faster follow-up' },
  { value: 'one_click_reports', label: 'One-click or automated reports' },
  { value: 'fewer_manual_steps', label: 'Fewer manual steps' },
  { value: 'consistent_process', label: 'Consistent process across team' },
  { value: 'visibility', label: 'Better visibility into pipeline' },
  { value: 'scale_without_hiring', label: 'Scale without proportionally hiring' },
  { value: 'other', label: 'Other' },
]

const AI_CONCERNS = [
  { value: 'data_quality', label: 'Data quality or cleanliness' },
  { value: 'privacy_security', label: 'Privacy or security' },
  { value: 'team_adoption', label: 'Team adoption' },
  { value: 'cost', label: 'Cost' },
  { value: 'complexity', label: 'Complexity or learning curve' },
  { value: 'other', label: 'Other' },
]

const TIMELINE_OPTIONS = [
  { value: 'asap', label: 'As soon as possible' },
  { value: '4_8_weeks', label: 'Within 4–8 weeks' },
  { value: 'quarter', label: 'This quarter' },
  { value: '3_6_months', label: '3–6 months' },
  { value: '6_12_months', label: '6–12 months' },
  { value: 'exploring', label: 'Just exploring; no fixed timeline' },
]

const STAKEHOLDER_OPTIONS = [
  { value: 'ceo', label: 'CEO / Founder' },
  { value: 'cfo', label: 'CFO / Finance' },
  { value: 'cto', label: 'CTO / IT' },
  { value: 'coo', label: 'COO / Operations' },
  { value: 'sales_lead', label: 'Sales lead' },
  { value: 'marketing_lead', label: 'Marketing lead' },
  { value: 'board', label: 'Board' },
  { value: 'other', label: 'Other' },
]

const APPROVAL_PROCESS_OPTIONS = [
  { value: 'solo', label: 'I can approve on my own' },
  { value: 'one_approver', label: 'One other approver' },
  { value: 'committee', label: 'Committee or multi-step' },
  { value: 'budget_threshold', label: 'Depends on budget threshold' },
  { value: 'other', label: 'Other' },
]

export const AUDIT_CATEGORIES: AuditCategoryConfig[] = [
  {
    id: 'business_challenges',
    title: 'Business challenges',
    description: 'What are the main pain points or inefficiencies you\'re facing?',
    fields: [
      { key: 'primary_challenges', label: 'Primary challenges', type: 'multiselect', options: PRIMARY_CHALLENGES },
      { key: 'pain_points', label: 'Pain points', type: 'multiselect', options: PAIN_POINTS },
      { key: 'current_impact', label: 'Current impact (time/cost)', type: 'select', options: CURRENT_IMPACT_OPTIONS },
      { key: 'attempted_solutions', label: 'What you\'ve already tried', type: 'select', options: [
        { value: 'none', label: 'Haven\'t tried much yet' },
        { value: 'tools', label: 'Bought tools but underused' },
        { value: 'consultants', label: 'Consultants or one-off projects' },
        { value: 'internal', label: 'Internal process changes only' },
        { value: 'other', label: 'Other' },
      ] },
    ],
  },
  {
    id: 'tech_stack',
    title: 'Tech stack',
    description: 'What tools and systems are you using today?',
    fields: [
      { key: 'crm', label: 'CRM', type: 'select', options: CRM_OPTIONS },
      { key: 'email', label: 'Email / comms', type: 'select', options: [
        { value: 'gmail', label: 'Gmail / Google Workspace' },
        { value: 'outlook', label: 'Outlook / Microsoft 365' },
        { value: 'slack', label: 'Slack' },
        { value: 'other', label: 'Other' },
      ] },
      { key: 'marketing', label: 'Marketing tools', type: 'select', options: [
        { value: 'none', label: 'None' },
        { value: 'mailchimp', label: 'Mailchimp' },
        { value: 'meta', label: 'Meta Ads' },
        { value: 'hubspot_marketing', label: 'HubSpot Marketing' },
        { value: 'other', label: 'Other' },
      ] },
      { key: 'analytics', label: 'Analytics', type: 'select', options: [
        { value: 'none', label: 'None' },
        { value: 'ga', label: 'Google Analytics' },
        { value: 'mixpanel', label: 'Mixpanel / product analytics' },
        { value: 'other', label: 'Other' },
      ] },
      { key: 'integration_readiness', label: 'Integration readiness', type: 'select', options: INTEGRATION_READINESS },
    ],
  },
  {
    id: 'automation_needs',
    title: 'Automation needs',
    description: 'Which processes take the most time that you\'d like to automate?',
    fields: [
      { key: 'priority_areas', label: 'Priority areas to automate', type: 'multiselect', options: PRIORITY_AUTOMATION_AREAS },
      { key: 'desired_outcomes', label: 'Desired outcomes', type: 'multiselect', options: DESIRED_OUTCOMES },
      { key: 'complexity_tolerance', label: 'Complexity tolerance', type: 'select', options: [
        { value: 'low', label: 'Keep it simple' },
        { value: 'medium', label: 'Some complexity OK' },
        { value: 'high', label: 'Willing to invest in robust solutions' },
      ] },
    ],
  },
  {
    id: 'ai_readiness',
    title: 'AI readiness',
    description: 'How would you describe your organization\'s readiness for AI?',
    fields: [
      { key: 'data_quality', label: 'Data quality', type: 'select', options: [
        { value: 'scattered', label: 'Mostly spreadsheets and emails' },
        { value: 'some_systems', label: 'Some systems, not connected' },
        { value: 'integrated', label: 'Integrated in core systems' },
        { value: 'ready', label: 'Clean and accessible for automation' },
      ] },
      { key: 'team_readiness', label: 'Team readiness', type: 'select', options: [
        { value: 'not_yet', label: 'Not yet / exploring' },
        { value: 'individual', label: 'A few people use tools ad hoc' },
        { value: 'pilot', label: 'Pilots or one team using it' },
        { value: 'scaling', label: 'Scaling across teams' },
      ] },
      { key: 'previous_ai_experience', label: 'Previous AI/automation experience', type: 'select', options: [
        { value: 'none', label: 'Little or none' },
        { value: 'personal', label: 'Personal use (ChatGPT, etc.)' },
        { value: 'team_tools', label: 'Team using some AI tools' },
        { value: 'built_something', label: 'We\'ve built or integrated AI' },
      ] },
      { key: 'concerns', label: 'Concerns or blockers', type: 'multiselect', options: AI_CONCERNS },
    ],
  },
  {
    id: 'budget_timeline',
    title: 'Budget & timeline',
    description: 'What budget and timeline are you considering?',
    fields: [
      { key: 'budget_range', label: 'Budget range', type: 'select', options: [
        { value: 'none', label: 'No budget yet' },
        { value: 'small', label: 'Small (< $10k)' },
        { value: 'medium', label: 'Medium ($10k–50k)' },
        { value: 'large', label: 'Larger ($50k+)' },
      ] },
      { key: 'timeline', label: 'Ideal timeline', type: 'select', options: TIMELINE_OPTIONS },
      { key: 'decision_timeline', label: 'When do you need to decide?', type: 'select', options: [
        ...TIMELINE_OPTIONS,
        { value: 'no_deadline', label: 'No fixed deadline' },
      ] },
      { key: 'budget_flexibility', label: 'Budget flexibility', type: 'select', options: [
        { value: 'fixed', label: 'Fixed; need to stay within budget' },
        { value: 'some_flex', label: 'Some flexibility for right fit' },
        { value: 'value_driven', label: 'Value-driven; can expand for ROI' },
      ] },
    ],
  },
  {
    id: 'decision_making',
    title: 'Decision making',
    description: 'Who is involved in technology and buying decisions?',
    fields: [
      { key: 'decision_maker', label: 'Are you the decision maker?', type: 'boolean' },
      { key: 'stakeholders', label: 'Other stakeholders involved', type: 'multiselect', options: STAKEHOLDER_OPTIONS },
      { key: 'approval_process', label: 'Approval process', type: 'select', options: APPROVAL_PROCESS_OPTIONS },
      { key: 'previous_vendor_experience', label: 'Previous vendor experience', type: 'select', options: [
        { value: 'none', label: 'Little or none' },
        { value: 'mixed', label: 'Mixed results' },
        { value: 'positive', label: 'Generally positive' },
        { value: 'other', label: 'Other' },
      ] },
    ],
  },
]

export const AUDIT_CATEGORY_ORDER: DiagnosticCategory[] = AUDIT_CATEGORIES.map((c) => c.id)

/**
 * Format one audit payload value for display (e.g. "Budget range: Medium ($10k–50k)").
 * Used on the results page to show score drivers and tie scores to answers.
 */
export function formatPayloadLine(
  categoryId: DiagnosticCategory,
  key: string,
  value: unknown
): string | null {
  const config = AUDIT_CATEGORIES.find((c) => c.id === categoryId)
  if (!config) return null
  const field = config.fields.find((f) => f.key === key)
  if (!field) return null
  const label = field.label
  if (field.type === 'boolean') {
    const v = value === true || value === 'true'
    return `${label}: ${v ? 'Yes' : 'No'}`
  }
  if (field.type === 'select' && field.options && (typeof value === 'string' || typeof value === 'number')) {
    const opt = field.options.find((o) => o.value === String(value))
    return opt ? `${label}: ${opt.label}` : `${label}: ${value}`
  }
  if ((field.type === 'multiselect' || field.multiple) && Array.isArray(value)) {
    if (value.length === 0) return null
    const opts = field.options
      ? (value as string[]).map((v) => field.options!.find((o) => o.value === v)?.label ?? v)
      : (value as string[])
    return `${label}: ${opts.join(', ')}`
  }
  if (typeof value === 'string' && value) return `${label}: ${value}`
  return null
}
