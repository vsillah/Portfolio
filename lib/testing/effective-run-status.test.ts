import { describe, expect, it } from 'vitest'
import { effectiveTestRunStatus } from './effective-run-status'

describe('effectiveTestRunStatus', () => {
  it('keeps in-flight and cancelled runs unchanged even when counters disagree', () => {
    const failedCounters = { clients_spawned: 2, clients_completed: 0, clients_failed: 2 }
    expect(effectiveTestRunStatus({ status: 'pending', ...failedCounters })).toBe('pending')
    expect(effectiveTestRunStatus({ status: 'running', ...failedCounters })).toBe('running')
    expect(effectiveTestRunStatus({
      status: 'cancelled',
      clients_spawned: 2,
      clients_completed: 2,
      clients_failed: 0,
    })).toBe('cancelled')
  })

  it('shows completed only when every spawned client succeeded', () => {
    expect(effectiveTestRunStatus({
      status: 'failed',
      clients_spawned: 2,
      clients_completed: 2,
      clients_failed: 0,
    })).toBe('completed')
    expect(effectiveTestRunStatus({
      status: 'completed',
      clients_spawned: 3,
      clients_completed: 1,
      clients_failed: 1,
    })).toBe('failed')
    expect(effectiveTestRunStatus({
      status: 'completed',
      clients_spawned: 2,
      clients_completed: 2,
      clients_failed: 1,
    })).toBe('failed')
    expect(effectiveTestRunStatus({
      status: 'completed',
      clients_spawned: 1,
      clients_completed: 2,
      clients_failed: 0,
    })).toBe('failed')
  })

  it('keeps a finished run with no spawned clients on its stored failure bit', () => {
    expect(effectiveTestRunStatus({
      status: 'failed',
      clients_spawned: 0,
      clients_completed: 0,
      clients_failed: 0,
    })).toBe('failed')
    expect(effectiveTestRunStatus({
      status: 'completed',
      clients_spawned: 0,
      clients_completed: 0,
      clients_failed: 0,
    })).toBe('completed')
  })
})
