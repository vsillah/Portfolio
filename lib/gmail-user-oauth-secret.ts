import { scryptSync } from 'crypto'

const AES_SALT = 'admin-gmail-oauth-aes-v1'
const STATE_SALT = 'admin-gmail-oauth-state-v1'
const KEY_LEN = 32

export function getGmailUserOauthSecret(): string {
  return process.env.GMAIL_USER_OAUTH_SECRET?.trim() ?? ''
}

export function isGmailUserOauthSecretConfigured(): boolean {
  return getGmailUserOauthSecret().length >= 24
}

export function deriveAesKey(): Buffer {
  const s = getGmailUserOauthSecret()
  if (s.length < 24) {
    throw new Error('GMAIL_USER_OAUTH_SECRET must be set (min 24 characters)')
  }
  return scryptSync(s, AES_SALT, KEY_LEN)
}

export function deriveStateHmacKey(): Buffer {
  const s = getGmailUserOauthSecret()
  if (s.length < 24) {
    throw new Error('GMAIL_USER_OAUTH_SECRET must be set (min 24 characters)')
  }
  return scryptSync(s, STATE_SALT, KEY_LEN)
}
