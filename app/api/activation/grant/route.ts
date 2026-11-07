import { NextRequest, NextResponse } from 'next/server'
import { isAuthError, verifyAuth } from '@/lib/auth-server'
import { configuredAppOrigins, getActivationRepository } from '@/lib/app-activation-repository.server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const repository = getActivationRepository()
  if (!repository) return NextResponse.json({ error: 'Activation grants are unavailable.' }, { status: 503 })
  const auth = await verifyAuth(request)
  if (isAuthError(auth) || auth.user.is_anonymous) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const appKey = request.nextUrl.searchParams.get('appKey') || ''
  const origin = request.headers.get('origin')
  if (!configuredAppOrigins()[appKey]?.includes(origin || '')) return NextResponse.json({ error: 'Origin is not allowed for this app.' }, { status: 403 })
  try {
    const active = await repository.hasGrant(appKey, auth.user.id)
    return NextResponse.json({ appKey, active }, { headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': origin!, Vary: 'Origin' } })
  } catch { return NextResponse.json({ error: 'Grant could not be checked.' }, { status: 503 }) }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!getActivationRepository() || !origin || !Object.values(configuredAppOrigins()).some(origins => origins.includes(origin))) return new NextResponse(null, { status: 403 })
  return new NextResponse(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization', 'Access-Control-Max-Age': '600', Vary: 'Origin' } })
}
