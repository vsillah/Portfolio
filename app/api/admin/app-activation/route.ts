import { NextRequest, NextResponse } from 'next/server'
import { isAuthError, verifyAdmin } from '@/lib/auth-server'
import { applySyntheticOperatorAction, getOperatorSnapshot, OperatorActionError, type OperatorAction } from '@/lib/app-activation-operator.server'
import { ActivationError, getActivationRepository } from '@/lib/app-activation-repository.server'
import { getInvitationDeliveryAdapter, ProviderDisabledDelivery } from '@/lib/app-activation-delivery.server'

export const dynamic = 'force-dynamic'

async function authorize(request: NextRequest) {
  const auth = await verifyAdmin(request)
  return isAuthError(auth) ? NextResponse.json({ error: auth.error }, { status: auth.status }) : auth
}

export async function GET(request: NextRequest) {
  const auth = await authorize(request)
  if (auth instanceof NextResponse) return auth
  const repository = getActivationRepository()
  try { return NextResponse.json(repository ? await repository.snapshot() : getOperatorSnapshot(), { headers: { 'Cache-Control': 'no-store' } }) }
  catch { return NextResponse.json({ error: 'Activation provider unavailable.' }, { status: 503 }) }
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request)
  if (auth instanceof NextResponse) return auth
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return NextResponse.json({ error: 'JSON content type required.' }, { status: 415 })
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Cross-origin operator actions are blocked.' }, { status: 403 })
  const repository = getActivationRepository()
  if (!repository && getOperatorSnapshot().mode !== 'synthetic') return NextResponse.json({ error: 'Activation provider is unconfigured. Hosted actions are disabled.' }, { status: 503 })
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.appKey !== 'string' || typeof body.recordId !== 'string' || typeof body.action !== 'string' || typeof body.reason !== 'string') {
    return NextResponse.json({ error: 'App, interest, action, and audit reason are required.' }, { status: 400 })
  }
  try {
    if (repository) {
      if (body.action === 'prepare_invitation' && getInvitationDeliveryAdapter() instanceof ProviderDisabledDelivery) return NextResponse.json({ error: 'Hosted invitation delivery is not authorized or configured.' }, { status: 503 })
      const result = await repository.operator({ appKey: body.appKey, recordId: body.recordId, action: body.action as OperatorAction, actor: auth.user.id, reason: body.reason, confirmation: typeof body.confirmation === 'string' ? body.confirmation : undefined })
      if (body.action === 'prepare_invitation') {
        const invitation = result.record.invitation
        if (!result.deliveryToken || !invitation) return NextResponse.json({ error: 'Invitation preparation failed.' }, { status: 503 })
        try {
          const receipt = await getInvitationDeliveryAdapter().deliver({ appKey: body.appKey, adultEmail: result.record.adultEmail, rawToken: result.deliveryToken, expiresAt: invitation.expiresAt })
          return NextResponse.json({ record: result.record, delivery: receipt, message: 'Invitation delivery adapter completed.' }, { headers: { 'Cache-Control': 'no-store' } })
        } catch {
          try { await repository.revokeUndeliveredInvitation(body.appKey, body.recordId, invitation.id, auth.user.id) }
          catch { return NextResponse.json({ error: 'Delivery failed and invitation recovery needs operator review.' }, { status: 503 }) }
          return NextResponse.json({ error: 'Delivery failed; invitation was revoked.' }, { status: 503 })
        }
      }
      return NextResponse.json({ record: result.record, message: 'Activation review updated.' }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const record = applySyntheticOperatorAction({ appKey: body.appKey, recordId: body.recordId, action: body.action as OperatorAction, actor: auth.user.id, reason: body.reason, confirmation: typeof body.confirmation === 'string' ? body.confirmation : undefined })
    return NextResponse.json({ record, message: 'Synthetic review updated. No external action occurred.' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof OperatorActionError || error instanceof ActivationError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Operator action failed.' }, { status: 500 })
  }
}
