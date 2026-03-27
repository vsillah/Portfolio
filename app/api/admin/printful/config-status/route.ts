import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/printful/config-status
 * Returns which Printful env vars are set (booleans only — never exposes secrets).
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  return NextResponse.json({
    apiKeySet: Boolean(process.env.PRINTFUL_API_KEY?.trim()),
    storeIdSet: Boolean(process.env.PRINTFUL_STORE_ID?.trim()),
  })
}
