import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: null,
}))

import { buildStaleSweepResult, isAgentRunStale } from './agent-stale-runs'

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

  it('summarizes stale sweep coverage across all supported runtimes', () => {
    const candidates = [
      { id: 'codex-1', runtime: 'codex' },
      { id: 'n8n-1', runtime: 'n8n' },
      { id: 'hermes-1', runtime: 'hermes' },
      { id: 'opencode-1', runtime: 'opencode' },
      { id: 'manual-1', runtime: 'manual' },
    ]
    const result = buildStaleSweepResult(candidates, [
      { id: 'codex-1', runtime: 'codex' },
      { id: 'n8n-1', runtime: 'n8n' },
      { id: 'hermes-1', runtime: 'hermes' },
      { id: 'opencode-1', runtime: 'opencode' },
      { id: 'manual-1', runtime: 'manual' },
    ])

    expect(result).toEqual({
      checked: 5,
      marked: 5,
      runIds: ['codex-1', 'n8n-1', 'hermes-1', 'opencode-1', 'manual-1'],
      byRuntime: {
        codex: { checked: 1, marked: 1 },
        n8n: { checked: 1, marked: 1 },
        hermes: { checked: 1, marked: 1 },
        opencode: { checked: 1, marked: 1 },
        manual: { checked: 1, marked: 1 },
      },
    })
  })

  it('keeps runtime coverage for checked runs that were not marked stale', () => {
    const result = buildStaleSweepResult([
      { id: 'codex-1', runtime: 'codex' },
      { id: 'codex-2', runtime: 'codex' },
      { id: 'n8n-1', runtime: 'n8n' },
      { id: 'manual-1', runtime: 'manual' },
    ], [
      { id: 'codex-1', runtime: 'codex' },
    ])

    expect(result).toEqual({
      checked: 4,
      marked: 1,
      runIds: ['codex-1'],
      byRuntime: {
        codex: { checked: 2, marked: 1 },
        n8n: { checked: 1, marked: 0 },
        manual: { checked: 1, marked: 0 },
      },
    })
  })
})
