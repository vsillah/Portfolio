import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { isTestingDatabaseConfigured } from './database'

/** Check configuration before auth (which itself may perform network requests). */
export async function requireTestingAdmin(request: NextRequest): Promise<NextResponse | null> {
  if (!isTestingDatabaseConfigured()) {
    return NextResponse.json({ error: 'Testing database is not configured' }, { status: 503 })
  }
  if (!/^Bearer [^\s]+$/.test(request.headers.get('authorization') ?? '')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    return null
  } catch {
    return NextResponse.json({ error: 'Unable to verify admin access' }, { status: 503 })
  }
}
