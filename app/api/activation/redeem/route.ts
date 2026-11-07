import { NextRequest, NextResponse } from 'next/server'
import { isAuthError, verifyAuth } from '@/lib/auth-server'
import { configuredAppOrigins, getActivationRepository } from '@/lib/app-activation-repository.server'
import { isIpRateLimited, getClientIpFromRequest } from '@/lib/simple-ip-rate-limit'

export const dynamic = 'force-dynamic'
const corsOrigin = (origin: string | null) => origin && Object.values(configuredAppOrigins()).some(origins => origins.includes(origin)) ? origin : null
const headers = (origin: string | null) => ({ 'Cache-Control': 'no-store', Vary: 'Origin', ...(corsOrigin(origin) ? { 'Access-Control-Allow-Origin': origin! } : {}) })
const reply = (body: object, status: number, origin: string | null = null) => NextResponse.json(body, { status, headers: headers(origin) })

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!getActivationRepository() || !corsOrigin(origin)) return new NextResponse(null, { status: 403 })
  return new NextResponse(null, { status: 204, headers: { ...headers(origin), 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600' } })
}

export async function POST(request: NextRequest) {
  const repository = getActivationRepository()
  if (!repository) return reply({ error: 'Activation redemption is unavailable.' }, 503)
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return reply({ error: 'JSON content type required.' }, 415)
  const origin = request.headers.get('origin')
  if (!origin) return reply({ error: 'Origin required.' }, 403)
  if (isIpRateLimited('activation_redeem', getClientIpFromRequest(request))) return reply({ error: 'Please try again later.' }, 429)
  const auth = await verifyAuth(request)
  if (isAuthError(auth) || !auth.user.email || auth.user.is_anonymous) return reply({ error: 'Signed-in adult account required.' }, 401)
  if (Number(request.headers.get('content-length') || 0) > 4096) return reply({ error: 'Request too large.' }, 413)
  let body: unknown
  try { body = await request.json() } catch { return reply({ error: 'Invalid JSON.' }, 400) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'Invalid request.' }, 400)
  const { appKey, token, adultConfirmed } = body as Record<string, unknown>
  if (typeof appKey !== 'string' || typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,128}$/.test(token) || adultConfirmed !== true)
    return reply({ error: 'App, invitation, and adult confirmation are required.' }, 400)
  if (!configuredAppOrigins()[appKey]?.includes(origin)) return reply({ error: 'Origin is not allowed for this app.' }, 403)
  try {
    const redeemed = await repository.redeem({ appKey, token, authUserId: auth.user.id, adultEmail: auth.user.email })
    return redeemed ? reply({ status: 'redeemed', appKey }, 200, origin) : reply({ error: 'Invitation is unavailable.' }, 404, origin)
  } catch { return reply({ error: 'Invitation could not be redeemed.' }, 503) }
}
