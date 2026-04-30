import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { attachAgentArtifact, endAgentRun, markAgentRunFailed, recordAgentStep } from '@/lib/agent-run'

export const dynamic = 'force-dynamic'

const VALID_SOURCES = ['facebook', 'google_contacts', 'linkedin'] as const

/**
 * POST /api/admin/outreach/run-complete
 * Called by n8n at the end of a warm lead workflow after a successful run (API call + ingest).
 * Records success so the next run will see "last run within 24h" and skip.
 * Auth: Bearer N8N_INGEST_SECRET (same as ingest).
 * Body: { source: "facebook" | "google_contacts" | "linkedin" }
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const expectedSecret = process.env.N8N_INGEST_SECRET
    const token = authHeader?.replace('Bearer ', '')

    if (!expectedSecret || token !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { source, agent_run_id, status: completionStatus, leads_inserted, error_message } = body as {
      source?: string
      agent_run_id?: string
      status?: string
      leads_inserted?: number
      error_message?: string
    }

    if (!source || !VALID_SOURCES.includes(source as (typeof VALID_SOURCES)[number])) {
      return NextResponse.json(
        { error: `source is required and must be one of: ${VALID_SOURCES.join(', ')}` },
        { status: 400 }
      )
    }

    const completedAt = new Date().toISOString()

    const status = completionStatus === 'failed' ? 'failed' : 'success'

    const { error } = await supabaseAdmin
      .from('warm_lead_trigger_audit')
      .insert({
        source,
        triggered_by: null,
        triggered_at: completedAt,
        options: {},
        status,
        leads_inserted: leads_inserted ?? null,
        error_message: error_message ?? null,
        completed_at: completedAt
      })

    if (error) {
      console.error('run-complete insert error:', error)
      return NextResponse.json(
        { error: 'Failed to record run complete' },
        { status: 500 }
      )
    }

    if (agent_run_id) {
      try {
        await recordAgentStep({
          runId: agent_run_id,
          stepKey: 'n8n_workflow_complete',
          name: status === 'failed' ? 'n8n workflow failed' : 'n8n workflow completed',
          status: status === 'failed' ? 'failed' : 'completed',
          outputSummary: error_message ?? `${leads_inserted ?? 0} lead(s) inserted`,
          metadata: {
            source,
            leads_inserted: leads_inserted ?? null,
          },
          idempotencyKey: `${agent_run_id}:complete:${source}`,
        })

        if (status === 'failed') {
          await markAgentRunFailed(agent_run_id, error_message ?? 'n8n workflow failed', {
            source,
            leads_inserted: leads_inserted ?? null,
          })
        } else {
          if (leads_inserted && leads_inserted > 0) {
            await attachAgentArtifact({
              runId: agent_run_id,
              artifactType: 'lead_import',
              title: `${leads_inserted} warm lead(s)`,
              refType: 'warm_lead_trigger_audit',
              refId: source,
              metadata: { source, leads_inserted },
              idempotencyKey: `${agent_run_id}:artifact:${source}`,
            })
          }
          await endAgentRun({
            runId: agent_run_id,
            status: 'completed',
            currentStep: 'Warm lead scrape complete',
            outcome: {
              source,
              leads_inserted: leads_inserted ?? null,
            },
          })
        }
      } catch (agentError) {
        console.warn('warm lead agent run update failed:', agentError)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Run complete recorded for source: ${source}`,
      agent_run_id: agent_run_id ?? null,
    })
  } catch (err) {
    console.error('run-complete error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
