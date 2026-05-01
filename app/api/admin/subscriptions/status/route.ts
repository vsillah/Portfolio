import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getSubscriptionStatusRegistry } from '@/lib/subscription-status'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  return NextResponse.json(getSubscriptionStatusRegistry())
}
