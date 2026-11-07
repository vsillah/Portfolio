import { NextRequest, NextResponse } from 'next/server'
import { isAuthError, verifyAdmin } from '@/lib/auth-server'
import { applySyntheticOperatorAction, getOperatorSnapshot, OperatorActionError, type OperatorAction } from '@/lib/app-activation-operator.server'

export const dynamic = 'force-dynamic'

async function authorize(request: NextRequest) {
  const auth = await verifyAdmin(request)
  return isAuthError(auth) ? NextResponse.json({ error: auth.error }, { status: auth.status }) : auth
}

export async function GET(request: NextRequest) {
  const auth = await authorize(request)
  if (auth instanceof NextResponse) return auth
  return NextResponse.json(getOperatorSnapshot(), { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request)
  if (auth instanceof NextResponse) return auth
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return NextResponse.json({ error: 'JSON content type required.' }, { status: 415 })
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Cross-origin operator actions are blocked.' }, { status: 403 })
  if (getOperatorSnapshot().mode !== 'synthetic') return NextResponse.json({ error: 'Activation provider is unconfigured. Hosted actions are disabled.' }, { status: 503 })
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.appKey !== 'string' || typeof body.recordId !== 'string' || typeof body.action !== 'string' || typeof body.reason !== 'string') {
    return NextResponse.json({ error: 'App, interest, action, and audit reason are required.' }, { status: 400 })
  }
  try {
    const record = applySyntheticOperatorAction({ appKey: body.appKey, recordId: body.recordId, action: body.action as OperatorAction, actor: auth.user.id, reason: body.reason, confirmation: typeof body.confirmation === 'string' ? body.confirmation : undefined })
    return NextResponse.json({ record, message: 'Synthetic review updated. No external action occurred.' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof OperatorActionError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Operator action failed.' }, { status: 500 })
  }
}
