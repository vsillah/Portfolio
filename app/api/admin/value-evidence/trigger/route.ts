import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  triggerValueEvidenceExtraction,
  triggerSocialListening,
} from '@/lib/n8n'

export const dynamic = 'force-dynamic'

const WORKFLOW_MAP = {
  internal_extraction: 'vep001' as const,
  social_listening: 'vep002' as const,
}

const VALID_SOURCES = ['reddit', 'google_maps', 'linkedin', 'g2', 'capterra']
const VALID_SCOPE_TYPES = ['meeting', 'assessment', 'lead'] as const

interface ScopeContext {
  scopeLabel: string
  contactSubmissionId?: number
  leadContext?: Record<string, unknown>
  transcript?: string
}

async function buildScopeContext(
  scopeType: string,
  scopeId: string,
): Promise<ScopeContext | null> {
  if (scopeType === 'meeting') {
    const { data: meeting } = await supabaseAdmin
      .from('meeting_records')
      .select('id, meeting_type, meeting_date, transcript, structured_notes, contact_submission_id, key_decisions, risks_identified')
      .eq('id', scopeId)
      .single()
    if (!meeting) return null

    const notes = meeting.structured_notes as { summary?: string } | null
    const summary = notes?.summary || ''
    const dateStr = meeting.meeting_date
      ? new Date(meeting.meeting_date).toLocaleDateString([], { month: 'short', day: 'numeric' })
      : ''
    const scopeLabel = summary
      ? `${summary.substring(0, 60)}${summary.length > 60 ? '...' : ''}${dateStr ? ` — ${dateStr}` : ''}`
      : `${meeting.meeting_type || 'Meeting'}${dateStr ? ` — ${dateStr}` : ''}`

    const painPointsFromTranscript = [
      summary,
      meeting.transcript ? meeting.transcript.substring(0, 2000) : '',
    ].filter(Boolean).join('\n')

    let leadContext: Record<string, unknown> | undefined
    if (meeting.contact_submission_id) {
      const { data: lead } = await supabaseAdmin
        .from('contact_submissions')
        .select('company, industry, company_domain, rep_pain_points')
        .eq('id', meeting.contact_submission_id)
        .single()
      if (lead) {
        leadContext = {
          company: lead.company,
          industry: lead.industry,
          companyDomain: lead.company_domain,
          painPoints: [lead.rep_pain_points, painPointsFromTranscript].filter(Boolean).join('\n'),
        }
      }
    }
    if (!leadContext) {
      leadContext = { painPoints: painPointsFromTranscript }
    }

    return {
      scopeLabel,
      contactSubmissionId: meeting.contact_submission_id ?? undefined,
      leadContext,
      transcript: meeting.transcript ?? undefined,
    }
  }

  if (scopeType === 'assessment') {
    const { data: audit } = await supabaseAdmin
      .from('diagnostic_audits')
      .select('id, audit_type, created_at, diagnostic_summary, key_insights, business_challenges, contact_submission_id')
      .eq('id', scopeId)
      .single()
    if (!audit) return null

    const summary = (audit.diagnostic_summary as string) || ''
    const dateStr = audit.created_at
      ? new Date(audit.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
      : ''
    const scopeLabel = summary
      ? `${summary.substring(0, 60)}${summary.length > 60 ? '...' : ''}${dateStr ? ` — ${dateStr}` : ''}`
      : `${audit.audit_type || 'Assessment'}${dateStr ? ` — ${dateStr}` : ''}`

    const contextParts = [summary]
    if (audit.key_insights && Array.isArray(audit.key_insights)) {
      contextParts.push(audit.key_insights.join('. '))
    }
    if (audit.business_challenges && typeof audit.business_challenges === 'object') {
      contextParts.push(JSON.stringify(audit.business_challenges).substring(0, 1000))
    }

    let leadContext: Record<string, unknown> | undefined
    if (audit.contact_submission_id) {
      const { data: lead } = await supabaseAdmin
        .from('contact_submissions')
        .select('company, industry, company_domain, rep_pain_points')
        .eq('id', audit.contact_submission_id)
        .single()
      if (lead) {
        leadContext = {
          company: lead.company,
          industry: lead.industry,
          companyDomain: lead.company_domain,
          painPoints: [lead.rep_pain_points, ...contextParts].filter(Boolean).join('\n'),
        }
      }
    }
    if (!leadContext) {
      leadContext = { painPoints: contextParts.filter(Boolean).join('\n') }
    }

    return {
      scopeLabel,
      contactSubmissionId: audit.contact_submission_id ?? undefined,
      leadContext,
    }
  }

  if (scopeType === 'lead') {
    const { data: lead } = await supabaseAdmin
      .from('contact_submissions')
      .select('id, name, company, industry, company_domain, rep_pain_points')
      .eq('id', scopeId)
      .single()
    if (!lead) return null

    const scopeLabel = lead.company || lead.name || `Lead #${lead.id}`

    return {
      scopeLabel,
      contactSubmissionId: lead.id,
      leadContext: {
        company: lead.company,
        industry: lead.industry,
        companyDomain: lead.company_domain,
        painPoints: lead.rep_pain_points,
      },
    }
  }

  return null
}

/**
 * POST /api/admin/value-evidence/trigger
 * Manually trigger value evidence workflows.
 * Records run in value_evidence_workflow_runs for progress/last-run display.
 *
 * Supports targeted (scoped) runs via scope_type + scope_id.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const {
    workflow,
    maxResults,
    sources,
    contact_submission_id,
    scope_type,
    scope_id,
    phases,
  } = body

  const validWorkflows = ['internal_extraction', 'social_listening', 'social_listening_lead']
  if (!workflow || !validWorkflows.includes(workflow)) {
    return NextResponse.json(
      { error: `workflow must be one of: ${validWorkflows.join(', ')}` },
      { status: 400 }
    )
  }

  if (scope_type && !VALID_SCOPE_TYPES.includes(scope_type)) {
    return NextResponse.json(
      { error: `scope_type must be one of: ${VALID_SCOPE_TYPES.join(', ')}` },
      { status: 400 },
    )
  }

  const validSources: string[] | undefined =
    Array.isArray(sources) && sources.every((s: unknown) => typeof s === 'string' && VALID_SOURCES.includes(s as string))
      ? sources as string[]
      : undefined

  const isSingleLead = workflow === 'social_listening_lead'
  const workflowId = isSingleLead ? 'vep002' : WORKFLOW_MAP[workflow as keyof typeof WORKFLOW_MAP]

  try {
    const validMaxResults = typeof maxResults === 'number' && [5, 10, 20].includes(maxResults)
      ? maxResults
      : isSingleLead ? 5 : undefined

    // ── Targeted run: resolve scope context ──
    let scopeContext: ScopeContext | null = null
    if (scope_type && scope_id) {
      scopeContext = await buildScopeContext(scope_type, scope_id)
      if (!scopeContext) {
        return NextResponse.json(
          { error: `Could not find ${scope_type} with id ${scope_id}` },
          { status: 404 },
        )
      }
    }

    const validPhases: string[] | undefined =
      Array.isArray(phases) && phases.length > 0
        ? phases.filter((p: unknown) => p === 'internal' || p === 'social')
        : undefined

    const scope: Record<string, unknown> = {}
    if (validMaxResults) scope.maxResults = validMaxResults
    if (validSources) scope.sources = validSources
    if (isSingleLead) {
      scope.mode = 'single_lead'
      if (contact_submission_id) scope.contact_submission_id = contact_submission_id
    }
    if (scopeContext && validPhases) {
      scope.phases = validPhases
      if (validPhases.includes('internal') && validPhases.includes('social')) {
        scope.socialPending = true
      }
    }

    const insertData: Record<string, unknown> = {
      workflow_id: workflowId,
      triggered_at: new Date().toISOString(),
      status: 'running',
      stages: Object.keys(scope).length > 0 ? { scope } : {},
    }
    if (scopeContext) {
      insertData.scope_type = scope_type
      insertData.scope_id = scope_id
      insertData.scope_label = scopeContext.scopeLabel
    }

    const { data: run, error: insertError } = await supabaseAdmin
      .from('value_evidence_workflow_runs')
      .insert(insertData)
      .select('id')
      .single()

    if (insertError) {
      console.warn('value_evidence_workflow_runs insert failed (table may not exist):', insertError.message)
    }

    let result: { triggered: boolean; message: string }
    let leadContext: Record<string, unknown> | undefined = scopeContext?.leadContext

    // Legacy single-lead context fetch (non-scoped path)
    if (!scopeContext && isSingleLead && contact_submission_id) {
      const { data: lead } = await supabaseAdmin
        .from('contact_submissions')
        .select('company, industry, company_domain, rep_pain_points')
        .eq('id', contact_submission_id)
        .single()

      if (lead) {
        leadContext = {
          company: lead.company,
          industry: lead.industry,
          companyDomain: lead.company_domain,
          painPoints: lead.rep_pain_points,
        }
      }
    }

    const runInternal = !validPhases || validPhases.includes('internal')
    const runSocial = !validPhases || validPhases.includes('social')

    if (workflow === 'internal_extraction') {
      const opts: { runId?: string; contactSubmissionIds?: number[] } = { runId: run?.id }
      if (scopeContext?.contactSubmissionId) {
        opts.contactSubmissionIds = [scopeContext.contactSubmissionId]
      }
      result = await triggerValueEvidenceExtraction(opts)
    } else if (scopeContext && runSocial && !runInternal) {
      // Targeted social-only: use scope's leadContext
      result = await triggerSocialListening({
        runId: run?.id,
        maxResults: validMaxResults,
        sources: validSources,
        contactSubmissionId: scopeContext.contactSubmissionId,
        leadContext,
      })
    } else {
      result = await triggerSocialListening({
        runId: run?.id,
        maxResults: validMaxResults,
        sources: validSources,
        contactSubmissionId: isSingleLead ? contact_submission_id : scopeContext?.contactSubmissionId,
        leadContext,
      })
    }

    return NextResponse.json({ ...result, run_id: run?.id })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Trigger error:', message)
    return NextResponse.json(
      { error: 'Failed to trigger workflow' },
      { status: 500 }
    )
  }
}
