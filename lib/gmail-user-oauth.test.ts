import { createHmac } from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deriveAesKey,
  deriveStateHmacKey,
  isGmailUserOauthSecretConfigured,
} from './gmail-user-oauth-secret'
import { signOAuthState, verifyOAuthState } from './gmail-user-oauth-state'
import { decryptRefreshToken, encryptRefreshToken } from './gmail-user-oauth-crypto'

const BASE_ENV = { ...process.env }
const TEST_SECRET = 'test-gmail-oauth-secret-with-enough-length'
const FIXED_NOW = new Date('2026-07-02T10:00:00.000Z')
const STATE_TTL_MS = 15 * 60 * 1000

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function flipLastChar(value: string) {
  const last = value.at(-1)
  return `${value.slice(0, -1)}${last === 'A' ? 'B' : 'A'}`
}

function signPayload(payload: string) {
  return createHmac('sha256', deriveStateHmacKey()).update(payload).digest('base64url')
}

describe('Gmail user OAuth helpers', () => {
  beforeEach(() => {
    restoreEnv()
    process.env.GMAIL_USER_OAUTH_SECRET = TEST_SECRET
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    restoreEnv()
  })

  it('requires a configured secret before deriving OAuth keys', () => {
    process.env.GMAIL_USER_OAUTH_SECRET = 'too-short'

    expect(isGmailUserOauthSecretConfigured()).toBe(false)
    expect(() => deriveAesKey()).toThrow(/GMAIL_USER_OAUTH_SECRET/)
    expect(() => deriveStateHmacKey()).toThrow(/GMAIL_USER_OAUTH_SECRET/)

    process.env.GMAIL_USER_OAUTH_SECRET = `  ${TEST_SECRET}  `

    expect(isGmailUserOauthSecretConfigured()).toBe(true)
    expect(deriveAesKey()).toHaveLength(32)
    expect(deriveStateHmacKey()).toHaveLength(32)
    expect(deriveAesKey().equals(deriveStateHmacKey())).toBe(false)
  })

  it('round-trips signed OAuth state for the intended user before expiry', () => {
    const state = signOAuthState('admin-user-123')

    expect(verifyOAuthState(state)).toBe('admin-user-123')

    vi.setSystemTime(new Date(FIXED_NOW.getTime() + STATE_TTL_MS - 1))

    expect(verifyOAuthState(state)).toBe('admin-user-123')
  })

  it('rejects tampered, malformed, and expired OAuth state', () => {
    const state = signOAuthState('admin-user-123')
    const [payload, signature] = state.split('.')

    expect(verifyOAuthState(`${payload}.${flipLastChar(signature)}`)).toBeNull()
    expect(verifyOAuthState('missing-dot-state')).toBeNull()
    expect(verifyOAuthState(`not-json.${signPayload('not-json')}`)).toBeNull()

    vi.setSystemTime(new Date(FIXED_NOW.getTime() + STATE_TTL_MS + 1))

    expect(verifyOAuthState(state)).toBeNull()
  })

  it('rejects signed state payloads that do not contain a user id and expiry', () => {
    const payload = Buffer.from(JSON.stringify({ uid: 'admin-user-123' })).toString('base64url')
    const signature = signPayload(payload)

    expect(verifyOAuthState(`${payload}.${signature}`)).toBeNull()
  })

  it('encrypts and decrypts refresh tokens with AES-GCM', () => {
    const encrypted = encryptRefreshToken('1//refresh-token-with-unicode-世界')

    expect(encrypted.cipher).not.toContain('refresh-token')
    expect(decryptRefreshToken(encrypted.cipher, encrypted.iv, encrypted.tag)).toBe(
      '1//refresh-token-with-unicode-世界'
    )
  })

  it('fails closed when encrypted refresh-token material is tampered with', () => {
    const encrypted = encryptRefreshToken('1//refresh-token')

    expect(() => decryptRefreshToken(encrypted.cipher, encrypted.iv, flipLastChar(encrypted.tag))).toThrow()

    process.env.GMAIL_USER_OAUTH_SECRET = 'different-gmail-oauth-secret-with-enough-length'

    expect(() => decryptRefreshToken(encrypted.cipher, encrypted.iv, encrypted.tag)).toThrow()
  })
})
