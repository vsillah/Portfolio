import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  classifyMeetingPainPoints,
  insertClassifiedEvidence,
  MEETING_PAIN_CLASSIFICATION_OPERATION,
  MeetingPainClassificationError,
} from '@/lib/meeting-pain-classifier'
import {
  endAgentRun,
  markAgentRunFailed,
  recordAgentStep,
  startAgentRun,
} from '@/lib/agent-run'

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

  let agentRunId: string | null = null
  let contactSubmissionIdForTrace: number | null = null

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
  contactSubmissionIdForTrace = contactSubmissionId ?? null
  const shouldInsertEvidence = body.insert_evidence === true

  if (!painPoints.trim() && !quickWins.trim()) {
    return NextResponse.json(
      { error: 'At least one of pain_points or quick_wins is required' },
      { status: 400 }
    )
  }

  try {
    const agentRun = await startAgentRun({
      agentKey: 'manual-admin',
      runtime: 'manual',
      kind: MEETING_PAIN_CLASSIFICATION_OPERATION,
      title: 'Classify meeting pain points',
      subject: {
        type: contactSubmissionId ? 'contact_submission' : 'meeting_pain_points',
        id: contactSubmissionId ?? null,
        label: contactSubmissionId ? `Contact submission ${contactSubmissionId}` : 'Meeting pain point classification',
      },
      triggerSource: 'admin:meetings_classify_pain_points',
      triggeredByUserId: auth.user.id,
      currentStep: 'Meeting pain point classification request validated',
      metadata: {
        pain_points_chars: painPoints.length,
        quick_wins_chars: quickWins.length,
        insert_evidence: shouldInsertEvidence,
      },
    })
    agentRunId = agentRun.id

    await recordAgentStep({
      runId: agentRunId,
      stepKey: 'meeting_pain_classification_request_validated',
      name: 'Meeting pain classification request validated',
      status: 'completed',
      inputSummary: [painPoints, quickWins].filter(Boolean).join('\n').slice(0, 240),
      metadata: {
        contact_submission_id: contactSubmissionId ?? null,
        insert_evidence: shouldInsertEvidence,
      },
      idempotencyKey: `${agentRunId}:meeting_pain_classification_request_validated`,
    }).catch((err) => console.warn('[classify-pain-points] agent validation step failed:', err))

    const result = await classifyMeetingPainPoints(painPoints, quickWins, { agentRunId })

    let evidenceResult = null
    if (shouldInsertEvidence && result.classified.length > 0) {
      evidenceResult = await insertClassifiedEvidence(
        result.classified,
        contactSubmissionId
      )
    }

    await endAgentRun({
      runId: agentRunId,
      status: 'completed',
      currentStep: 'Meeting pain points classified',
      outcome: {
        classified_count: result.classified.length,
        unclassified_count: result.unclassified.length,
        inserted_evidence_count: evidenceResult?.inserted ?? 0,
        evidence_error_count: evidenceResult?.errors.length ?? 0,
      },
    }).catch((err) => console.warn('[classify-pain-points] end agent run failed:', err))

    return NextResponse.json({
      classified: result.classified,
      unclassified: result.unclassified,
      evidence: evidenceResult,
      agentRunId,
    })
  } catch (err) {
    console.error('[classify-pain-points] Error:', err)
    const message = err instanceof Error ? err.message : String(err)
    if (agentRunId) {
      await recordAgentStep({
        runId: agentRunId,
        stepKey: 'meeting_pain_classification_failed',
        name: 'Meeting pain classification failed',
        status: 'failed',
        outputSummary: message,
        idempotencyKey: `${agentRunId}:meeting_pain_classification_failed`,
      }).catch((stepErr) => console.warn('[classify-pain-points] agent failure step failed:', stepErr))
      await markAgentRunFailed(agentRunId, message, {
        operation: MEETING_PAIN_CLASSIFICATION_OPERATION,
        contact_submission_id: contactSubmissionIdForTrace,
      }).catch((runErr) => console.warn('[classify-pain-points] mark agent run failed:', runErr))
    }

    if (err instanceof MeetingPainClassificationError) {
      return NextResponse.json(
        { error: safeMeetingPainClassificationErrorMessage(err), agentRunId },
        { status: meetingPainClassificationErrorStatus(err) },
      )
    }

    return NextResponse.json(
      { error: 'Classification failed' },
      { status: 500 }
    )
  }
}

function safeMeetingPainClassificationErrorMessage(error: MeetingPainClassificationError): string {
  if (error.code === 'budget_blocked') {
    return 'This meeting pain classification request is over the current Agent Ops budget limit. Shorten the meeting notes before retrying.'
  }
  if (error.code === 'openai_upstream') {
    return 'AI classification failed'
  }
  if (error.code === 'invalid_response') {
    return 'The AI returned an invalid classification response. Try again with shorter meeting notes.'
  }
  return 'Classification failed'
}

function meetingPainClassificationErrorStatus(error: MeetingPainClassificationError): number {
  if (error.code === 'budget_blocked') return 400
  if (error.code === 'openai_upstream' || error.code === 'invalid_response') return 502
  return 500
}
