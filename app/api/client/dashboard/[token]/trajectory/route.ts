import { NextRequest, NextResponse } from 'next/server'
import { validateDashboardToken } from '@/lib/client-dashboard'
import { projectTrajectory } from '@/lib/assessment-scoring'

/**
 * GET /api/client/dashboard/[token]/trajectory
 * Returns score snapshot history + projected future trajectory.
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

  const trajectory = await projectTrajectory(projectId)

  return NextResponse.json({ trajectory })
}
