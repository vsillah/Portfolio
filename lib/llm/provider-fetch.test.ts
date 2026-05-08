import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchProviderWithRetry } from './provider-fetch'

const ORIGINAL_ENV = { ...process.env }

function mockProviderResponse(status: number, body = ''): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

describe('fetchProviderWithRetry', () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      LLM_MAX_RETRIES: '1',
      LLM_RETRY_DELAY_MS: '0',
    }
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('retries retryable provider statuses before returning the successful response', async () => {
    const retryableResponse = mockProviderResponse(502, 'bad gateway')
    const successResponse = mockProviderResponse(200, '{"ok":true}')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(retryableResponse)
      .mockResolvedValueOnce(successResponse)
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchProviderWithRetry('openai', 'https://provider.test', {
      method: 'POST',
    })).resolves.toBe(successResponse)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(retryableResponse.text).toHaveBeenCalledTimes(1)
  })

  it('does not retry non-retryable provider statuses', async () => {
    const unauthorizedResponse = mockProviderResponse(401, 'unauthorized')
    const fetchMock = vi.fn().mockResolvedValue(unauthorizedResponse)
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchProviderWithRetry('anthropic', 'https://provider.test', {
      method: 'POST',
    })).resolves.toBe(unauthorizedResponse)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(unauthorizedResponse.text).not.toHaveBeenCalled()
  })

  it('honors the configured retry budget', async () => {
    process.env.LLM_MAX_RETRIES = '2'
    const exhaustedResponse = mockProviderResponse(429, 'rate limited')
    const fetchMock = vi.fn().mockResolvedValue(exhaustedResponse)
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchProviderWithRetry('openai', 'https://provider.test', {
      method: 'POST',
    })).rejects.toThrowError('openai request failed with retryable status 429')

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(exhaustedResponse.text).toHaveBeenCalledTimes(3)
  })

  it('falls back to the default retry budget when retry env is invalid', async () => {
    process.env.LLM_MAX_RETRIES = 'not-a-number'
    const retryableResponse = mockProviderResponse(504, 'gateway timeout')
    const successResponse = mockProviderResponse(200, '{"ok":true}')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(retryableResponse)
      .mockResolvedValueOnce(successResponse)
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchProviderWithRetry('anthropic', 'https://provider.test', {
      method: 'POST',
    })).resolves.toBe(successResponse)

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
