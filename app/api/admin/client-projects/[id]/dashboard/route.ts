import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { generateClientDashboard } from '@/lib/client-dashboard'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/client-projects/[id]/dashboard
 * Admin generates a new client dashboard (access token + initial snapshot).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id: clientProjectId } = await params

  const { accessToken, snapshotId, error } = await generateClientDashboard(clientProjectId)

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  const dashboardUrl = `/client/dashboard/${accessToken}`

  return NextResponse.json({
    success: true,
    accessToken,
    snapshotId,
    dashboardUrl,
  })
}
