import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useOutreachGeneration } from './useOutreachGeneration'

const mockGetCurrentSession = vi.fn()

vi.mock('@/lib/auth', () => ({
  getCurrentSession: (...args: unknown[]) => mockGetCurrentSession(...args),
}))

describe('useOutreachGeneration', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-22T10:00:00.000Z'))
    mockGetCurrentSession.mockResolvedValue({
      access_token: 'test-token',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    global.fetch = originalFetch
    mockGetCurrentSession.mockReset()
  })

  it('settles as succeeded immediately when API reports queueCountImmediate > 0', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ triggered: true, queueCountImmediate: 1 }),
    } as Response)

    const onToast = vi.fn()
    const onSettled = vi.fn()
    const onFallbackCleared = vi.fn()

    const { result } = renderHook(() =>
      useOutreachGeneration({
        leadId: 42,
        leadName: 'ACME Lead',
        messagesCount: 0,
        onToast,
        onSettled,
        onFallbackCleared,
      }),
    )

    await act(async () => {
      await result.current.start()
    })

    expect(result.current.state).toBe('succeeded')
    expect(onFallbackCleared).toHaveBeenCalledTimes(1)
    expect(onToast).toHaveBeenCalledWith(
      'Draft is ready for ACME Lead — open Message Queue',
    )
    expect(onSettled).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_001)
    })
    expect(result.current.state).toBe('idle')
  })

  it('times out into fallback when queue remains empty during extended wait', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ triggered: true, queueCountImmediate: 0 }),
    } as Response)

    const onToast = vi.fn()
    const onSettled = vi.fn()
    const onFallbackAvailable = vi.fn()

    const { result } = renderHook(() =>
      useOutreachGeneration({
        leadId: 7,
        leadName: 'No Draft Lead',
        messagesCount: 0,
        onToast,
        onSettled,
        onFallbackAvailable,
      }),
    )

    await act(async () => {
      await result.current.start()
    })

    expect(result.current.state).toBe('running')
    expect(result.current.phaseLabel).toBe('Queuing…')
    expect(onToast).toHaveBeenCalledWith(
      'n8n accepted this job — waiting for a draft to appear…',
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(75_000)
    })

    expect(result.current.state).toBe('failed')

    expect(onFallbackAvailable).toHaveBeenCalledTimes(1)
    expect(onToast).toHaveBeenCalledWith(
      'No draft appeared after waiting. Use Draft in app or check n8n for No Draft Lead.',
    )
    expect(onSettled).toHaveBeenCalled()
  })

  it('settles early when messagesCount increases during extended wait', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ triggered: true, queueCountImmediate: 0 }),
    } as Response)

    const onToast = vi.fn()
    const onSettled = vi.fn()

    const { result, rerender } = renderHook(
      ({ messagesCount }: { messagesCount: number }) =>
        useOutreachGeneration({
          leadId: 9,
          leadName: 'Appearing Draft Lead',
          messagesCount,
          onToast,
          onSettled,
        }),
      { initialProps: { messagesCount: 0 } },
    )

    await act(async () => {
      await result.current.start()
    })

    await act(async () => {
      rerender({ messagesCount: 1 })
    })

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.state).toBe('succeeded')

    expect(onToast).toHaveBeenCalledWith(
      'Draft is ready for Appearing Draft Lead — open Message Queue',
    )
    expect(onSettled).toHaveBeenCalledTimes(1)
  })
})
