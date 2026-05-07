import { describe, expect, it, vi } from 'vitest'
import { isLikelyTransientError, withRetry } from './with-retry'

describe('withRetry', () => {
  it('returns success on the first attempt', async () => {
    const operation = vi.fn().mockResolvedValue('ok')

    await expect(withRetry(operation, { maxRetries: 2, sleep: async () => {} })).resolves.toBe('ok')

    expect(operation).toHaveBeenCalledTimes(1)
    expect(operation).toHaveBeenCalledWith({ attempt: 0, attemptNumber: 1 })
  })

  it('returns success after retrying retryable errors', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockRejectedValueOnce(new Error('502 bad gateway'))
      .mockResolvedValueOnce('ok')
    const onRetry = vi.fn()

    await expect(withRetry(operation, {
      maxRetries: 2,
      baseDelayMs: 10,
      jitterRatio: 0,
      sleep: async () => {},
      onRetry,
    })).resolves.toBe('ok')

    expect(operation).toHaveBeenCalledTimes(3)
    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenNthCalledWith(1, expect.objectContaining({
      attempt: 0,
      attemptNumber: 1,
      nextDelayMs: 10,
    }))
    expect(onRetry).toHaveBeenNthCalledWith(2, expect.objectContaining({
      attempt: 1,
      attemptNumber: 2,
      nextDelayMs: 20,
    }))
  })

  it('gives up after max retries and calls the dead-letter hook', async () => {
    const error = new Error('503 unavailable')
    const operation = vi.fn().mockRejectedValue(error)
    const onGiveUp = vi.fn()

    await expect(withRetry(operation, {
      maxRetries: 1,
      sleep: async () => {},
      onGiveUp,
    })).rejects.toBe(error)

    expect(operation).toHaveBeenCalledTimes(2)
    expect(onGiveUp).toHaveBeenCalledWith(expect.objectContaining({
      attempt: 1,
      attemptNumber: 2,
      nextDelayMs: null,
      error,
    }))
  })

  it('does not retry non-retryable errors', async () => {
    const error = new Error('validation failed')
    const operation = vi.fn().mockRejectedValue(error)
    const onRetry = vi.fn()

    await expect(withRetry(operation, {
      maxRetries: 3,
      sleep: async () => {},
      onRetry,
    })).rejects.toBe(error)

    expect(operation).toHaveBeenCalledTimes(1)
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('allows a custom retryable error matcher', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValueOnce('ok')

    await expect(withRetry(operation, {
      maxRetries: 1,
      sleep: async () => {},
      isRetryableError: error => error instanceof Error && error.message.includes('rate limited'),
    })).resolves.toBe('ok')

    expect(operation).toHaveBeenCalledTimes(2)
  })

  it('classifies common transient network and gateway errors', () => {
    expect(isLikelyTransientError(new Error('fetch failed'))).toBe(true)
    expect(isLikelyTransientError(new Error('n8n request timed out after 30s'))).toBe(true)
    expect(isLikelyTransientError(new Error('502 bad gateway'))).toBe(true)
    expect(isLikelyTransientError(new Error('validation failed'))).toBe(false)
  })
})
