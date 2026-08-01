import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  areAllCriteriaMet,
  calculateDeadline,
  calculateOverallProgress,
  enrollmentDaysRemaining,
  isCampaignEnrollable,
  isEnrollmentExpired,
  isValidCampaignStatus,
  isValidCampaignType,
  isValidEnrollmentStatus,
  validateSlug,
} from '@/lib/campaigns'

describe('campaign enrollment helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('areAllCriteriaMet', () => {
    it('returns true when every required criterion is met or waived', () => {
      expect(
        areAllCriteriaMet(
          [{ status: 'met' }, { status: 'waived' }, { status: 'pending' }],
          [{ required: true }, { required: true }, { required: false }],
        ),
      ).toBe(true)
    })

    it('returns false when a required criterion is still pending', () => {
      expect(
        areAllCriteriaMet(
          [{ status: 'met' }, { status: 'pending' }],
          [{ required: true }, { required: true }],
        ),
      ).toBe(false)
    })

    it('ignores optional criteria even when not_met', () => {
      expect(
        areAllCriteriaMet(
          [{ status: 'met' }, { status: 'not_met' }],
          [{ required: true }, { required: false }],
        ),
      ).toBe(true)
    })

    it('treats missing criteria index as non-required (safe default)', () => {
      expect(areAllCriteriaMet([{ status: 'pending' }], [])).toBe(true)
    })
  })

  describe('calculateOverallProgress', () => {
    it('returns 0 for an empty progress list', () => {
      expect(calculateOverallProgress([])).toBe(0)
    })

    it('counts met and waived as completed', () => {
      expect(
        calculateOverallProgress([
          { status: 'met' },
          { status: 'waived' },
          { status: 'pending' },
          { status: 'not_met' },
        ]),
      ).toBe(50)
    })
  })

  describe('calculateDeadline', () => {
    it('adds completion window days to the enrollment date', () => {
      // Use local-calendar components so setDate math is timezone-stable.
      const enrolledAt = new Date(2026, 5, 15, 12, 0, 0)
      const deadline = calculateDeadline(enrolledAt, 30)
      expect(deadline.getFullYear()).toBe(2026)
      expect(deadline.getMonth()).toBe(6) // July
      expect(deadline.getDate()).toBe(15)
    })
  })

  describe('isEnrollmentExpired / enrollmentDaysRemaining', () => {
    it('marks past deadlines as expired', () => {
      expect(isEnrollmentExpired({ deadline_at: '2026-06-14T23:59:59.000Z' })).toBe(true)
      expect(isEnrollmentExpired({ deadline_at: '2026-06-16T00:00:00.000Z' })).toBe(false)
    })

    it('clamps remaining days at zero after expiry', () => {
      expect(enrollmentDaysRemaining({ deadline_at: '2026-06-10T00:00:00.000Z' })).toBe(0)
      expect(enrollmentDaysRemaining({ deadline_at: '2026-06-18T12:00:00.000Z' })).toBe(3)
    })
  })

  describe('isCampaignEnrollable', () => {
    it('requires active status and an open enrollment window', () => {
      expect(
        isCampaignEnrollable({
          status: 'paused',
          starts_at: null,
          ends_at: null,
          enrollment_deadline: null,
        }),
      ).toBe(false)

      expect(
        isCampaignEnrollable({
          status: 'active',
          starts_at: '2026-06-01T00:00:00.000Z',
          ends_at: '2026-07-01T00:00:00.000Z',
          enrollment_deadline: '2026-06-20T00:00:00.000Z',
        }),
      ).toBe(true)
    })

    it('rejects campaigns that have not started or whose enrollment deadline passed', () => {
      expect(
        isCampaignEnrollable({
          status: 'active',
          starts_at: '2026-06-20T00:00:00.000Z',
          ends_at: null,
          enrollment_deadline: null,
        }),
      ).toBe(false)

      expect(
        isCampaignEnrollable({
          status: 'active',
          starts_at: null,
          ends_at: null,
          enrollment_deadline: '2026-06-01T00:00:00.000Z',
        }),
      ).toBe(false)
    })
  })

  describe('validators', () => {
    it('accepts known campaign type and enrollment status values', () => {
      expect(isValidCampaignType('win_money_back')).toBe(true)
      expect(isValidCampaignType('mystery')).toBe(false)
      expect(isValidCampaignStatus('active')).toBe(true)
      expect(isValidEnrollmentStatus('criteria_met')).toBe(true)
      expect(isValidEnrollmentStatus('bogus')).toBe(false)
    })

    it('validates kebab-case campaign slugs', () => {
      expect(validateSlug('spring-attraction')).toBe(true)
      expect(validateSlug('Spring Attraction')).toBe(false)
      expect(validateSlug('-leading')).toBe(false)
    })
  })
})
