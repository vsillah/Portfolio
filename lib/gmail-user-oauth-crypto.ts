import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { deriveAesKey } from '@/lib/gmail-user-oauth-secret'

const AES_ALGO = 'aes-256-gcm'

export function encryptRefreshToken(plain: string): {
  cipher: string
  iv: string
  tag: string
} {
  const key = deriveAesKey()
  const iv = randomBytes(12)
  const c = createCipheriv(AES_ALGO, key, iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  const tag = c.getAuthTag()
  return {
    cipher: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  }
}

export function decryptRefreshToken(
  cipherB64: string,
  ivB64: string,
  tagB64: string
): string {
  const key = deriveAesKey()
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const dec = createDecipheriv(AES_ALGO, key, iv)
  dec.setAuthTag(tag)
  return Buffer.concat([
    dec.update(Buffer.from(cipherB64, 'base64')),
    dec.final(),
  ]).toString('utf8')
}
