import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { extractLeadFieldsFromMeeting, LeadFromMeetingError } from '@/lib/lead-from-meeting'
import {
  endAgentRun,
  markAgentRunFailed,
  recordAgentStep,
  startAgentRun,
} from '@/lib/agent-run'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/meetings/:id/extract-lead-fields
 *
 * Uses AI to extract lead-creation fields (name, company, pain points, etc.)
 * from a meeting record's transcript. Returns pre-populated field values
 * for the Add Lead form.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const meetingId = params.id
  if (!meetingId) {
    return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 })
  }

  const agentRun = await startAgentRun({
    agentKey: 'manual-admin',
    runtime: 'manual',
    kind: 'meeting_lead_extraction',
    title: 'Extract lead fields from meeting',
    subject: {
      type: 'meeting_record',
      id: meetingId,
      label: `Meeting ${meetingId}`,
    },
    triggerSource: 'admin:meeting_extract_lead_fields',
    triggeredByUserId: auth.user.id,
    currentStep: 'Meeting extraction requested',
    metadata: {
      meeting_record_id: meetingId,
    },
  })
  const agentRunId = agentRun.id

  await recordAgentStep({
    runId: agentRunId,
    stepKey: 'meeting_extraction_requested',
    name: 'Meeting extraction requested',
    status: 'completed',
    outputSummary: `Prepared lead-field extraction for meeting ${meetingId}.`,
    metadata: { meeting_record_id: meetingId },
    idempotencyKey: `${agentRunId}:meeting_extraction_requested`,
  }).catch((err) => console.warn('[extract-lead-fields] agent step failed', err))

  try {
    const { meeting, extracted } = await extractLeadFieldsFromMeeting(meetingId, {
      agentRunId,
    })

    await endAgentRun({
      runId: agentRunId,
      status: 'completed',
      currentStep: 'Lead fields extracted',
      outcome: {
        meeting_record_id: meeting.id,
        extracted_fields: Object.keys(extracted),
      },
    }).catch((err) => console.warn('[extract-lead-fields] end agent run failed', err))

    return NextResponse.json({
      meeting: {
        id: meeting.id,
        meeting_type: meeting.meeting_type,
        meeting_date: meeting.meeting_date,
      },
      fields: extracted,
      agentRunId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed'
    console.error('[extract-lead-fields] Error:', message)
    await recordAgentStep({
      runId: agentRunId,
      stepKey: 'meeting_extraction_failed',
      name: 'Meeting lead extraction failed',
      status: 'failed',
      outputSummary: message,
      metadata: { meeting_record_id: meetingId },
      idempotencyKey: `${agentRunId}:meeting_extraction_failed`,
    }).catch((stepErr) => console.warn('[extract-lead-fields] agent failure step failed', stepErr))
    await markAgentRunFailed(agentRunId, message, {
      meeting_record_id: meetingId,
    }).catch((runErr) => console.warn('[extract-lead-fields] mark agent run failed', runErr))

    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    if (err instanceof LeadFromMeetingError && err.code === 'budget_blocked') {
      return NextResponse.json(
        { error: 'This meeting transcript is over the current Agent Ops budget limit. Shorten the transcript or split the extraction before retrying.' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Failed to extract lead fields from meeting transcript' }, { status: 500 })
  }
}
