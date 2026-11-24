import { describe, expect, it } from 'vitest'
import { projectReleaseAutomation, rankReleaseAutomation, type ReleaseAutomationRow } from './release-calendar-automation'

const now = new Date('2026-11-24T15:00:00.000Z')

function row(id: string, patch: Partial<ReleaseAutomationRow> = {}): ReleaseAutomationRow {
  return {
    id,
    channel: 'linkedin',
    campaign_phase: 'teach',
    scheduled_for: '2026-11-30T15:00:00.000Z',
    authorization_status: 'authorized',
    due_status: 'planned',
    campaign_id: 'campaign-1',
    social_content_id: 'social-1',
    social_content_queue: { status: 'draft' },
    metadata: { review_priority: 'high', jit_refresh_status: 'fresh' },
    ...patch,
  }
}

describe('release calendar automation projection', () => {
  it('uses the existing preparation deadline and only marks an authorized linked draft eligible', () => {
    const eligible = projectReleaseAutomation(row('eligible'), now)
    expect(eligible.trigger).toBe('2026-11-24T15:00:00.000Z')
    expect(eligible.state).toBe('eligible')
    expect(projectReleaseAutomation(row('pending', { authorization_status: 'pending' }), now).state).toBe('planned')
    expect(projectReleaseAutomation(row('future', { scheduled_for: '2026-12-10T15:00:00.000Z' }), now).state).toBe('planned')
  })

  it('projects a live claim, a persisted receipt, and a blocker without changing them', () => {
    const preparing = projectReleaseAutomation(row('claim', {
      agent_work_items: { preparation_claim: {
        status: 'preparing', claimed_at: '2026-11-24T14:58:00.000Z',
      } },
    }), now)
    expect(preparing.state).toBe('preparing')
    expect(preparing.receipt).toBe('2026-11-24T14:58:00.000Z')
    const ready = projectReleaseAutomation(row('ready', { metadata: {
      publish_preparation: { status: 'ready', content_version: 'version-1', review_path: '/admin/social-content/social-1' },
    } }), now)
    expect(ready.state).toBe('ready for human review')
    expect(ready.recoveryPath).toBe('/admin/social-content/social-1')
    const blocked = projectReleaseAutomation(row('blocked', { metadata: {
      publish_preparation: { status: 'blocked', blocker: 'Source expired', recovery_action: '//outside.example' },
    } }), now)
    expect(blocked.state).toBe('blocked')
    expect(blocked.blocker).toBe('Source expired')
    expect(blocked.recoveryPath).toBe('/admin/social-content/social-1?step=copy')
    expect(projectReleaseAutomation(row('unsafe', { metadata: { external_execution_enabled: true } }), now))
      .toMatchObject({ state: 'blocked', blocker: expect.stringContaining('External execution flag') })
  })

  it('ranks blocker recovery, calendar priority, freshness, trigger, release, and phase deterministically', () => {
    const rows = [
      row('later', { scheduled_for: '2026-12-01T15:00:00.000Z' }),
      row('low', { metadata: { review_priority: 'low', jit_refresh_status: 'fresh' } }),
      row('blocked', { metadata: { publish_preparation: { status: 'blocked', blocker: 'Recover source' } } }),
      row('first', { metadata: { review_priority: 'high', jit_refresh_status: 'fresh' } }),
    ]
    expect(rankReleaseAutomation(rows, now).map(({ row }) => row.id)).toEqual(['blocked', 'first', 'low', 'later'])
    expect(rankReleaseAutomation(rows, now).map(({ row }) => row.id)).toEqual(rankReleaseAutomation(rows, now).map(({ row }) => row.id))
    const freshnessRows = [
      row('fresh'),
      row('unknown', { metadata: { review_priority: 'high' } }),
      row('stale', { metadata: { review_priority: 'high', jit_refresh_status: 'stale' } }),
    ]
    expect(rankReleaseAutomation(freshnessRows, now).map(({ row }) => row.id)).toEqual(['stale', 'unknown', 'fresh'])
    expect(projectReleaseAutomation(freshnessRows[1], now).freshness).toContain('unknown')
  })
})
