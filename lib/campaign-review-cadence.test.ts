import { describe, expect, it } from 'vitest'
import { DEFAULT_REVIEW_CADENCE, nextReviewWindow, reviewCadence, reviewWindows } from './campaign-review-cadence'
describe('internal campaign review cadence', () => {
  it('uses defaults and bounded campaign overrides', () => {
    expect(reviewCadence({ primary_limit: 4 }).target_ready).toBe(10)
    expect(reviewCadence({ primary_limit: 4 }).primary_limit).toBe(4)
    for (const input of [{ target_ready: 0 }, { horizon_days: 500 }, { timezone: 'invalid' }, { review_time: '25:00' }]) expect(() => reviewCadence(input)).toThrow()
  })
  it('keeps 8 AM New York across fall DST and skips Saturday', () => {
    const windows = reviewWindows(new Date('2026-10-30T10:00:00Z'), DEFAULT_REVIEW_CADENCE)
    expect(windows[0]).toMatchObject({ at: '2026-10-30T12:00:00.000Z', kind: 'primary', limit: 5 })
    expect(windows[1]).toMatchObject({ at: '2026-11-01T22:00:00.000Z', kind: 'refresh', limit: 10 })
    expect(windows[2].at).toBe('2026-11-02T13:00:00.000Z')
    expect(windows[3]).toMatchObject({ kind: 'revision', limit: 3 })
  })
  it('keeps 8 AM across spring DST and schedules next review after the window', () => {
    const windows = reviewWindows(new Date('2026-03-06T10:00:00Z'), DEFAULT_REVIEW_CADENCE)
    expect(windows[0].at).toBe('2026-03-06T13:00:00.000Z')
    expect(windows[2].at).toBe('2026-03-09T12:00:00.000Z')
    expect(nextReviewWindow(new Date('2026-10-06T13:00:00Z'), DEFAULT_REVIEW_CADENCE).key).toBe('2026-10-07:primary')
  })
})
