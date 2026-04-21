import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EmailTemplateKey } from '@/lib/constants/prompt-keys'

const authMocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: authMocks.getCurrentSession,
}))

import { useOutreachGeneration } from './useOutreachGeneration'

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function createCallbacks() {
  return {
    onToast: vi.fn(),
    onFallbackAvailable: vi.fn(),
    onSettled: vi.fn(),
    onFallbackCleared: vi.fn(),
  }
}

describe('useOutreachGeneration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    authMocks.getCurrentSession.mockResolvedValue({ access_token: 'token-123' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('shows running state immediately while generate request is in flight', async () => {
    const callbacks = createCallbacks()
    let resolveFetch: ((value: Response) => void) | null = null
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve
          }),
      ),
    )

    const { result } = renderHook(() =>
      useOutreachGeneration({
        leadId: 42,
        leadName: 'Acme',
        messagesCount: 0,
        ...callbacks,
      }),
    )

    let startPromise: Promise<void> | null = null
    await act(async () => {
      startPromise = result.current.start('email_follow_up' as EmailTemplateKey)
      await Promise.resolve()
    })

    expect(result.current.state).toBe('running')
    expect(result.current.phaseLabel).toBe('Starting…')

    await act(async () => {
      resolveFetch?.(jsonResponse({ triggered: false }))
      await startPromise
    })

    expect(result.current.state).toBe('failed')
    expect(callbacks.onFallbackAvailable).toHaveBeenCalledTimes(1)
  })

  it('settles to success immediately when queueCountImmediate is already positive', async () => {
    const callbacks = createCallbacks()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ triggered: true, queueCountImmediate: 1 })),
    )

    const { result } = renderHook(() =>
      useOutreachGeneration({
        leadId: 42,
        leadName: 'Acme',
        messagesCount: 0,
        ...callbacks,
      }),
    )

    await act(async () => {
      await result.current.start('email_follow_up' as EmailTemplateKey)
    })

    expect(result.current.state).toBe('succeeded')
    expect(callbacks.onFallbackCleared).toHaveBeenCalledTimes(1)
    expect(callbacks.onSettled).toHaveBeenCalledTimes(1)
    expect(callbacks.onFallbackAvailable).not.toHaveBeenCalled()
    expect(callbacks.onToast).toHaveBeenCalledWith('Draft is ready for Acme — open Message Queue')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })

    expect(result.current.state).toBe('idle')
  })

  it('switches to success when messagesCount increases during extended draft wait', async () => {
    const callbacks = createCallbacks()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ triggered: true, queueCountImmediate: 0 })),
    )

    const { result, rerender } = renderHook(
      ({ messagesCount }: { messagesCount: number }) =>
        useOutreachGeneration({
          leadId: 42,
          leadName: 'Acme',
          messagesCount,
          ...callbacks,
        }),
      { initialProps: { messagesCount: 0 } },
    )

    await act(async () => {
      await result.current.start('email_follow_up' as EmailTemplateKey)
    })

    expect(result.current.state).toBe('running')
    expect(callbacks.onToast).toHaveBeenCalledWith(
      'n8n accepted this job — waiting for a draft to appear…',
    )

    await act(async () => {
      rerender({ messagesCount: 1 })
      await Promise.resolve()
    })

    expect(result.current.state).toBe('succeeded')
    expect(callbacks.onFallbackAvailable).not.toHaveBeenCalled()
    expect(callbacks.onSettled).toHaveBeenCalledTimes(1)
  })

  it('marks generation as failed and exposes fallback after extended wait timeout', async () => {
    const callbacks = createCallbacks()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ triggered: true, queueCountImmediate: 0 })),
    )

    const { result } = renderHook(() =>
      useOutreachGeneration({
        leadId: 42,
        leadName: 'Acme',
        messagesCount: 0,
        ...callbacks,
      }),
    )

    await act(async () => {
      await result.current.start('email_follow_up' as EmailTemplateKey)
    })

    expect(result.current.state).toBe('running')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(75_000)
    })

    expect(result.current.state).toBe('failed')
    expect(callbacks.onFallbackAvailable).toHaveBeenCalledTimes(1)
    expect(callbacks.onToast).toHaveBeenCalledWith(
      'No draft appeared after waiting. Use Draft in app or check n8n for Acme.',
    )
    expect(callbacks.onSettled).toHaveBeenCalled()
  })
})
