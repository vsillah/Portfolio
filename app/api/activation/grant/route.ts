import { NextRequest, NextResponse } from 'next/server'
import { activationRuntimeConfigured, appServerSecretValid, configuredAppOrigins, getActivationRepository } from '@/lib/app-activation-repository.server'
import { getClientIpFromRequest } from '@/lib/simple-ip-rate-limit'

export const dynamic = 'force-dynamic'

// Consuming apps call this server-side using their own authenticated session.
// Portfolio Auth bearers are never passed to an app.
export async function POST(request: NextRequest) {
  const repository = getActivationRepository()
  if (!repository || !activationRuntimeConfigured() || process.env.APP_ACTIVATION_HANDOFF_ENABLED !== 'true') return NextResponse.json({ error: 'Grant check is unavailable.' }, { status: 503 })
  if (request.headers.get('origin')) return NextResponse.json({ error: 'Browser grant check is not allowed.' }, { status: 403 })
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return NextResponse.json({ error: 'JSON content type required.' }, { status: 415 })
  try { if (!await repository.consumeAbuseBudget('grant', getClientIpFromRequest(request))) return NextResponse.json({ error: 'Please try again later.' }, { status: 429 }) }
  catch { return NextResponse.json({ error: 'Grant check is unavailable.' }, { status: 503 }) }
  if (Number(request.headers.get('content-length') || 0) > 2048) return NextResponse.json({ error: 'Request too large.' }, { status: 413 })
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const { appKey, sessionHandle } = body as Record<string, unknown>
  if (typeof appKey !== 'string' || typeof sessionHandle !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(sessionHandle)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  if (!configuredAppOrigins()[appKey] || !appServerSecretValid(appKey, request.headers.get('x-activation-app-secret') || '')) return NextResponse.json({ error: 'Grant check is unavailable.' }, { status: 403 })
  try {
    const active = await repository.hasGrantForHandle(appKey, sessionHandle)
    return NextResponse.json({ appKey, active }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: 'Grant could not be checked.' }, { status: 503 }) }
}
