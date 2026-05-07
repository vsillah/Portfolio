import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { recordOpenAICost, type Usage } from '@/lib/cost-calculator'
import {
  endAgentRun,
  markAgentRunFailed,
  recordAgentStep,
  startAgentRun,
} from '@/lib/agent-run'
import {
  evaluateInPersonDiagnosticInsightsBudget,
  IN_PERSON_DIAGNOSTIC_INSIGHTS_MAX_TOKENS,
  IN_PERSON_DIAGNOSTIC_INSIGHTS_MODEL,
  IN_PERSON_DIAGNOSTIC_INSIGHTS_OPERATION,
  InPersonDiagnosticInsightsError,
  recordInPersonDiagnosticInsightsBudgetDecision,
} from '@/lib/in-person-diagnostic-insights'
import { fetchProviderWithRetry } from '@/lib/llm/provider-fetch'

export const dynamic = 'force-dynamic'

const IN_PERSON_DIAGNOSTIC_SYSTEM_PROMPT = 'You are a sales intelligence analyst. Respond only with valid JSON.'

/**
 * POST /api/admin/sales/in-person-diagnostic/generate-insights
 * Use AI to generate insights, scores, and recommendations from
 * in-person diagnostic data filled in by the sales rep.
 */
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request)
  if (isAuthError(admin)) {
    return NextResponse.json({ error: admin.error }, { status: admin.status })
  }

  let agentRunId: string | null = null
  let auditId: string | null = null

  try {
    const body = await request.json()
    const { audit_id, client_name, client_company, diagnostic_data } = body

    if (!audit_id || !diagnostic_data) {
      return NextResponse.json({ error: 'audit_id and diagnostic_data are required' }, { status: 400 })
    }
    auditId = audit_id

    const agentRun = await startAgentRun({
      agentKey: 'manual-admin',
      runtime: 'manual',
      kind: 'in_person_diagnostic_insights',
      title: 'Generate in-person diagnostic insights',
      subject: {
        type: 'diagnostic_audit',
        id: audit_id,
        label: client_company || client_name || `Diagnostic audit ${audit_id}`,
      },
      triggerSource: 'admin:in_person_diagnostic_generate_insights',
      triggeredByUserId: admin.user.id,
      currentStep: 'In-person diagnostic request validated',
      metadata: {
        has_client_name: !!client_name,
        has_client_company: !!client_company,
        diagnostic_section_count: typeof diagnostic_data === 'object' && diagnostic_data
          ? Object.keys(diagnostic_data).length
          : 0,
      },
    })
    agentRunId = agentRun.id

    await recordAgentStep({
      runId: agentRunId,
      stepKey: 'in_person_diagnostic_request_validated',
      name: 'In-person diagnostic request validated',
      status: 'completed',
      metadata: {
        audit_id,
        has_client_name: !!client_name,
        has_client_company: !!client_company,
      },
      idempotencyKey: `${agentRunId}:in_person_diagnostic_request_validated`,
    }).catch((err) => console.warn('[generate-insights] agent validation step failed:', err))

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new InPersonDiagnosticInsightsError('OPENAI_API_KEY is not configured', 'openai_not_configured')
    }

    // Build a prompt from the diagnostic data
    const sections: string[] = []
    if (diagnostic_data.business_challenges && Object.keys(diagnostic_data.business_challenges).length > 0) {
      sections.push(`Business Challenges: ${JSON.stringify(diagnostic_data.business_challenges)}`)
    }
    if (diagnostic_data.tech_stack && Object.keys(diagnostic_data.tech_stack).length > 0) {
      sections.push(`Tech Stack: ${JSON.stringify(diagnostic_data.tech_stack)}`)
    }
    if (diagnostic_data.automation_needs && Object.keys(diagnostic_data.automation_needs).length > 0) {
      sections.push(`Automation Needs: ${JSON.stringify(diagnostic_data.automation_needs)}`)
    }
    if (diagnostic_data.ai_readiness && Object.keys(diagnostic_data.ai_readiness).length > 0) {
      sections.push(`AI Readiness: ${JSON.stringify(diagnostic_data.ai_readiness)}`)
    }
    if (diagnostic_data.budget_timeline && Object.keys(diagnostic_data.budget_timeline).length > 0) {
      sections.push(`Budget & Timeline: ${JSON.stringify(diagnostic_data.budget_timeline)}`)
    }
    if (diagnostic_data.decision_making && Object.keys(diagnostic_data.decision_making).length > 0) {
      sections.push(`Decision Making: ${JSON.stringify(diagnostic_data.decision_making)}`)
    }

    const prompt = `You are a sales intelligence analyst. Based on the following diagnostic data gathered during an in-person sales conversation${client_name ? ` with ${client_name}` : ''}${client_company ? ` from ${client_company}` : ''}, generate:

1. A brief diagnostic summary (2-3 sentences)
2. 3-5 key insights about this prospect
3. 3-5 recommended next actions for the sales team
4. An urgency score (1-10, where 10 is most urgent)
5. An opportunity score (1-10, where 10 is highest opportunity)

Diagnostic Data:
${sections.join('\n')}

Respond in JSON format:
{
  "diagnostic_summary": "...",
  "key_insights": ["...", "..."],
  "recommended_actions": ["...", "..."],
  "urgency_score": 7,
  "opportunity_score": 8,
  "sales_notes": "Brief note about the overall sales opportunity"
}`

    const budgetDecision = evaluateInPersonDiagnosticInsightsBudget({
      systemPrompt: IN_PERSON_DIAGNOSTIC_SYSTEM_PROMPT,
      userPrompt: prompt,
      model: IN_PERSON_DIAGNOSTIC_INSIGHTS_MODEL,
      maxTokens: IN_PERSON_DIAGNOSTIC_INSIGHTS_MAX_TOKENS,
    })
    await recordInPersonDiagnosticInsightsBudgetDecision({
      agentRunId,
      auditId: audit_id,
      decision: budgetDecision,
    })
    if (budgetDecision.status === 'blocked') {
      throw new InPersonDiagnosticInsightsError(budgetDecision.reason, 'budget_blocked')
    }

    const response = await fetchProviderWithRetry('openai', 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: IN_PERSON_DIAGNOSTIC_INSIGHTS_MODEL,
        messages: [
          { role: 'system', content: IN_PERSON_DIAGNOSTIC_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: IN_PERSON_DIAGNOSTIC_INSIGHTS_MAX_TOKENS,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('OpenAI API error:', errText)
      throw new InPersonDiagnosticInsightsError('AI generation failed', 'openai_upstream')
    }

    const aiResult = await response.json()
    const content = aiResult.choices?.[0]?.message?.content
    const usage = aiResult.usage as Usage | undefined
    if (usage) {
      recordOpenAICost(
        usage,
        IN_PERSON_DIAGNOSTIC_INSIGHTS_MODEL,
        { type: 'diagnostic_audit', id: audit_id },
        {
          operation: IN_PERSON_DIAGNOSTIC_INSIGHTS_OPERATION,
          budget_status: budgetDecision.status,
          budget_rule_key: budgetDecision.rule.key,
          budget_estimated_cost_usd: budgetDecision.estimatedCostUsd,
        },
        agentRunId,
      ).catch(() => {})
    }
    if (!content) {
      throw new InPersonDiagnosticInsightsError('No AI response', 'invalid_response')
    }

    let parsed: {
      diagnostic_summary?: string
      key_insights?: string[]
      recommended_actions?: string[]
      urgency_score?: number
      opportunity_score?: number
      sales_notes?: string
    }
    try {
      parsed = JSON.parse(content)
    } catch {
      console.error('Failed to parse AI response:', content)
      throw new InPersonDiagnosticInsightsError('Failed to parse AI response', 'invalid_response')
    }

    // Update the diagnostic audit with generated insights
    const { error: updateError } = await supabaseAdmin
      .from('diagnostic_audits')
      .update({
        diagnostic_summary: parsed.diagnostic_summary || null,
        key_insights: parsed.key_insights || [],
        recommended_actions: parsed.recommended_actions || [],
        urgency_score: parsed.urgency_score || null,
        opportunity_score: parsed.opportunity_score || null,
        sales_notes: parsed.sales_notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', audit_id)

    if (updateError) {
      console.error('Failed to update audit with insights:', updateError)
      // Non-fatal: return the insights even if save failed
    }

    await endAgentRun({
      runId: agentRunId,
      status: 'completed',
      currentStep: 'In-person diagnostic insights ready',
      outcome: {
        audit_id,
        insight_count: parsed.key_insights?.length ?? 0,
        action_count: parsed.recommended_actions?.length ?? 0,
        urgency_score: parsed.urgency_score ?? null,
        opportunity_score: parsed.opportunity_score ?? null,
        persisted: !updateError,
      },
    }).catch((err) => console.warn('[generate-insights] end agent run failed:', err))

    return NextResponse.json({
      summary: parsed.diagnostic_summary,
      insights: parsed.key_insights || [],
      actions: parsed.recommended_actions || [],
      urgency_score: parsed.urgency_score,
      opportunity_score: parsed.opportunity_score,
      sales_notes: parsed.sales_notes,
      agentRunId,
    })
  } catch (error) {
    console.error('Generate insights API error:', error)
    const message = error instanceof Error ? error.message : String(error)
    if (agentRunId) {
      await recordAgentStep({
        runId: agentRunId,
        stepKey: 'in_person_diagnostic_insights_failed',
        name: 'In-person diagnostic insights failed',
        status: 'failed',
        outputSummary: message,
        idempotencyKey: `${agentRunId}:in_person_diagnostic_insights_failed`,
      }).catch((stepErr) => console.warn('[generate-insights] agent failure step failed:', stepErr))
      await markAgentRunFailed(agentRunId, message, {
        operation: IN_PERSON_DIAGNOSTIC_INSIGHTS_OPERATION,
        audit_id: auditId,
      }).catch((runErr) => console.warn('[generate-insights] mark agent run failed:', runErr))
    }

    if (error instanceof InPersonDiagnosticInsightsError) {
      return NextResponse.json(
        { error: safeInPersonDiagnosticInsightsErrorMessage(error), agentRunId },
        { status: inPersonDiagnosticInsightsErrorStatus(error) },
      )
    }

    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}

function safeInPersonDiagnosticInsightsErrorMessage(error: InPersonDiagnosticInsightsError): string {
  if (error.code === 'budget_blocked') {
    return 'This in-person diagnostic insight request is over the current Agent Ops budget limit. Shorten the diagnostic notes before retrying.'
  }
  if (error.code === 'openai_not_configured') {
    return 'OpenAI API key not configured'
  }
  if (error.code === 'openai_upstream') {
    return 'AI generation failed'
  }
  if (error.code === 'invalid_response') {
    return 'The AI returned an invalid insight response. Try generating again or reduce the diagnostic notes.'
  }
  return 'Failed to generate insights'
}

function inPersonDiagnosticInsightsErrorStatus(error: InPersonDiagnosticInsightsError): number {
  if (error.code === 'budget_blocked') return 400
  if (error.code === 'openai_not_configured') return 503
  if (error.code === 'openai_upstream' || error.code === 'invalid_response') return 502
  return 500
}
