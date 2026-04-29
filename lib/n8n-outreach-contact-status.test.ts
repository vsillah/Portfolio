import { describe, expect, it } from 'vitest'
import { partitionN8nOutreachReconcile } from './n8n-outreach-contact-status'

const NOW = Date.parse('2026-04-29T10:00:00.000Z')

function minutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60 * 1000).toISOString()
}

describe('partitionN8nOutreachReconcile', () => {
  it('ignores contacts that are not pending or have no valid trigger timestamp', () => {
    const result = partitionN8nOutreachReconcile(
      [
        {
          id: 1,
          last_n8n_outreach_status: 'success',
          last_n8n_outreach_triggered_at: minutesAgo(30),
        },
        {
          id: 2,
          last_n8n_outreach_status: 'pending',
          last_n8n_outreach_triggered_at: null,
        },
        {
          id: 3,
          last_n8n_outreach_status: 'pending',
          last_n8n_outreach_triggered_at: 'not-a-date',
        },
      ],
      {
        1: [{ channel: 'email', created_at: minutesAgo(1) }],
        2: [{ channel: 'email', created_at: minutesAgo(1) }],
        3: [{ channel: 'email', created_at: minutesAgo(1) }],
      },
      NOW,
    )

    expect(result).toEqual({ toSuccess: [], toFail: [] })
  })

  it('marks pending contacts successful only when a qualifying email exists after the trigger skew', () => {
    const result = partitionN8nOutreachReconcile(
      [
        {
          id: 10,
          last_n8n_outreach_status: 'pending',
          last_n8n_outreach_triggered_at: minutesAgo(5),
        },
        {
          id: 11,
          last_n8n_outreach_status: 'pending',
          last_n8n_outreach_triggered_at: minutesAgo(5),
        },
        {
          id: 12,
          last_n8n_outreach_status: 'pending',
          last_n8n_outreach_triggered_at: minutesAgo(5),
        },
      ],
      {
        10: [{ channel: 'email', created_at: minutesAgo(6) }],
        11: [{ channel: 'email', created_at: minutesAgo(8) }],
        12: [{ channel: 'linkedin', created_at: minutesAgo(4) }],
      },
      NOW,
    )

    expect(result).toEqual({ toSuccess: [10], toFail: [] })
  })

  it('keeps recent pending contacts pending when no qualifying email exists', () => {
    const result = partitionN8nOutreachReconcile(
      [
        {
          id: 20,
          last_n8n_outreach_status: 'pending',
          last_n8n_outreach_triggered_at: minutesAgo(10),
        },
      ],
      {},
      NOW,
    )

    expect(result).toEqual({ toSuccess: [], toFail: [] })
  })

  it('marks stale pending contacts failed when no success row arrived in time', () => {
    const result = partitionN8nOutreachReconcile(
      [
        {
          id: 30,
          last_n8n_outreach_status: 'pending',
          last_n8n_outreach_triggered_at: minutesAgo(21),
        },
      ],
      {
        30: [{ channel: 'email', created_at: minutesAgo(30) }],
      },
      NOW,
    )

    expect(result).toEqual({ toSuccess: [], toFail: [30] })
  })
})
