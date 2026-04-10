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

/**
 * POST /api/admin/value-evidence/trigger
 * Manually trigger value evidence workflows.
 * Records run in value_evidence_workflow_runs for progress/last-run display.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const { workflow, maxResults, sources, contact_submission_id } = body

  const validWorkflows = ['internal_extraction', 'social_listening', 'social_listening_lead']
  if (!workflow || !validWorkflows.includes(workflow)) {
    return NextResponse.json(
      { error: `workflow must be one of: ${validWorkflows.join(', ')}` },
      { status: 400 }
    )
  }

  const VALID_SOURCES = ['reddit', 'google_maps', 'linkedin', 'g2', 'capterra']
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

    const scope: Record<string, unknown> = {}
    if (validMaxResults) scope.maxResults = validMaxResults
    if (validSources) scope.sources = validSources
    if (isSingleLead) {
      scope.mode = 'single_lead'
      if (contact_submission_id) scope.contact_submission_id = contact_submission_id
    }

    // Create run record for progress/last-run display
    const { data: run, error: insertError } = await supabaseAdmin
      .from('value_evidence_workflow_runs')
      .insert({
        workflow_id: workflowId,
        triggered_at: new Date().toISOString(),
        status: 'running',
        stages: Object.keys(scope).length > 0 ? { scope } : {},
      })
      .select('id')
      .single()

    if (insertError) {
      console.warn('value_evidence_workflow_runs insert failed (table may not exist):', insertError.message)
    }

    let result: { triggered: boolean; message: string }
    let leadContext: Record<string, unknown> | undefined

    if (isSingleLead && contact_submission_id) {
      const { data: lead } = await supabaseAdmin
        .from('contact_submissions')
        .select('company_name, industry, company_domain, rep_pain_points_freetext')
        .eq('id', contact_submission_id)
        .single()

      if (lead) {
        leadContext = {
          company: lead.company_name,
          industry: lead.industry,
          companyDomain: lead.company_domain,
          painPoints: lead.rep_pain_points_freetext,
        }
      }
    }

    if (workflow === 'internal_extraction') {
      result = await triggerValueEvidenceExtraction({ runId: run?.id })
    } else {
      result = await triggerSocialListening({
        runId: run?.id,
        maxResults: validMaxResults,
        sources: validSources,
        contactSubmissionId: isSingleLead ? contact_submission_id : undefined,
        leadContext,
      })
    }

    return NextResponse.json({ ...result, run_id: run?.id })
  } catch (error: any) {
    console.error('Trigger error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger workflow', details: error.message },
      { status: 500 }
    )
  }
}
