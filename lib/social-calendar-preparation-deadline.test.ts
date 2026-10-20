import { describe, expect, it } from 'vitest'
import { preparationAttempt, preparationDeadline } from './social-calendar-preparation-deadline'

const scheduled_for = '2026-10-20T12:00:00.000Z'

describe('calendar preparation deadline', () => {
  it('selects the candidate six days before the event by default, including the exact boundary', () => {
    const deadline = preparationDeadline({ scheduled_for })
    expect(deadline).toBe('2026-10-14T12:00:00.000Z')
    expect(Date.parse(deadline!)).toBeLessThan(Date.parse(scheduled_for))
    expect(Date.parse(deadline!)).toBe(Date.parse('2026-10-14T12:00:00.000Z'))
  })

  it('honors a valid longer lead or earlier trigger and never lets a later trigger delay preparation', () => {
    expect(preparationDeadline({ scheduled_for, metadata: { preparation_lead_days: 9 } })).toBe('2026-10-11T12:00:00.000Z')
    expect(preparationDeadline({ scheduled_for, metadata: { review_trigger_at: '2026-10-10T12:00:00Z' } })).toBe('2026-10-10T12:00:00.000Z')
    expect(preparationDeadline({ scheduled_for, metadata: { review_trigger_at: scheduled_for } })).toBe('2026-10-14T12:00:00.000Z')
    expect(preparationDeadline({ scheduled_for, metadata: { preparation_lead_days: 1 } })).toBe('2026-10-14T12:00:00.000Z')
  })

  it('does not recheck ready or unchanged blocked evidence, including at event time', () => {
    const blocked = { status: 'blocked', evidence_version: 'version-a', retry_count: 1 }
    expect(preparationAttempt({ previous: blocked, evidenceVersion: 'version-a', ready: false })).toEqual({ shouldCheck: false, retryCount: 1 })
    expect(preparationAttempt({ previous: blocked, evidenceVersion: 'version-a', ready: true })).toEqual({ shouldCheck: false, retryCount: 1 })
  })

  it('allows one deterministic recheck for a materially changed evidence version', () => {
    const prior = { status: 'blocked', evidence_version: 'version-a', retry_count: 1 }
    expect(preparationAttempt({ previous: prior, evidenceVersion: 'version-b', ready: false })).toEqual({ shouldCheck: true, retryCount: 2 })
    const recorded = { ...prior, evidence_version: 'version-b', retry_count: 2 }
    expect(preparationAttempt({ previous: recorded, evidenceVersion: 'version-b', ready: false })).toEqual({ shouldCheck: false, retryCount: 2 })
  })
})
