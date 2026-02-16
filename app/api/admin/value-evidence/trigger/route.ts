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
  const { workflow } = body

  if (!workflow || !['internal_extraction', 'social_listening'].includes(workflow)) {
    return NextResponse.json(
      { error: 'workflow must be "internal_extraction" or "social_listening"' },
      { status: 400 }
    )
  }

  const workflowId = WORKFLOW_MAP[workflow as keyof typeof WORKFLOW_MAP]

  try {
    // Create run record for progress/last-run display
    const { data: run, error: insertError } = await supabaseAdmin
      .from('value_evidence_workflow_runs')
      .insert({
        workflow_id: workflowId,
        triggered_at: new Date().toISOString(),
        status: 'running',
        stages: {},
      })
      .select('id')
      .single()

    if (insertError) {
      console.warn('value_evidence_workflow_runs insert failed (table may not exist):', insertError.message)
      // Continue - run tracking is optional
    }

    let result: { triggered: boolean; message: string }

    if (workflow === 'internal_extraction') {
      result = await triggerValueEvidenceExtraction({ runId: run?.id })
    } else {
      result = await triggerSocialListening({ runId: run?.id })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Trigger error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger workflow', details: error.message },
      { status: 500 }
    )
  }
}
