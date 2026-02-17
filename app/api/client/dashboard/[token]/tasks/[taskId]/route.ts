import { NextRequest, NextResponse } from 'next/server'
import { updateTaskStatus } from '@/lib/client-dashboard'
import { recalculateScores } from '@/lib/assessment-scoring'
import { validateDashboardToken } from '@/lib/client-dashboard'

/**
 * PATCH /api/client/dashboard/[token]/tasks/[taskId]
 * Client toggles task status. Triggers score recalculation on completion.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; taskId: string }> }
) {
  const { token, taskId } = await params

  if (!token || token.length < 32) {
    return NextResponse.json({ error: 'Invalid dashboard link' }, { status: 400 })
  }

  let body: { status?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const status = body.status
  if (!status || !['pending', 'in_progress', 'complete'].includes(status)) {
    return NextResponse.json(
      { error: 'Invalid status. Must be pending, in_progress, or complete' },
      { status: 400 }
    )
  }

  const { success, error } = await updateTaskStatus(
    token,
    taskId,
    status as 'pending' | 'in_progress' | 'complete'
  )

  if (!success) {
    return NextResponse.json({ error: error || 'Failed to update task' }, { status: 400 })
  }

  // If task was completed, trigger score recalculation
  if (status === 'complete') {
    const { projectId } = await validateDashboardToken(token)
    if (projectId) {
      const scores = await recalculateScores(projectId, taskId)
      return NextResponse.json({
        success: true,
        scores: {
          categoryScores: scores.categoryScores,
          overallScore: scores.overallScore,
          dreamOutcomeGap: scores.dreamOutcomeGap,
        },
      })
    }
  }

  return NextResponse.json({ success: true })
}
