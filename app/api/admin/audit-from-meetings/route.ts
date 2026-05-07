import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { saveDiagnosticAudit } from '@/lib/diagnostic'
import { AuditFromMeetingsError, buildDiagnosticFromMeetings } from '@/lib/audit-from-meetings'
import {
  endAgentRun,
  markAgentRunFailed,
  recordAgentStep,
  startAgentRun,
} from '@/lib/agent-run'

export const dynamic = 'force-dynamic'

function generateSessionId(contactId: number): string {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).substring(2, 12)
  return `meetings_${contactId}_${t}_${r}`
}

/**
 * POST /api/admin/audit-from-meetings
 * Build a diagnostic audit from meeting transcripts for a lead or project.
 * Body: { contact_submission_id?: number, client_project_id?: string } — exactly one required.
 * Resolves contact_submission_id from client_projects when only client_project_id is sent.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let agentRunId: string | null = null
  let failureMetadata: Record<string, unknown> = {}

  try {
    const body = await request.json().catch(() => ({}))
    const contactSubmissionId = body.contact_submission_id != null ? Number(body.contact_submission_id) : undefined
    const clientProjectId = typeof body.client_project_id === 'string' ? body.client_project_id.trim() || undefined : undefined
    const salesSessionId = typeof body.sales_session_id === 'string' ? body.sales_session_id.trim() || undefined : undefined

    const hasContact = contactSubmissionId != null && Number.isInteger(contactSubmissionId)
    const hasProject = !!clientProjectId

    if (hasContact && hasProject) {
      return NextResponse.json(
        { error: 'Provide either contact_submission_id or client_project_id, not both' },
        { status: 400 }
      )
    }
    if (!hasContact && !hasProject) {
      return NextResponse.json(
        { error: 'Provide contact_submission_id or client_project_id' },
        { status: 400 }
      )
    }

    let resolvedContactId: number
    if (hasContact) {
      resolvedContactId = contactSubmissionId as number
    } else {
      const { data: project, error: projectError } = await supabaseAdmin
        .from('client_projects')
        .select('contact_submission_id')
        .eq('id', clientProjectId)
        .single()

      if (projectError || !project) {
        return NextResponse.json(
          { error: 'Project not found or could not be loaded' },
          { status: 400 }
        )
      }
      const cid = project.contact_submission_id
      if (cid == null) {
        return NextResponse.json(
          { error: 'Project has no linked lead; cannot attach audit to a contact' },
          { status: 400 }
        )
      }
      resolvedContactId = cid
    }

    const agentRun = await startAgentRun({
      agentKey: 'manual-admin',
      runtime: 'manual',
      kind: 'audit_from_meetings',
      title: 'Build diagnostic audit from meetings',
      subject: {
        type: hasProject ? 'client_project' : 'contact_submission',
        id: hasProject ? clientProjectId : resolvedContactId,
        label: hasProject ? `Project ${clientProjectId}` : `Lead ${resolvedContactId}`,
      },
      triggerSource: 'admin:audit_from_meetings',
      triggeredByUserId: auth.user.id,
      currentStep: 'Audit extraction requested',
      metadata: {
        contact_submission_id: resolvedContactId,
        client_project_id: clientProjectId ?? null,
        sales_session_id: salesSessionId ?? null,
      },
    })
    agentRunId = agentRun.id
    failureMetadata = {
      contact_submission_id: resolvedContactId,
      client_project_id: clientProjectId ?? null,
      sales_session_id: salesSessionId ?? null,
    }

    await recordAgentStep({
      runId: agentRunId,
      stepKey: 'audit_extraction_requested',
      name: 'Audit extraction requested',
      status: 'completed',
      outputSummary: `Prepared audit-from-meetings extraction for lead ${resolvedContactId}.`,
      metadata: {
        contact_submission_id: resolvedContactId,
        client_project_id: clientProjectId ?? null,
        sales_session_id: salesSessionId ?? null,
      },
      idempotencyKey: `${agentRunId}:audit_extraction_requested`,
    }).catch((err) => console.warn('[audit-from-meetings] agent step failed', err))

    const { meetings, extracted } = await buildDiagnosticFromMeetings(
      hasContact ? (contactSubmissionId as number) : undefined,
      hasProject ? clientProjectId : undefined,
      { agentRunId },
    ).catch((err) => {
      const msg = err instanceof Error ? err.message : 'Failed to build audit from meetings'
      if (err instanceof AuditFromMeetingsError && err.code === 'budget_blocked') {
        throw Object.assign(err, { status: 400 })
      }
      if (msg.includes('No meetings') || msg.includes('No transcript')) {
        throw Object.assign(new Error(msg), { status: 400 })
      }
      if (msg.includes('exceeds') || msg.includes('Use fewer')) {
        throw Object.assign(new Error(msg), { status: 413 })
      }
      throw err
    })

    if (meetings.length === 0) {
      return NextResponse.json(
        { error: 'No meetings with transcript content found for this lead or project' },
        { status: 400 }
      )
    }

    const sessionId = generateSessionId(resolvedContactId)
    const { error: sessionError } = await supabaseAdmin
      .from('chat_sessions')
      .insert({
        session_id: sessionId,
        visitor_email: null,
        visitor_name: null,
      })

    if (sessionError) {
      console.error('audit-from-meetings: chat_sessions insert failed', sessionError)
      await markAgentRunFailed(agentRunId, 'Could not create audit session', {
        contact_submission_id: resolvedContactId,
        client_project_id: clientProjectId ?? null,
      }).catch((runErr) => console.warn('[audit-from-meetings] mark agent run failed', runErr))
      return NextResponse.json(
        { error: 'Could not create audit session' },
        { status: 500 }
      )
    }

    const result = await saveDiagnosticAudit(sessionId, {
      status: 'completed',
      auditType: 'from_meetings',
      contactSubmissionId: resolvedContactId,
      sourceMeetingIds: meetings.map((m) => m.id),
      diagnosticData: {
        business_challenges: extracted.business_challenges,
        tech_stack: extracted.tech_stack,
        automation_needs: extracted.automation_needs,
        ai_readiness: extracted.ai_readiness,
        budget_timeline: extracted.budget_timeline,
        decision_making: extracted.decision_making,
        diagnostic_summary: extracted.diagnostic_summary,
        key_insights: extracted.key_insights,
        recommended_actions: extracted.recommended_actions,
        urgency_score: extracted.urgency_score,
        opportunity_score: extracted.opportunity_score,
        sales_notes: extracted.sales_notes,
      },
    })

    if (result.error) {
      console.error('audit-from-meetings: saveDiagnosticAudit failed', result.error)
      await markAgentRunFailed(agentRunId, result.error.message || 'Could not save audit', {
        contact_submission_id: resolvedContactId,
        client_project_id: clientProjectId ?? null,
      }).catch((runErr) => console.warn('[audit-from-meetings] mark agent run failed', runErr))
      return NextResponse.json(
        { error: result.error.message || 'Could not save audit' },
        { status: 500 }
      )
    }

    if (salesSessionId) {
      const { error: linkError } = await supabaseAdmin
        .from('sales_sessions')
        .update({
          diagnostic_audit_id: result.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', salesSessionId)
      if (linkError) {
        console.error('audit-from-meetings: link to sales session failed', linkError)
      }
    }

    await endAgentRun({
      runId: agentRunId,
      status: 'completed',
      currentStep: 'Diagnostic audit ready',
      outcome: {
        audit_id: result.id,
        session_id: sessionId,
        contact_submission_id: resolvedContactId,
        client_project_id: clientProjectId ?? null,
        meetings_used: meetings.length,
      },
    }).catch((err) => console.warn('[audit-from-meetings] end agent run failed', err))

    return NextResponse.json({
      auditId: result.id,
      sessionId,
      meetingsUsed: meetings.length,
      agentRunId,
    })
  } catch (e) {
    const err = e as Error & { status?: number }
    const status = err.status
    if (agentRunId) {
      await recordAgentStep({
        runId: agentRunId,
        stepKey: 'audit_from_meetings_failed',
        name: 'Audit from meetings failed',
        status: 'failed',
        outputSummary: err.message || 'Audit from meetings failed',
        metadata: failureMetadata,
        idempotencyKey: `${agentRunId}:audit_from_meetings_failed`,
      }).catch((stepErr) => console.warn('[audit-from-meetings] agent failure step failed', stepErr))
      await markAgentRunFailed(agentRunId, err.message || 'Audit from meetings failed', failureMetadata)
        .catch((runErr) => console.warn('[audit-from-meetings] mark agent run failed', runErr))
    }
    if (err instanceof AuditFromMeetingsError && err.code === 'budget_blocked') {
      return NextResponse.json(
        { error: 'This meeting audit is over the current Agent Ops budget limit. Use fewer meetings or shorten the transcripts before retrying.' },
        { status: 400 }
      )
    }
    if (status === 400) {
      return NextResponse.json({ error: err.message || 'Bad request' }, { status: 400 })
    }
    if (status === 413) {
      return NextResponse.json({ error: err.message || 'Payload too large' }, { status: 413 })
    }
    console.error('audit-from-meetings error', e)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
