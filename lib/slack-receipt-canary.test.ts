import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSlackReceiptCanary } from './slack-receipt-canary'

const hostedStaging = {
  VERCEL: '1',
  VERCEL_ENV: 'production',
  APP_ENV: 'staging',
  NEXT_PUBLIC_APP_ENV: 'staging',
  SLACK_AGENT_OPS_STAGING_BASE_URL: 'https://staging.example.com',
  SLACK_ACTION_RECEIPTS_ENABLED: 'true',
  SLACK_ACTION_RECEIPTS_ENVIRONMENT: 'staging',
} as const

function stubHostedStaging(overrides: Record<string, string> = {}) {
  for (const [key, value] of Object.entries({ ...hostedStaging, ...overrides })) {
    vi.stubEnv(key, value)
  }
}

describe('buildSlackReceiptCanary', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    stubHostedStaging()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns a receipt-only card when hosted receipts match the signed app id', () => {
    const result = buildSlackReceiptCanary('A123')

    expect(result.responseType).toBe('ephemeral')
    expect(result.text).toContain('Receipt-only canary · staging')
    expect(result.text).toContain('Signed command app ID: A123')
    expect(result.text).toContain('without changing approvals, work, or outreach')
    expect(result.blocks).toHaveLength(2)
    const button = (result.blocks?.[1] as { elements: Array<{ value: string }> }).elements[0]
    expect(JSON.parse(button.value)).toMatchObject({
      action: 'canary.receipt',
      schemaVersion: 'receipt-canary-v1',
      canaryAppId: 'A123',
      sourceEnvironment: 'staging',
      sourceOrigin: 'https://staging.example.com',
    })
  })

  it.each([
    ['receipts disabled', { SLACK_ACTION_RECEIPTS_ENABLED: 'false' }, 'receipt processing must already be enabled'],
    ['environment mismatch', { SLACK_ACTION_RECEIPTS_ENVIRONMENT: 'production' }, 'receipt processing must already be enabled'],
  ])('blocks the card when %s', (_label, overrides, snippet) => {
    stubHostedStaging(overrides)

    const result = buildSlackReceiptCanary('A123')

    expect(result).toEqual({
      responseType: 'ephemeral',
      text: expect.stringContaining(snippet),
    })
    expect(result.blocks).toBeUndefined()
  })

  it('blocks the card on a local (non-hosted) source even when receipts are enabled', () => {
    vi.unstubAllEnvs()
    vi.stubEnv('APP_ENV', 'development')
    vi.stubEnv('SLACK_ACTION_RECEIPTS_ENABLED', 'true')
    vi.stubEnv('SLACK_ACTION_RECEIPTS_ENVIRONMENT', 'local')

    const result = buildSlackReceiptCanary('A123')

    expect(result.responseType).toBe('ephemeral')
    expect(result.text).toContain('receipt processing must already be enabled')
    expect(result.blocks).toBeUndefined()
  })

  it.each([
    [null, 'missing signed Slack app identity'],
    ['', 'missing signed Slack app identity'],
    ['a123', 'missing signed Slack app identity'],
    ['B123', 'missing signed Slack app identity'],
    ['A', 'missing signed Slack app identity'],
    [`A${'1'.repeat(32)}`, 'missing signed Slack app identity'],
  ])('rejects unsigned or malformed app id %j', (appId, snippet) => {
    const result = buildSlackReceiptCanary(appId)

    expect(result).toEqual({
      responseType: 'ephemeral',
      text: expect.stringContaining(snippet),
    })
    expect(result.blocks).toBeUndefined()
  })
})
