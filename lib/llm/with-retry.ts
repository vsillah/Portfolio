export interface RetryAttemptContext {
  /** Zero-based failed attempt index. */
  attempt: number
  /** One-based attempt number for logs and traces. */
  attemptNumber: number
  maxRetries: number
  error: unknown
}

export interface RetryContext extends RetryAttemptContext {
  nextDelayMs: number | null
}

export interface RetryOperationContext {
  /** Zero-based operation attempt index. */
  attempt: number
  /** One-based operation attempt number. */
  attemptNumber: number
}

export interface WithRetryOptions {
  label?: string
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  jitterRatio?: number
  random?: () => number
  sleep?: (delayMs: number) => Promise<void>
  isRetryableError?: (error: unknown, context: RetryAttemptContext) => boolean
  onRetry?: (context: RetryContext) => void | Promise<void>
  onGiveUp?: (context: RetryContext) => void | Promise<void>
}

const DEFAULT_MAX_RETRIES = 0
const DEFAULT_BASE_DELAY_MS = 250
const DEFAULT_MAX_DELAY_MS = 5_000
const DEFAULT_JITTER_RATIO = 0.2

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, delayMs))
}

function normalizeNonNegativeInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return fallback
  }
  return Math.floor(value)
}

function computeDelayMs(params: {
  attempt: number
  baseDelayMs: number
  maxDelayMs: number
  jitterRatio: number
  random: () => number
}): number {
  const exponentialDelay = params.baseDelayMs * (2 ** params.attempt)
  const cappedDelay = Math.min(exponentialDelay, params.maxDelayMs)
  const safeJitterRatio = Math.max(0, params.jitterRatio)

  if (safeJitterRatio === 0 || cappedDelay === 0) {
    return cappedDelay
  }

  const jitterWindow = cappedDelay * safeJitterRatio
  const jitter = (params.random() * 2 - 1) * jitterWindow
  return Math.max(0, Math.round(cappedDelay + jitter))
}

export function isLikelyTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return (
    message.includes('timed out') ||
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504')
  )
}

export async function withRetry<T>(
  operation: (context: RetryOperationContext) => Promise<T>,
  options: WithRetryOptions = {}
): Promise<T> {
  const maxRetries = normalizeNonNegativeInteger(options.maxRetries, DEFAULT_MAX_RETRIES)
  const baseDelayMs = normalizeNonNegativeInteger(options.baseDelayMs, DEFAULT_BASE_DELAY_MS)
  const maxDelayMs = normalizeNonNegativeInteger(options.maxDelayMs, DEFAULT_MAX_DELAY_MS)
  const jitterRatio = typeof options.jitterRatio === 'number' && Number.isFinite(options.jitterRatio)
    ? Math.max(0, options.jitterRatio)
    : DEFAULT_JITTER_RATIO
  const random = options.random ?? Math.random
  const sleep = options.sleep ?? defaultSleep
  const isRetryableError = options.isRetryableError ?? isLikelyTransientError

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await operation({ attempt, attemptNumber: attempt + 1 })
    } catch (error) {
      const attemptContext: RetryAttemptContext = {
        attempt,
        attemptNumber: attempt + 1,
        maxRetries,
        error,
      }
      const shouldRetry = attempt < maxRetries && isRetryableError(error, attemptContext)
      const nextDelayMs = shouldRetry
        ? computeDelayMs({ attempt, baseDelayMs, maxDelayMs, jitterRatio, random })
        : null
      const retryContext: RetryContext = {
        ...attemptContext,
        nextDelayMs,
      }

      if (!shouldRetry) {
        await options.onGiveUp?.(retryContext)
        throw error
      }

      await options.onRetry?.(retryContext)
      if (nextDelayMs && nextDelayMs > 0) {
        await sleep(nextDelayMs)
      }
    }
  }

  throw new Error(`Retry loop exited unexpectedly${options.label ? ` for ${options.label}` : ''}`)
}
