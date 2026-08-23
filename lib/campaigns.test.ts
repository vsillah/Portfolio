import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  areAllCriteriaMet,
  calculateDeadline,
  calculateOverallProgress,
  enrollmentDaysRemaining,
  extractThresholdValue,
  isCampaignEnrollable,
  isEnrollmentExpired,
  isValidCampaignStatus,
  isValidCampaignType,
  isValidCriteriaType,
  isValidEnrollmentSource,
  isValidEnrollmentStatus,
  isValidTrackingSource,
  materializeCriteria,
  resolveTemplate,
  validateSlug,
} from './campaigns'
import type { CampaignCriteriaTemplate, PersonalizationContext } from './campaigns'

function template(overrides: Partial<CampaignCriteriaTemplate> = {}): CampaignCriteriaTemplate {
  return {
    id: 'tpl-1',
    campaign_id: 'camp-1',
    label_template: 'Reach {{desired_monthly_revenue}} in monthly revenue',
    description_template: 'Baseline from {{desired_monthly_revenue}}',
    criteria_type: 'result',
    tracking_source: 'manual',
    tracking_config: {},
    threshold_source: 'audit.desired_monthly_revenue',
    threshold_default: '10000',
    required: true,
    display_order: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('resolveTemplate', () => {
  it('replaces known {{placeholders}}', () => {
    expect(resolveTemplate('Hello {{name}}', { name: 'Ada' })).toBe('Hello Ada')
  })

  it('leaves unknown placeholders intact', () => {
    expect(resolveTemplate('Keep {{missing}}', {})).toBe('Keep {{missing}}')
  })

  it('does not interpolate dotted or spaced keys', () => {
    expect(resolveTemplate('{{audit.value}} and {{full name}}', {
      'audit.value': 'x',
      'full name': 'y',
    })).toBe('{{audit.value}} and {{full name}}')
  })
})

describe('extractThresholdValue', () => {
  const context: PersonalizationContext = {
    audit_data: { desired_monthly_revenue: 25000, nested: { score: 88 } },
    value_evidence: { industry: 'healthcare' },
    chat_insights: { urgency: 'high' },
    custom_overrides: { label: 'custom' },
  }

  it('maps audit/evidence/chat/custom prefixes onto context keys', () => {
    expect(extractThresholdValue(context, 'audit.desired_monthly_revenue', '0')).toBe('25000')
    expect(extractThresholdValue(context, 'evidence.industry', 'none')).toBe('healthcare')
    expect(extractThresholdValue(context, 'chat.urgency', 'low')).toBe('high')
    expect(extractThresholdValue(context, 'custom.label', 'fallback')).toBe('custom')
  })

  it('walks nested objects and returns the default when a segment is missing', () => {
    expect(extractThresholdValue(context, 'audit.nested.score', '0')).toBe('88')
    expect(extractThresholdValue(context, 'audit.missing.path', 'fallback')).toBe('fallback')
  })

  it('returns the default when a mid-path value is not an object', () => {
    expect(extractThresholdValue(context, 'audit.desired_monthly_revenue.child', 'fallback')).toBe('fallback')
  })

  it('returns the default when threshold_source is null', () => {
    expect(extractThresholdValue(context, null, '10000')).toBe('10000')
  })
})

describe('materializeCriteria', () => {
  it('fills labels from the last threshold_source segment and keeps the target', () => {
    const [row] = materializeCriteria([template()], {
      audit_data: { desired_monthly_revenue: 18000 },
    })

    expect(row).toEqual(expect.objectContaining({
      template_criterion_id: 'tpl-1',
      label: 'Reach 18000 in monthly revenue',
      description: 'Baseline from 18000',
      target_value: '18000',
      required: true,
      display_order: 1,
    }))
  })

  it('falls back to the default target and lets custom overrides win on the same key', () => {
    const [row] = materializeCriteria([template()], {
      custom_overrides: { desired_monthly_revenue: 'override' },
    })

    expect(row.label).toBe('Reach override in monthly revenue')
    expect(row.target_value).toBe('10000')
  })

  it('leaves the placeholder when no target or override is available', () => {
    const [row] = materializeCriteria([
      template({ threshold_source: null, threshold_default: null, description_template: null }),
    ], {})

    expect(row.label).toBe('Reach {{desired_monthly_revenue}} in monthly revenue')
    expect(row.description).toBeNull()
    expect(row.target_value).toBeNull()
  })
})

describe('calculateDeadline', () => {
  it('adds the completion window in calendar days', () => {
    const enrolledAt = new Date('2026-01-15T12:00:00.000Z')
    const deadline = calculateDeadline(enrolledAt, 30)
    expect(deadline.toISOString().slice(0, 10)).toBe('2026-02-14')
  })

  it('does not mutate the original enrollment date', () => {
    const enrolledAt = new Date('2026-01-15T12:00:00.000Z')
    calculateDeadline(enrolledAt, 7)
    expect(enrolledAt.toISOString()).toBe('2026-01-15T12:00:00.000Z')
  })
})

describe('areAllCriteriaMet', () => {
  it('requires every required criterion to be met or waived', () => {
    expect(areAllCriteriaMet(
      [{ status: 'met' }, { status: 'waived' }],
      [{ required: true }, { required: true }],
    )).toBe(true)
  })

  it('ignores optional criteria regardless of progress status', () => {
    expect(areAllCriteriaMet(
      [{ status: 'pending' }, { status: 'not_met' }],
      [{ required: false }, { required: false }],
    )).toBe(true)
  })

  it('returns false when a required criterion is still pending', () => {
    expect(areAllCriteriaMet(
      [{ status: 'met' }, { status: 'pending' }],
      [{ required: true }, { required: true }],
    )).toBe(false)
  })

  it('aligns progress to criteria by index, not by id', () => {
    expect(areAllCriteriaMet(
      [{ status: 'pending' }, { status: 'met' }],
      [{ required: true }, { required: true }],
    )).toBe(false)
  })

  it('treats extra progress rows past the criteria list as optional', () => {
    expect(areAllCriteriaMet(
      [{ status: 'met' }, { status: 'pending' }],
      [{ required: true }],
    )).toBe(true)
  })
})

describe('calculateOverallProgress', () => {
  it('returns 0 for an empty progress list', () => {
    expect(calculateOverallProgress([])).toBe(0)
  })

  it('counts met and waived as complete and rounds the percentage', () => {
    expect(calculateOverallProgress([
      { status: 'met' },
      { status: 'waived' },
      { status: 'pending' },
    ])).toBe(67)
  })
})

describe('isEnrollmentExpired and enrollmentDaysRemaining', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-23T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('treats a past deadline as expired with 0 days remaining', () => {
    expect(isEnrollmentExpired({ deadline_at: '2026-08-22T11:59:59.000Z' })).toBe(true)
    expect(enrollmentDaysRemaining({ deadline_at: '2026-08-22T11:59:59.000Z' })).toBe(0)
  })

  it('treats a future deadline as active and ceilings remaining days', () => {
    expect(isEnrollmentExpired({ deadline_at: '2026-08-25T12:00:00.000Z' })).toBe(false)
    expect(enrollmentDaysRemaining({ deadline_at: '2026-08-25T12:00:00.000Z' })).toBe(2)
  })
})

describe('isCampaignEnrollable', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-23T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const active = {
    status: 'active' as const,
    starts_at: '2026-08-01T00:00:00.000Z',
    ends_at: '2026-09-01T00:00:00.000Z',
    enrollment_deadline: '2026-08-31T00:00:00.000Z',
  }

  it('accepts an active campaign inside its window', () => {
    expect(isCampaignEnrollable(active)).toBe(true)
  })

  it('rejects paused, future, or expired campaigns', () => {
    expect(isCampaignEnrollable({ ...active, status: 'paused' })).toBe(false)
    expect(isCampaignEnrollable({ ...active, starts_at: '2026-08-24T00:00:00.000Z' })).toBe(false)
    expect(isCampaignEnrollable({ ...active, enrollment_deadline: '2026-08-22T00:00:00.000Z' })).toBe(false)
    expect(isCampaignEnrollable({ ...active, ends_at: '2026-08-22T00:00:00.000Z' })).toBe(false)
  })
})

describe('validators', () => {
  it('accepts known campaign and enrollment enums and rejects unknown values', () => {
    expect(isValidCampaignType('win_money_back')).toBe(true)
    expect(isValidCampaignType('cash_back')).toBe(false)
    expect(isValidCampaignStatus('active')).toBe(true)
    expect(isValidCampaignStatus('all')).toBe(false)
    expect(isValidTrackingSource('custom_webhook')).toBe(true)
    expect(isValidTrackingSource('spreadsheet')).toBe(false)
    expect(isValidCriteriaType('action')).toBe(true)
    expect(isValidCriteriaType('habit')).toBe(false)
    expect(isValidEnrollmentSource('admin_manual')).toBe(true)
    expect(isValidEnrollmentSource('import')).toBe(false)
    expect(isValidEnrollmentStatus('criteria_met')).toBe(true)
    expect(isValidEnrollmentStatus('all')).toBe(false)
  })

  it('accepts kebab slugs and rejects uppercase or consecutive hyphens', () => {
    expect(validateSlug('win-your-money-back')).toBe(true)
    expect(validateSlug('Win-Your-Money')).toBe(false)
    expect(validateSlug('win--money')).toBe(false)
    expect(validateSlug('-leading')).toBe(false)
  })
})
