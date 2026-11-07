import { NextRequest, NextResponse } from 'next/server'
import { activationRuntimeConfigured, appServerSecretValid, configuredAppOrigins, getActivationRepository } from '@/lib/app-activation-repository.server'
import { getClientIpFromRequest } from '@/lib/simple-ip-rate-limit'

export const dynamic = 'force-dynamic'
const reply = (body: object, status: number) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

// Server-to-server only. The app authenticates with its own server secret.
export async function POST(request: NextRequest) {
  const repository = getActivationRepository()
  if (!repository || !activationRuntimeConfigured() || process.env.APP_ACTIVATION_HANDOFF_ENABLED !== 'true') return reply({ error: 'Handoff is unavailable.' }, 503)
  if (request.headers.get('origin')) return reply({ error: 'Browser exchange is not allowed.' }, 403)
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return reply({ error: 'JSON content type required.' }, 415)
  try { if (!await repository.consumeAbuseBudget('handoff_exchange', getClientIpFromRequest(request))) return reply({ error: 'Please try again later.' }, 429) }
  catch { return reply({ error: 'Handoff is unavailable.' }, 503) }
  if (Number(request.headers.get('content-length') || 0) > 2048) return reply({ error: 'Request too large.' }, 413)
  let body: unknown
  try { body = await request.json() } catch { return reply({ error: 'Invalid JSON.' }, 400) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'Invalid request.' }, 400)
  const { appKey, code } = body as Record<string, unknown>
  if (typeof appKey !== 'string' || typeof code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(code)) return reply({ error: 'Invalid request.' }, 400)
  if (!configuredAppOrigins()[appKey] || !appServerSecretValid(appKey, request.headers.get('x-activation-app-secret') || '')) return reply({ error: 'Handoff is unavailable.' }, 403)
  try {
    const sessionHandle = await repository.exchangeHandoff(appKey, code)
    return sessionHandle ? reply({ appKey, sessionHandle, expiresInSeconds: 86400 }, 200) : reply({ error: 'Handoff is unavailable.' }, 404)
  } catch { return reply({ error: 'Handoff is unavailable.' }, 503) }
}
