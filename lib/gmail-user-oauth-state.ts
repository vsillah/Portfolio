import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { deriveStateHmacKey } from '@/lib/gmail-user-oauth-secret'

const STATE_TTL_MS = 15 * 60 * 1000

export function signOAuthState(userId: string): string {
  const key = deriveStateHmacKey()
  const payloadObj = {
    uid: userId,
    exp: Date.now() + STATE_TTL_MS,
    n: randomBytes(8).toString('hex'),
  }
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url')
  const sig = createHmac('sha256', key).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyOAuthState(state: string): string | null {
  try {
    const dot = state.indexOf('.')
    if (dot <= 0) return null
    const payload = state.slice(0, dot)
    const sig = state.slice(dot + 1)
    const key = deriveStateHmacKey()
    const expected = createHmac('sha256', key).update(payload).digest('base64url')
    const sigBuf = Buffer.from(sig, 'utf8')
    const expBuf = Buffer.from(expected, 'utf8')
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null
    }
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      uid?: string
      exp?: number
    }
    if (typeof data.uid !== 'string' || typeof data.exp !== 'number') return null
    if (data.exp < Date.now()) return null
    return data.uid
  } catch {
    return null
  }
}
