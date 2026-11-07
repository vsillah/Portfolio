import { NextRequest, NextResponse } from 'next/server'
import { ActivationError, activationRuntimeConfigured, configuredAppOrigins, getActivationRepository } from '@/lib/app-activation-repository.server'
import { isAdultInterestForm, normalizeAdultEmail } from '@/lib/app-activation-intake'
import { getClientIpFromRequest } from '@/lib/simple-ip-rate-limit'

export const dynamic = 'force-dynamic'
const corsOrigin = (origin: string | null) => origin && Object.values(configuredAppOrigins()).some(origins => origins.includes(origin)) ? origin : null
const headers = (origin: string | null) => ({ 'Cache-Control': 'no-store', Vary: 'Origin', ...(corsOrigin(origin) ? { 'Access-Control-Allow-Origin': origin! } : {}) })
const reply = (body: object, status: number, origin: string | null = null) => NextResponse.json(body, { status, headers: headers(origin) })

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!getActivationRepository() || !corsOrigin(origin)) return new NextResponse(null, { status: 403 })
  return new NextResponse(null, { status: 204, headers: { ...headers(origin), 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' } })
}

export async function POST(request: NextRequest) {
  const repository = getActivationRepository()
  if (!repository || !activationRuntimeConfigured()) return reply({ error: 'Activation intake is unavailable.' }, 503)
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return reply({ error: 'JSON content type required.' }, 415)
  const origin = request.headers.get('origin')
  if (!origin) return reply({ error: 'Origin required.' }, 403)
  try { if (!await repository.consumeAbuseBudget('interest', getClientIpFromRequest(request))) return reply({ error: 'Please try again later.' }, 429) }
  catch { return reply({ error: 'Activation intake is unavailable.' }, 503) }
  if (Number(request.headers.get('content-length') || 0) > 4096) return reply({ error: 'Request too large.' }, 413)
  let body: unknown
  try { body = await request.json() } catch { return reply({ error: 'Invalid JSON.' }, 400) }
  if (!isAdultInterestForm(body)) return reply({ error: 'Adult email and explicit consent are required.' }, 400)
  const appOrigins = configuredAppOrigins()[body.appKey]
  if (!appOrigins || (origin !== new URL(request.url).origin && !appOrigins.includes(origin))) return reply({ error: 'Origin is not allowed for this app.' }, 403)
  if (body.consentVersion !== process.env.APP_ACTIVATION_CONSENT_VERSION) return reply({ error: 'Consent version is not current.' }, 409)
  try {
    await repository.intake({ appKey: body.appKey, adultEmail: normalizeAdultEmail(body.adultEmail)!, consentVersion: body.consentVersion,
      consentGranted: true, idempotencyKey: body.idempotencyKey, sourceType: 'direct_form', sourceReceipt: body.sourceReceipt })
    return reply({ message: 'Your interest has been recorded for review. No account or access has been granted.' }, 202, origin)
  } catch (error) {
    if (error instanceof ActivationError && [404, 409].includes(error.status)) return reply({ message: 'Your interest has been recorded for review. No account or access has been granted.' }, 202, origin)
    return reply({ error: 'Interest could not be recorded.' }, 503)
  }
}
