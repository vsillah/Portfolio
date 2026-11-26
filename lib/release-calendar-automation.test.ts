import { describe, expect, it } from 'vitest'
import { projectReleaseAutomation, rankReleaseAutomation, type ReleaseAutomationRow } from './release-calendar-automation'
import { EVIDENCE_REPAIR_CANARY } from './evidence-repair-canary'

const now = new Date('2026-11-24T15:00:00.000Z')
const receipt = {
  status: 'ready', social_content_id: 'social-1', content_version: 'version-1',
  prepared_at: now.toISOString(), review_path: '/admin/social-content/social-1',
  source_lineage: 'source-v1', source_expires_at: '2026-11-24T15:00:00.001Z',
  source_freshness_status: 'fresh', evidence_version: 'source-v1',
  scheduled_for: '2026-11-30T15:00:00.000Z', trigger_at: now.toISOString(),
}

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
  it('keeps historical and live priorities while removing both exact synthetic canaries', () => {
    const rows = [row('historical'), row(EVIDENCE_REPAIR_CANARY.calendarIds[0]),
      row('live'), row(EVIDENCE_REPAIR_CANARY.calendarIds[1])]
    expect(rankReleaseAutomation(rows, now).map(item => item.row.id)).toEqual(['historical', 'live'])
  })
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
      jit_refresh_status: 'fresh', publish_preparation: receipt,
    } }), now)
    expect(ready.state).toBe('ready for human review')
    expect(ready.recoveryPath).toBe('/admin/social-content/social-1')
    expect(ready.linkLabel).toBe('Open review')
    const blocked = projectReleaseAutomation(row('blocked', { metadata: {
      publish_preparation: { status: 'blocked', blocker: 'Source expired', recovery_action: '//outside.example' },
    } }), now)
    expect(blocked.state).toBe('blocked')
    expect(blocked.blocker).toBe('Source expired')
    expect(blocked.recoveryPath).toBe('/admin/social-content/social-1?step=copy')
    expect(blocked.linkLabel).toBe('Open recovery')
    expect(projectReleaseAutomation(row('unsafe', { metadata: { external_execution_enabled: true } }), now))
      .toMatchObject({ state: 'blocked', blocker: expect.stringContaining('External execution flag') })
  })

  it('never treats ready metadata as review-ready without authorized, matching, complete receipt evidence', () => {
    for (const status of ['pending', 'rejected', 'expired']) {
      expect(projectReleaseAutomation(row(status, {
        authorization_status: status, metadata: { publish_preparation: receipt },
      }), now).state).not.toBe('ready for human review')
    }
    for (const incomplete of [
      { ...receipt, social_content_id: 'another-draft' },
      { ...receipt, content_version: '' },
      { ...receipt, prepared_at: '' },
    ]) {
      const projected = projectReleaseAutomation(row('incomplete', { metadata: { publish_preparation: incomplete } }), now)
      expect(projected.state).toBe('blocked')
      expect(projected.blocker).toContain('Preparation receipt or JIT/source freshness is incomplete')
      expect(projected.recoveryPath).toBe('/admin/social-content/social-1?step=copy')
    }
    expect(projectReleaseAutomation(row('ready-no-review-link', { metadata: {
      jit_refresh_status: 'fresh', publish_preparation: { ...receipt, review_path: null },
    } }), now).linkLabel).toBe('Open details')
    expect(projectReleaseAutomation(row('unlinked', {
      social_content_id: null, metadata: { publish_preparation: receipt },
    }), now).state).not.toBe('ready for human review')
  })

  it('ranks review decisions before blocked recovery, eligibility, preparation, and planned work', () => {
    const rows = [
      row('later', { scheduled_for: '2026-12-01T15:00:00.000Z' }),
      row('low', { metadata: { review_priority: 'low', jit_refresh_status: 'fresh' } }),
      row('blocked', { metadata: { publish_preparation: { status: 'blocked', blocker: 'Recover source' } } }),
      row('first', { metadata: { review_priority: 'high', jit_refresh_status: 'fresh' } }),
      row('preparing', { agent_work_items: { preparation_claim: { status: 'preparing', claimed_at: '2026-11-24T14:58:00.000Z' } } }),
      row('ready', { metadata: { review_priority: 'low', jit_refresh_status: 'fresh', publish_preparation: receipt } }),
    ]
    expect(rankReleaseAutomation(rows, now).map(({ row }) => row.id)).toEqual(['ready', 'blocked', 'first', 'low', 'preparing', 'later'])
    expect(rankReleaseAutomation(rows, now).map(({ row }) => row.id)).toEqual(rankReleaseAutomation(rows, now).map(({ row }) => row.id))
    const freshnessRows = [
      row('fresh'),
      row('unknown', { metadata: { review_priority: 'high' } }),
      row('stale', { metadata: { review_priority: 'high', jit_refresh_status: 'stale' } }),
    ]
    expect(rankReleaseAutomation(freshnessRows, now).map(({ row }) => row.id)).toEqual(['stale', 'unknown', 'fresh'])
    expect(projectReleaseAutomation(freshnessRows[1], now).freshness).toContain('unknown')
  })

  it('excludes finished, published, and explicitly superseded rows from preparation priorities only', () => {
    const rows = [
      row('valid-ready', { metadata: { jit_refresh_status: 'fresh', publish_preparation: receipt } }),
      row('completed', { due_status: 'completed' }),
      row('cancelled', { due_status: 'cancelled' }),
      row('published', { social_content_queue: { status: 'published' }, metadata: {} }),
      row('published-legacy', { social_content_queue: null, metadata: { social_content_lifecycle: { social_content_status: 'published' } } }),
      row('superseded-at', { metadata: { superseded_at: '2026-08-05T13:04:19.286Z' } }),
      row('superseded-packet', { metadata: { superseded_by_agentified_packet: true } }),
      row('valid-blocked', { metadata: { publish_preparation: { status: 'blocked', blocker: 'Recover source' } } }),
      row('valid-eligible'),
      row('valid-preparing', { agent_work_items: { preparation_claim: { status: 'preparing', claimed_at: '2026-11-24T14:58:00.000Z' } } }),
      row('valid-planned', { scheduled_for: '2026-12-10T15:00:00.000Z' }),
    ]
    const before = JSON.stringify(rows)

    expect(rankReleaseAutomation(rows, now).map(({ row }) => row.id)).toEqual([
      'valid-ready', 'valid-blocked', 'valid-eligible', 'valid-preparing', 'valid-planned',
    ])
    expect(rows).toHaveLength(11)
    expect(JSON.stringify(rows)).toBe(before)
  })
})
