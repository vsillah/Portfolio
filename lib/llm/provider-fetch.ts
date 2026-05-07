import type { LlmProvider } from '@/lib/constants/llm-models'
import { withRetry } from '@/lib/llm/with-retry'

function readNonNegativeIntegerEnv(name: string, fallback: number): number {
  const value = Number(process.env[name])
  if (!Number.isFinite(value) || value < 0) {
    return fallback
  }
  return Math.floor(value)
}

class RetryableProviderStatusError extends Error {
  constructor(
    readonly provider: LlmProvider,
    readonly status: number,
    readonly responseText: string,
  ) {
    super(`${provider} request failed with retryable status ${status}`)
    this.name = 'RetryableProviderStatusError'
  }
}

function isRetryableProviderStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504
}

export async function fetchProviderWithRetry(
  provider: LlmProvider,
  url: string,
  init: RequestInit,
): Promise<Response> {
  const maxRetries = readNonNegativeIntegerEnv('LLM_MAX_RETRIES', 1)
  const retryDelayMs = readNonNegativeIntegerEnv('LLM_RETRY_DELAY_MS', 500)

  return withRetry(
    async () => {
      const response = await fetch(url, init)
      if (isRetryableProviderStatus(response.status)) {
        const responseText = await response.text().catch(() => '')
        throw new RetryableProviderStatusError(provider, response.status, responseText.slice(0, 400))
      }
      return response
    },
    {
      label: `${provider} provider call`,
      maxRetries,
      baseDelayMs: retryDelayMs,
      maxDelayMs: Math.max(retryDelayMs, 5_000),
      jitterRatio: process.env.NODE_ENV === 'test' ? 0 : 0.1,
      onRetry: ({ attemptNumber, nextDelayMs, error }) => {
        console.warn(
          `[provider-fetch] ${provider} transient failure on attempt ${attemptNumber}; retrying in ${nextDelayMs ?? 0}ms`,
          error instanceof Error ? error.message : error,
        )
      },
      onGiveUp: ({ attemptNumber, error }) => {
        console.warn(
          `[provider-fetch] ${provider} failed after attempt ${attemptNumber}`,
          error instanceof Error ? error.message : error,
        )
      },
    },
  )
}
