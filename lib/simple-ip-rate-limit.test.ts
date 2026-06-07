import type { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadRateLimitModule() {
  vi.resetModules()
  return import('./simple-ip-rate-limit')
}

function mockRequest(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers) } as NextRequest
}

describe('lib/simple-ip-rate-limit', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('blocks the sixth hit in the default 15 minute bucket window', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-04T10:00:00.000Z'))
    const { isIpRateLimited } = await loadRateLimitModule()

    for (let i = 0; i < 5; i++) {
      expect(isIpRateLimited('scorecard_update', '203.0.113.10')).toBe(false)
    }

    expect(isIpRateLimited('scorecard_update', '203.0.113.10')).toBe(true)
  })

  it('uses the chat_message override of twenty hits per minute', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-04T10:00:00.000Z'))
    const { isIpRateLimited } = await loadRateLimitModule()

    for (let i = 0; i < 20; i++) {
      expect(isIpRateLimited('chat_message', '203.0.113.20')).toBe(false)
    }

    expect(isIpRateLimited('chat_message', '203.0.113.20')).toBe(true)
  })

  it('expires old hits after the configured window elapses', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-04T10:00:00.000Z'))
    const { isIpRateLimited } = await loadRateLimitModule()

    for (let i = 0; i < 5; i++) {
      expect(isIpRateLimited('scorecard_update', '203.0.113.30')).toBe(false)
    }

    expect(isIpRateLimited('scorecard_update', '203.0.113.30')).toBe(true)

    vi.advanceTimersByTime(15 * 60 * 1000)

    expect(isIpRateLimited('scorecard_update', '203.0.113.30')).toBe(false)
  })

  it('tracks hits independently by bucket and IP address', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-04T10:00:00.000Z'))
    const { isIpRateLimited } = await loadRateLimitModule()

    for (let i = 0; i < 5; i++) {
      expect(isIpRateLimited('scorecard_update', '203.0.113.40')).toBe(false)
    }

    expect(isIpRateLimited('scorecard_update', '203.0.113.40')).toBe(true)
    expect(isIpRateLimited('audit_update', '203.0.113.40')).toBe(false)
    expect(isIpRateLimited('scorecard_update', '203.0.113.41')).toBe(false)
  })

  it('extracts the first forwarded IP before falling back to x-real-ip or unknown', async () => {
    const { getClientIpFromRequest } = await loadRateLimitModule()

    expect(
      getClientIpFromRequest(
        mockRequest({
          'x-forwarded-for': ' 198.51.100.10, 198.51.100.11 ',
          'x-real-ip': '198.51.100.12',
        })
      )
    ).toBe('198.51.100.10')
    expect(getClientIpFromRequest(mockRequest({ 'x-real-ip': '198.51.100.13' }))).toBe('198.51.100.13')
    expect(getClientIpFromRequest(mockRequest({}))).toBe('unknown')
  })
})
