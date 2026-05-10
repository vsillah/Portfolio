import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest } from 'next/server'

export function verifySlackSignature(request: NextRequest, rawBody: string) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET
  if (!signingSecret) {
    const allowUnsignedLocal =
      process.env.NODE_ENV !== 'production' && !process.env.VERCEL && process.env.NEXT_PUBLIC_APP_ENV !== 'staging'
    if (allowUnsignedLocal) {
      console.warn('SLACK_SIGNING_SECRET not configured -- skipping verification for local development')
      return true
    }
    console.warn('SLACK_SIGNING_SECRET not configured -- rejecting Slack request')
    return false
  }

  const timestamp = request.headers.get('x-slack-request-timestamp')
  const signature = request.headers.get('x-slack-signature')
  if (!timestamp || !signature) return false

  const timestampSeconds = Number(timestamp)
  if (!Number.isFinite(timestampSeconds)) return false

  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestampSeconds) > 300) return false

  const basestring = `v0:${timestamp}:${rawBody}`
  const expectedSignature = `v0=${createHmac('sha256', signingSecret).update(basestring).digest('hex')}`
  const expected = Buffer.from(expectedSignature)
  const actual = Buffer.from(signature)

  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}
