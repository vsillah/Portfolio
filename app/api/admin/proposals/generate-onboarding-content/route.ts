import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { generateAIOnboardingContent, type OnboardingGenerationInput } from '@/lib/ai-onboarding-generator'
import {
  endAgentRun,
  markAgentRunFailed,
  recordAgentStep,
  startAgentRun,
} from '@/lib/agent-run'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/proposals/generate-onboarding-content
 *
 * Called by ProposalModal when admin checks "Include Onboarding Preview".
 * Returns AI-generated onboarding content so admin can review/edit before
 * finalizing the proposal.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let agentRunId: string | null = null

  try {
    const body = await request.json()
    const {
      line_items,
      client_name,
      client_company,
      bundle_name,
      contact_submission_id,
      diagnostic_audit_id,
      value_report_id,
      gamma_report_id,
    } = body

    if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
      return NextResponse.json(
        { error: 'line_items array is required' },
        { status: 400 }
      )
    }

    const auditIdStr =
      typeof diagnostic_audit_id === 'string' && diagnostic_audit_id.trim()
        ? diagnostic_audit_id.trim()
        : undefined

    const input: OnboardingGenerationInput = {
      line_items,
      client_name,
      client_company,
      bundle_name,
      contact_submission_id: contact_submission_id ? Number(contact_submission_id) : undefined,
      diagnostic_audit_id: auditIdStr,
      value_report_id: value_report_id || undefined,
      gamma_report_id: gamma_report_id || undefined,
    }

    const agentRun = await startAgentRun({
      agentKey: 'proposal-business-model',
      runtime: 'manual',
      kind: 'generate_onboarding_content',
      title: 'Generate onboarding preview content',
      subject: {
        type: 'proposal',
        id: value_report_id || diagnostic_audit_id || contact_submission_id || 'draft',
        label: client_name || client_company || bundle_name || 'Draft proposal',
      },
      triggerSource: 'admin',
      triggeredByUserId: auth.user.id,
      currentStep: 'Assembling onboarding prompt',
      metadata: {
        operation: 'generate_onboarding_content',
        client_name: client_name ?? null,
        client_company: client_company ?? null,
        bundle_name: bundle_name ?? null,
        line_item_count: line_items.length,
        execution_mode: 'admin_preview',
        production_mutation_allowed: false,
      },
      idempotencyKey: `onboarding-content:${auth.user.id}:${Date.now()}`,
    })
    agentRunId = agentRun.id

    await recordAgentStep({
      runId: agentRunId,
      stepKey: 'input_validated',
      name: 'Validated onboarding generation input',
      status: 'completed',
      outputSummary: `Validated ${line_items.length} line item(s).`,
      metadata: {
        line_item_count: line_items.length,
        has_diagnostic_audit: Boolean(auditIdStr),
        has_value_report: Boolean(value_report_id),
        has_gamma_report: Boolean(gamma_report_id),
      },
      idempotencyKey: `${agentRunId}:input_validated`,
    }).catch((err) => console.warn('[generate-onboarding-content] agent step failed:', err))

    input.agentRunId = agentRunId
    const content = await generateAIOnboardingContent(input)

    await endAgentRun({
      runId: agentRunId,
      status: 'completed',
      currentStep: 'Onboarding content ready',
      outcome: {
        setup_requirements: content.setup_requirements.length,
        milestones: content.milestones.length,
        access_needs: content.access_needs.length,
        tools_and_platforms: content.tools_and_platforms.length,
        client_actions: content.client_actions.length,
      },
    })

    return NextResponse.json({ content, agent_run_id: agentRunId })
  } catch (error) {
    console.error('Generate onboarding content error:', error)
    if (agentRunId) {
      await markAgentRunFailed(
        agentRunId,
        error instanceof Error ? error.message : 'Failed to generate onboarding content',
        { operation: 'generate_onboarding_content' },
      ).catch((err) => console.warn('[generate-onboarding-content] mark failed:', err))
    }
    return NextResponse.json(
      { error: 'Failed to generate onboarding content' },
      { status: 500 }
    )
  }
}
