import { describe, expect, it } from 'vitest'
import { STALE_VEP_PENDING_MS, partitionVepReconcile } from './vep-contact-status'

const NOW = Date.parse('2026-04-29T10:00:00.000Z')

function msAgo(ms: number): string {
  return new Date(NOW - ms).toISOString()
}

describe('partitionVepReconcile', () => {
  it('ignores empty input', () => {
    expect(partitionVepReconcile([], NOW)).toEqual({ toFail: [] })
  })

  it('ignores contacts that are not pending or have no valid trigger timestamp', () => {
    const result = partitionVepReconcile(
      [
        {
          id: 1,
          last_vep_status: 'success',
          last_vep_triggered_at: msAgo(STALE_VEP_PENDING_MS + 1),
        },
        {
          id: 2,
          last_vep_status: 'failed',
          last_vep_triggered_at: msAgo(STALE_VEP_PENDING_MS + 1),
        },
        {
          id: 3,
          last_vep_status: 'pending',
          last_vep_triggered_at: null,
        },
        {
          id: 4,
          last_vep_status: 'pending',
          last_vep_triggered_at: 'not-a-date',
        },
      ],
      NOW,
    )

    expect(result).toEqual({ toFail: [] })
  })

  it('keeps pending contacts open until they are older than the stale threshold', () => {
    const result = partitionVepReconcile(
      [
        {
          id: 10,
          last_vep_status: 'pending',
          last_vep_triggered_at: msAgo(STALE_VEP_PENDING_MS - 1),
        },
        {
          id: 11,
          last_vep_status: 'pending',
          last_vep_triggered_at: msAgo(STALE_VEP_PENDING_MS),
        },
      ],
      NOW,
    )

    expect(result).toEqual({ toFail: [] })
  })

  it('marks only stale pending contacts failed and preserves input order', () => {
    const result = partitionVepReconcile(
      [
        {
          id: 20,
          last_vep_status: 'pending',
          last_vep_triggered_at: msAgo(STALE_VEP_PENDING_MS + 1),
        },
        {
          id: 21,
          last_vep_status: 'pending',
          last_vep_triggered_at: msAgo(30 * 1000),
        },
        {
          id: 22,
          last_vep_status: 'pending',
          last_vep_triggered_at: msAgo(STALE_VEP_PENDING_MS + 60 * 1000),
        },
      ],
      NOW,
    )

    expect(result).toEqual({ toFail: [20, 22] })
  })
})
