import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { triggerSocialListening } from '@/lib/n8n'
import { attachAgentArtifact, endAgentRun, markAgentRunFailed, recordAgentStep } from '@/lib/agent-run'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/value-evidence/workflow-complete
 * Called by n8n at the end of a run.
 * Auth: Bearer N8N_INGEST_SECRET.
 * Body: { run_id?: string, workflow_id: 'vep001'|'vep002', status: 'success'|'failed', items_inserted?: number, error_message?: string, contact_submission_ids?: number[] }
 *
 * When `contact_submission_ids` is present, any of those leads still in
 * `last_vep_status = 'pending'` are flipped to `success` (if the run ended
 * successfully — even with 0 items inserted) or `failed` (if n8n reported an
 * error). Without this, zero-evidence success paths leave leads stuck in
 * `pending` forever (see audit in .cursor/rules/n8n-dev-stag-webhook-routing.mdc).
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
    const {
      run_id,
      agent_run_id,
      workflow_id,
      status: completionStatus,
      items_inserted,
      error_message,
      contact_submission_ids,
    } = body as {
      run_id?: string
      agent_run_id?: string
      workflow_id?: string
      status?: string
      items_inserted?: number
      error_message?: string
      contact_submission_ids?: unknown
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

    // Flip `contact_submissions.last_vep_status` for in-scope leads that are
    // still `pending`. Only VEP-001 owns this signal (VEP-002 is a secondary
    // pipeline; its per-lead status is derived elsewhere). Skip during
    // auto-chaining — the run is still in-flight (workflow_id was flipped to
    // vep002 above), so leave leads pending until the final social callback.
    if (wf === 'vep001' && !shouldChainSocial) {
      const rawIds = Array.isArray(contact_submission_ids) ? contact_submission_ids : []
      const ids = rawIds
        .map((v) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN))
        .filter((n) => Number.isFinite(n) && n > 0) as number[]

      if (ids.length > 0) {
        const newStatus = status === 'failed' ? 'failed' : 'success'
        const { error: statusErr } = await supabaseAdmin
          .from('contact_submissions')
          .update({ last_vep_status: newStatus })
          .in('id', ids)
          .eq('last_vep_status', 'pending')
        if (statusErr) {
          console.warn('workflow-complete last_vep_status update error:', statusErr.message)
        }
      }
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
        agentRunId: agent_run_id,
        maxResults: socialMaxResults,
        sources: socialSources,
        contactSubmissionId,
        leadContext,
      }).catch(e => console.error('Auto-chain social trigger failed:', e))
    }

    if (agent_run_id) {
      try {
        await recordAgentStep({
          runId: agent_run_id,
          stepKey: `n8n_${wf}_complete`,
          name: shouldChainSocial
            ? 'Internal evidence phase completed'
            : status === 'failed'
            ? 'n8n workflow failed'
            : 'n8n workflow completed',
          status: status === 'failed' ? 'failed' : 'completed',
          outputSummary: error_message ?? `${items_inserted ?? 0} item(s) inserted`,
          metadata: {
            workflow_id: wf,
            legacy_run_id: run.id,
            items_inserted: items_inserted ?? null,
            chained_social: shouldChainSocial,
          },
          idempotencyKey: `${agent_run_id}:${wf}:complete:${run.id}`,
        })

        if (!shouldChainSocial && items_inserted && items_inserted > 0) {
          await attachAgentArtifact({
            runId: agent_run_id,
            artifactType: 'value_evidence',
            title: `${items_inserted} value evidence item(s)`,
            refType: 'value_evidence_workflow_run',
            refId: run.id,
            metadata: { workflow_id: wf, items_inserted },
            idempotencyKey: `${agent_run_id}:artifact:${run.id}`,
          })
        }

        if (!shouldChainSocial) {
          if (status === 'failed') {
            await markAgentRunFailed(agent_run_id, error_message ?? 'n8n workflow failed', {
              workflow_id: wf,
              legacy_run_id: run.id,
              items_inserted: items_inserted ?? null,
            })
          } else {
            await endAgentRun({
              runId: agent_run_id,
              status: 'completed',
              currentStep: 'Value evidence workflow complete',
              outcome: {
                workflow_id: wf,
                legacy_run_id: run.id,
                items_inserted: items_inserted ?? null,
              },
            })
          }
        }
      } catch (agentError) {
        console.warn('value-evidence agent run update failed:', agentError)
      }
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

    return NextResponse.json({ ok: true, run_id: run.id, agent_run_id: agent_run_id ?? null, chained_social: shouldChainSocial })
  } catch (err) {
    console.error('workflow-complete error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
