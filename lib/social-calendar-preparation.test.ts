import { describe, expect, it } from 'vitest'
import { projectSocialCalendarPreparation } from './social-calendar-preparation'

const now = new Date('2026-11-24T15:00:00.000Z')
const socialContentId = 'f966123f-05eb-48ec-a7c2-970afce642ef'
const scheduledFor = '2026-11-30T15:00:00.000Z'
const triggerAt = now.toISOString()

function calendar(patch: Record<string, unknown> = {}, receiptPatch: Record<string, unknown> = {}) {
  return {
    id: '669f6c22-d373-4423-bf7c-77661c484302',
    social_content_id: socialContentId,
    authorization_status: 'authorized', due_status: 'due_soon', scheduled_for: scheduledFor,
    ...patch,
    metadata: {
      publish_preparation: {
        status: 'ready', prepared_at: now.toISOString(), content_version: 'sha256:e6fc9ae4',
        social_content_id: socialContentId, source_lineage: 'source-v1',
        source_expires_at: '2026-11-24T15:00:00.001Z', source_freshness_status: 'fresh', evidence_version: 'source-v1',
        scheduled_for: scheduledFor, trigger_at: triggerAt,
        reused_existing_approved_packet: true,
        ...receiptPatch,
      },
    },
  }
}

describe('projectSocialCalendarPreparation', () => {
  it('projects only an authorized exact version, trigger, and fresh source receipt as ready', () => {
    expect(projectSocialCalendarPreparation(calendar(), socialContentId, now)).toEqual(expect.objectContaining({
      state: 'ready', authorization_status: 'authorized', content_version: 'sha256:e6fc9ae4',
      source_freshness_status: 'fresh', reused_existing_approved_packet: true,
    }))
  })

  it('fails closed at the exact source expiry boundary and when freshness is missing', () => {
    for (const source_expires_at of ['2026-11-24T15:00:00.000Z', '2026-11-24T14:59:59.999Z', '', 'invalid']) {
      const projected = projectSocialCalendarPreparation(calendar({}, { source_expires_at }), socialContentId, now)
      expect(projected?.state).toBe('pending')
      expect(projected?.source_freshness_status).toBe(source_expires_at && source_expires_at !== 'invalid' ? 'expired' : 'unknown')
    }
    expect(projectSocialCalendarPreparation(calendar({}, { source_freshness_status: 'stale' }), socialContentId, now))
      .toEqual(expect.objectContaining({ state: 'pending', source_freshness_status: 'stale' }))
    expect(projectSocialCalendarPreparation(calendar({}, { source_freshness_status: '' }), socialContentId, now))
      .toEqual(expect.objectContaining({ state: 'pending', source_freshness_status: 'unknown' }))
  })

  it('rejects stale versions and mismatched exact bindings', () => {
    for (const receipt of [
      { social_content_id: 'another-draft' }, { content_version: '' }, { prepared_at: '' },
      { source_lineage: '' }, { trigger_at: '2026-11-24T15:00:01.000Z' },
      { evidence_version: 'source-v0' }, { source_freshness_status: 'stale' },
      { prepared_at: '2026-11-24T15:00:00.001Z' },
      { scheduled_for: '2026-12-01T15:00:00.000Z' },
    ]) {
      expect(projectSocialCalendarPreparation(calendar({}, receipt), socialContentId, now)?.state).toBe('pending')
    }
    expect(projectSocialCalendarPreparation(calendar({ social_content_id: 'another-draft' }), socialContentId, now)).toBeNull()
  })

  it('never grants readiness for pending, rejected, expired, or cancelled authorization gates', () => {
    for (const authorization_status of ['pending', 'rejected', 'expired']) {
      expect(projectSocialCalendarPreparation(calendar({ authorization_status }), socialContentId, now)?.state)
        .toBe(authorization_status === 'pending' ? 'pending' : 'blocked')
    }
    expect(projectSocialCalendarPreparation(calendar({ due_status: 'cancelled' }), socialContentId, now)?.state).toBe('blocked')
  })
})
