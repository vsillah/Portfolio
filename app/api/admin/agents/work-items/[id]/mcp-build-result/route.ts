import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { recordAgentWorkItemMcpBuildResult } from '@/lib/agent-work-items'

export const dynamic = 'force-dynamic'

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function optionalString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const resultSummary = optionalString(body.result_summary)
  if (!resultSummary) {
    return NextResponse.json({ error: 'result_summary is required' }, { status: 400 })
  }

  try {
    const work_item = await recordAgentWorkItemMcpBuildResult({
      id: params.id,
      resultSummary,
      workflowId: optionalString(body.workflow_id) || null,
      inspectionResult: optionalString(body.inspection_result) || null,
      validationResult: optionalString(body.validation_result) || null,
      testEvidence: optionalString(body.test_evidence) || null,
      credentialGaps: stringArray(body.credential_gaps),
      envGaps: stringArray(body.env_gaps),
      rollbackNotes: optionalString(body.rollback_notes) || null,
      activationRequested: body.activation_requested === true,
      actorLabel: auth.user.email,
    })
    return NextResponse.json({ ok: true, work_item })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record MCP build result'
    const status = message === 'Agent work item not found' ? 404 : 500
    console.error('[agent-work-item-mcp-build-result] failed:', error)
    return NextResponse.json({ error: message }, { status })
  }
}
