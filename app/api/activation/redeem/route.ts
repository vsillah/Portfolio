import { NextRequest, NextResponse } from 'next/server'
import { isAuthError, verifyAuth } from '@/lib/auth-server'
import { activationRuntimeConfigured, configuredAppOrigins, getActivationRepository } from '@/lib/app-activation-repository.server'
import { getClientIpFromRequest } from '@/lib/simple-ip-rate-limit'

export const dynamic = 'force-dynamic'
const headers = () => ({ 'Cache-Control': 'no-store' })
const reply = (body: object, status: number) => NextResponse.json(body, { status, headers: headers() })

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!getActivationRepository() || origin !== new URL(request.url).origin) return new NextResponse(null, { status: 403 })
  return new NextResponse(null, { status: 204, headers: headers() })
}

export async function POST(request: NextRequest) {
  const repository = getActivationRepository()
  if (!repository || !activationRuntimeConfigured()) return reply({ error: 'Activation redemption is unavailable.' }, 503)
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return reply({ error: 'JSON content type required.' }, 415)
  const origin = request.headers.get('origin')
  if (origin !== new URL(request.url).origin) return reply({ error: 'Portfolio origin required.' }, 403)
  try { if (!await repository.consumeAbuseBudget('redeem', getClientIpFromRequest(request))) return reply({ error: 'Please try again later.' }, 429) }
  catch { return reply({ error: 'Activation redemption is unavailable.' }, 503) }
  const auth = await verifyAuth(request)
  if (isAuthError(auth) || !auth.user.email || auth.user.is_anonymous) return reply({ error: 'Signed-in adult account required.' }, 401)
  if (Number(request.headers.get('content-length') || 0) > 4096) return reply({ error: 'Request too large.' }, 413)
  let body: unknown
  try { body = await request.json() } catch { return reply({ error: 'Invalid JSON.' }, 400) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'Invalid request.' }, 400)
  const { appKey, token, adultConfirmed } = body as Record<string, unknown>
  if (typeof appKey !== 'string' || typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,128}$/.test(token) || adultConfirmed !== true)
    return reply({ error: 'App, invitation, and adult confirmation are required.' }, 400)
  if (!configuredAppOrigins()[appKey]) return reply({ error: 'App is unavailable.' }, 403)
  try {
    const redeemed = await repository.redeem({ appKey, token, authUserId: auth.user.id, adultEmail: auth.user.email })
    return redeemed ? reply({ status: 'redeemed', appKey }, 200) : reply({ error: 'Invitation is unavailable.' }, 404)
  } catch { return reply({ error: 'Invitation is unavailable.' }, 404) }
}
