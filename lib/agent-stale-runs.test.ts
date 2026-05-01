import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: null,
}))

import { isAgentRunStale } from './agent-stale-runs'

const now = new Date('2026-04-30T12:00:00.000Z')

describe('isAgentRunStale', () => {
  it('marks queued and running runs stale after the default threshold', () => {
    expect(isAgentRunStale({
      status: 'running',
      started_at: '2026-04-30T11:20:00.000Z',
      stale_after: null,
    }, now)).toBe(true)

    expect(isAgentRunStale({
      status: 'queued',
      started_at: '2026-04-30T11:20:00.000Z',
      stale_after: null,
    }, now)).toBe(true)
  })

  it('honors explicit stale_after timestamps', () => {
    expect(isAgentRunStale({
      status: 'running',
      started_at: '2026-04-30T11:59:00.000Z',
      stale_after: '2026-04-30T11:59:30.000Z',
    }, now)).toBe(true)
  })

  it('does not mark approval waits or terminal runs stale', () => {
    expect(isAgentRunStale({
      status: 'waiting_for_approval',
      started_at: '2026-04-30T10:00:00.000Z',
      stale_after: '2026-04-30T11:00:00.000Z',
    }, now)).toBe(false)

    expect(isAgentRunStale({
      status: 'failed',
      started_at: '2026-04-30T10:00:00.000Z',
      stale_after: null,
    }, now)).toBe(false)
  })
})
