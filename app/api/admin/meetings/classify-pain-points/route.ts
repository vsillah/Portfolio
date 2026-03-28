import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  classifyMeetingPainPoints,
  insertClassifiedEvidence,
} from '@/lib/meeting-pain-classifier'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/meetings/classify-pain-points
 *
 * Classify freetext pain points / quick wins against pain_point_categories.
 * Optionally inserts into pain_point_evidence if insert_evidence=true.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const painPoints = typeof body.pain_points === 'string' ? body.pain_points : ''
  const quickWins = typeof body.quick_wins === 'string' ? body.quick_wins : ''
  const contactSubmissionId = typeof body.contact_submission_id === 'number'
    ? body.contact_submission_id
    : undefined
  const shouldInsertEvidence = body.insert_evidence === true

  if (!painPoints.trim() && !quickWins.trim()) {
    return NextResponse.json(
      { error: 'At least one of pain_points or quick_wins is required' },
      { status: 400 }
    )
  }

  try {
    const result = await classifyMeetingPainPoints(painPoints, quickWins)

    let evidenceResult = null
    if (shouldInsertEvidence && result.classified.length > 0) {
      evidenceResult = await insertClassifiedEvidence(
        result.classified,
        contactSubmissionId
      )
    }

    return NextResponse.json({
      classified: result.classified,
      unclassified: result.unclassified,
      evidence: evidenceResult,
    })
  } catch (err) {
    console.error('[classify-pain-points] Error:', err)
    return NextResponse.json(
      { error: 'Classification failed' },
      { status: 500 }
    )
  }
}
