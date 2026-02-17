import { NextRequest, NextResponse } from 'next/server'
import { validateDashboardToken } from '@/lib/client-dashboard'
import { getRecommendationsForDashboard } from '@/lib/acceleration-engine'

/**
 * GET /api/client/dashboard/[token]/accelerators
 * Returns active, non-dismissed acceleration recommendations.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || token.length < 32) {
    return NextResponse.json({ error: 'Invalid dashboard link' }, { status: 400 })
  }

  const { projectId, error: tokenError } = await validateDashboardToken(token)
  if (!projectId) {
    return NextResponse.json({ error: tokenError || 'Invalid token' }, { status: 404 })
  }

  const recommendations = await getRecommendationsForDashboard(projectId)

  return NextResponse.json({ recommendations })
}
