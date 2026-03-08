import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getModulesWithConfig } from '@/lib/module-sync-db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/module-sync/modules
 * List modules with spun-off repo URL from DB (editable in UI).
 * Admin only.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const modules = await getModulesWithConfig()
  return NextResponse.json({ modules })
}
