import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { triggerSocialListening } from '@/lib/n8n'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/value-evidence/workflow-complete
 * Called by n8n at the end of a run.
 * Auth: Bearer N8N_INGEST_SECRET.
 * Body: { run_id?: string, workflow_id: 'vep001'|'vep002', status: 'success'|'failed', items_inserted?: number, error_message?: string }
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  const expectedSecret = process.env.N8N_INGEST_SECRET

  if (!expectedSecret || token !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { run_id, workflow_id, status: completionStatus, items_inserted, error_message } = body as {
      run_id?: string
      workflow_id?: string
      status?: string
      items_inserted?: number
      error_message?: string
    }

    if (!workflow_id) {
      return NextResponse.json(
        { error: 'workflow_id is required' },
        { status: 400 }
      )
    }

    const wf = workflow_id === 'WF-VEP-001' ? 'vep001' : workflow_id === 'WF-VEP-002' ? 'vep002' : workflow_id
    if (wf !== 'vep001' && wf !== 'vep002') {
      return NextResponse.json(
        { error: 'workflow_id must be vep001, vep002, WF-VEP-001, or WF-VEP-002' },
        { status: 400 }
      )
    }

    const status = completionStatus === 'failed' ? 'failed' : 'success'

    // Find run — fetch full record for auto-chain logic
    let run: { id: string; stages: Record<string, unknown> | null; scope_type: string | null; scope_id: string | null; scope_label: string | null } | null = null
    if (run_id) {
      const { data } = await supabaseAdmin
        .from('value_evidence_workflow_runs')
        .select('id, stages, scope_type, scope_id, scope_label')
        .eq('id', run_id)
        .single()
      run = data
    }
    if (!run) {
      const { data } = await supabaseAdmin
        .from('value_evidence_workflow_runs')
        .select('id, stages, scope_type, scope_id, scope_label')
        .eq('workflow_id', wf)
        .eq('status', 'running')
        .order('triggered_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      run = data
    }

    if (!run) {
      const { data: created } = await supabaseAdmin
        .from('value_evidence_workflow_runs')
        .insert({ workflow_id: wf, status: 'running' })
        .select('id, stages, scope_type, scope_id, scope_label')
        .single()
      run = created
    }

    if (!run) {
      return NextResponse.json(
        { error: 'Unable to resolve or create run record', ok: false },
        { status: 500 }
      )
    }

    const completedAt = new Date().toISOString()
    const update: Record<string, unknown> = {
      status,
      completed_at: completedAt,
      updated_at: completedAt,
    }
    if (items_inserted !== undefined && items_inserted !== null) {
      update.items_inserted = items_inserted
    }
    if (error_message !== undefined && error_message !== null) {
      update.error_message = error_message
    }

    // Auto-chain: if VEP-001 completed successfully for a targeted run with socialPending, trigger VEP-002
    const runScope = (run.stages as Record<string, unknown> | null)?.scope as Record<string, unknown> | undefined
    const shouldChainSocial =
      wf === 'vep001' &&
      status === 'success' &&
      runScope?.socialPending === true

    if (shouldChainSocial) {
      // Mark socialPending as false and keep running for the social phase
      const updatedStages = { ...(run.stages || {}), scope: { ...runScope, socialPending: false, socialTriggered: true } }
      update.stages = updatedStages
      update.status = 'running'
      update.completed_at = null
      update.workflow_id = 'vep002'
    }

    const { error } = await supabaseAdmin
      .from('value_evidence_workflow_runs')
      .update(update)
      .eq('id', run.id)

    if (error) {
      console.error('workflow-complete update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fire social phase if auto-chaining
    if (shouldChainSocial && run.scope_type && run.scope_id) {
      const socialSources = runScope?.sources as string[] | undefined
      const socialMaxResults = runScope?.maxResults as number | undefined

      let leadContext: Record<string, unknown> | undefined
      let contactSubmissionId: number | undefined

      if (run.scope_type === 'meeting') {
        const { data: meeting } = await supabaseAdmin
          .from('meeting_records')
          .select('transcript, structured_notes, contact_submission_id')
          .eq('id', run.scope_id)
          .single()
        if (meeting) {
          contactSubmissionId = meeting.contact_submission_id ?? undefined
          const notes = meeting.structured_notes as { summary?: string } | null
          const painText = [notes?.summary, meeting.transcript?.substring(0, 2000)].filter(Boolean).join('\n')
          if (contactSubmissionId) {
            const { data: lead } = await supabaseAdmin
              .from('contact_submissions')
              .select('company, industry, company_domain, rep_pain_points')
              .eq('id', contactSubmissionId)
              .single()
            if (lead) {
              leadContext = {
                company: lead.company,
                industry: lead.industry,
                companyDomain: lead.company_domain,
                painPoints: [lead.rep_pain_points, painText].filter(Boolean).join('\n'),
              }
            }
          }
          if (!leadContext) leadContext = { painPoints: painText }
        }
      } else if (run.scope_type === 'assessment') {
        const { data: audit } = await supabaseAdmin
          .from('diagnostic_audits')
          .select('diagnostic_summary, key_insights, contact_submission_id')
          .eq('id', run.scope_id)
          .single()
        if (audit) {
          contactSubmissionId = audit.contact_submission_id ?? undefined
          const painText = [audit.diagnostic_summary, ...(Array.isArray(audit.key_insights) ? audit.key_insights : [])].filter(Boolean).join('\n')
          if (contactSubmissionId) {
            const { data: lead } = await supabaseAdmin
              .from('contact_submissions')
              .select('company, industry, company_domain, rep_pain_points')
              .eq('id', contactSubmissionId)
              .single()
            if (lead) {
              leadContext = {
                company: lead.company,
                industry: lead.industry,
                companyDomain: lead.company_domain,
                painPoints: [lead.rep_pain_points, painText].filter(Boolean).join('\n'),
              }
            }
          }
          if (!leadContext) leadContext = { painPoints: painText }
        }
      } else if (run.scope_type === 'lead') {
        const numericId = Number(run.scope_id)
        if (!isNaN(numericId)) {
          contactSubmissionId = numericId
          const { data: lead } = await supabaseAdmin
            .from('contact_submissions')
            .select('company, industry, company_domain, rep_pain_points')
            .eq('id', numericId)
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
      }

      triggerSocialListening({
        runId: run.id,
        maxResults: socialMaxResults,
        sources: socialSources,
        contactSubmissionId,
        leadContext,
      }).catch(e => console.error('Auto-chain social trigger failed:', e))
    }

    // Slack notification (non-blocking) — skip if auto-chaining (will notify on final completion)
    if (!shouldChainSocial) {
      const slackUrl = process.env.SLACK_VEP_NOTIFICATION_WEBHOOK_URL
      if (slackUrl) {
        const wfLabel = wf === 'vep001' ? 'Internal Evidence' : 'Social Listening'
        const emoji = status === 'success' ? ':white_check_mark:' : ':x:'
        const itemsText = items_inserted != null ? `${items_inserted} items` : 'N/A'
        const slackMsg = {
          text: `${emoji} VEP *${wfLabel}* ${status}. Items: ${itemsText}.${error_message ? ` Error: ${error_message}` : ''}\n<${process.env.PORTFOLIO_BASE_URL || 'https://amadutown.com'}/admin/value-evidence?tab=dashboard|Open Dashboard>`,
        }
        fetch(slackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackMsg),
        }).catch(e => console.error('Slack VEP notification failed:', e))
      }
    }

    return NextResponse.json({ ok: true, run_id: run.id, chained_social: shouldChainSocial })
  } catch (err) {
    console.error('workflow-complete error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
