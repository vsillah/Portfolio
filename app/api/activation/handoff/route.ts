import { NextRequest, NextResponse } from 'next/server'
import { isAuthError, verifyAuth } from '@/lib/auth-server'
import { activationRuntimeConfigured, configuredAppOrigins, getActivationRepository } from '@/lib/app-activation-repository.server'
import { getClientIpFromRequest } from '@/lib/simple-ip-rate-limit'

export const dynamic = 'force-dynamic'
const reply = (body: object, status: number) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })

// Called only by a Portfolio first-party page holding Portfolio Auth. The app
// receives a two-minute code in a fragment, never the reusable Auth bearer.
export async function POST(request: NextRequest) {
  const repository = getActivationRepository()
  if (!repository || !activationRuntimeConfigured() || process.env.APP_ACTIVATION_HANDOFF_ENABLED !== 'true') return reply({ error: 'Handoff is unavailable.' }, 503)
  if (request.headers.get('origin') !== new URL(request.url).origin) return reply({ error: 'Portfolio origin required.' }, 403)
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return reply({ error: 'JSON content type required.' }, 415)
  try { if (!await repository.consumeAbuseBudget('handoff_issue', getClientIpFromRequest(request))) return reply({ error: 'Please try again later.' }, 429) }
  catch { return reply({ error: 'Handoff is unavailable.' }, 503) }
  const auth = await verifyAuth(request)
  if (isAuthError(auth) || auth.user.is_anonymous || !auth.user.email) return reply({ error: 'Signed-in adult account required.' }, 401)
  if (Number(request.headers.get('content-length') || 0) > 2048) return reply({ error: 'Request too large.' }, 413)
  let body: unknown
  try { body = await request.json() } catch { return reply({ error: 'Invalid JSON.' }, 400) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'Invalid request.' }, 400)
  const { appKey, returnUrl, adultConfirmed } = body as Record<string, unknown>
  if (typeof appKey !== 'string' || typeof returnUrl !== 'string' || adultConfirmed !== true) return reply({ error: 'App, return URL and adult confirmation required.' }, 400)
  let target: URL
  try { target = new URL(returnUrl) } catch { return reply({ error: 'Invalid return URL.' }, 400) }
  if (!configuredAppOrigins()[appKey]?.includes(target.origin) || target.username || target.password || target.hash || target.protocol !== 'https:') return reply({ error: 'Return URL is not allowed.' }, 403)
  try {
    const code = await repository.issueHandoff(appKey, auth.user.id)
    if (!code) return reply({ error: 'Access is unavailable.' }, 404)
    target.hash = new URLSearchParams({ activation_code: code }).toString()
    return reply({ returnUrl: target.toString(), expiresInSeconds: 120 }, 200)
  } catch { return reply({ error: 'Handoff is unavailable.' }, 503) }
}
