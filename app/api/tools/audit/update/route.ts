import { NextRequest, NextResponse } from 'next/server'
import { getDiagnosticAudit, saveDiagnosticAudit } from '@/lib/diagnostic'
import { AUDIT_CATEGORY_ORDER, categoryFormToPayload } from '@/lib/audit-questions'
import type { DiagnosticCategory } from '@/lib/n8n'

export const dynamic = 'force-dynamic'

/**
 * Compute simple urgency (0-10) and opportunity (0-10) from audit data for display.
 * Same conceptual scores as chat/n8n diagnostic; heuristic for standalone form.
 */
function computeScores(payload: {
  budget_timeline?: Record<string, unknown>
  decision_making?: Record<string, unknown>
  automation_needs?: Record<string, unknown>
  ai_readiness?: Record<string, unknown>
}): { urgency_score: number; opportunity_score: number } {
  let urgency = 5
  let opportunity = 5

  const budget = payload.budget_timeline as Record<string, unknown> | undefined
  if (budget?.budget_range === 'large' || budget?.budget_range === 'medium') {
    opportunity += 2
  }
  if (budget?.budget_range === 'none' || budget?.budget_range === 'small') {
    opportunity -= 1
  }

  const decision = payload.decision_making as Record<string, unknown> | undefined
  if (decision?.decision_maker === true) {
    urgency += 1
    opportunity += 1
  }

  const auto = payload.automation_needs as Record<string, unknown> | undefined
  const priorityAreas = (auto?.priority_areas as string[] | undefined) || []
  if (priorityAreas.length >= 2) {
    opportunity += 1
  }

  const ai = payload.ai_readiness as Record<string, unknown> | undefined
  if (ai?.data_quality === 'ready' || ai?.team_readiness === 'scaling') {
    opportunity += 1
  }

  urgency = Math.max(0, Math.min(10, urgency))
  opportunity = Math.max(0, Math.min(10, opportunity))
  return { urgency_score: urgency, opportunity_score: opportunity }
}

function buildSummary(payload: Record<string, Record<string, unknown>>): string {
  const parts: string[] = []
  if (Object.keys(payload.business_challenges || {}).length > 0) {
    parts.push('Business challenges and pain points captured.')
  }
  if (Object.keys(payload.tech_stack || {}).length > 0) {
    parts.push('Current tech stack and integration readiness noted.')
  }
  if (Object.keys(payload.automation_needs || {}).length > 0) {
    parts.push('Automation priorities and desired outcomes identified.')
  }
  if (Object.keys(payload.ai_readiness || {}).length > 0) {
    parts.push('AI readiness and data/team context captured.')
  }
  if (Object.keys(payload.budget_timeline || {}).length > 0) {
    parts.push('Budget and timeline preferences recorded.')
  }
  if (Object.keys(payload.decision_making || {}).length > 0) {
    parts.push('Decision-making process and stakeholders noted.')
  }
  return parts.length > 0
    ? parts.join(' ')
    : 'Standalone AI/automation audit completed. Review the category details for next steps.'
}

/**
 * PUT /api/tools/audit/update
 * Body: { auditId: string, category: DiagnosticCategory, values: Record<string, string | string[] | boolean> }
 * Merges the category payload into the audit. If all 6 categories are present, marks completed and sets summary + scores.
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { auditId, category, values } = body as {
      auditId?: string
      category?: string
      values?: Record<string, string | string[] | boolean>
    }

    if (!auditId || !category || !values || typeof values !== 'object') {
      return NextResponse.json(
        { error: 'auditId, category, and values are required' },
        { status: 400 }
      )
    }

    const validCategories: DiagnosticCategory[] = AUDIT_CATEGORY_ORDER
    if (!validCategories.includes(category as DiagnosticCategory)) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      )
    }

    const auditResult = await getDiagnosticAudit(auditId)
    if (!auditResult.data) {
      return NextResponse.json(
        { error: 'Audit not found' },
        { status: 404 }
      )
    }

    const categoryPayload = categoryFormToPayload(category as DiagnosticCategory, values)
    if (Object.keys(categoryPayload).length === 0) {
      return NextResponse.json(
        { error: 'No valid values for this category' },
        { status: 400 }
      )
    }

    const existing = auditResult.data
    const existingData: Record<string, Record<string, unknown>> = {
      business_challenges: (existing.business_challenges as Record<string, unknown>) || {},
      tech_stack: (existing.tech_stack as Record<string, unknown>) || {},
      automation_needs: (existing.automation_needs as Record<string, unknown>) || {},
      ai_readiness: (existing.ai_readiness as Record<string, unknown>) || {},
      budget_timeline: (existing.budget_timeline as Record<string, unknown>) || {},
      decision_making: (existing.decision_making as Record<string, unknown>) || {},
    }

    existingData[category] = { ...existingData[category], ...categoryPayload }

    const allCategoriesPresent = AUDIT_CATEGORY_ORDER.every(
      (c) => existingData[c] && Object.keys(existingData[c]).length > 0
    )

    const diagnosticData: Parameters<typeof saveDiagnosticAudit>[1]['diagnosticData'] = {
      business_challenges: existingData.business_challenges,
      tech_stack: existingData.tech_stack,
      automation_needs: existingData.automation_needs,
      ai_readiness: existingData.ai_readiness,
      budget_timeline: existingData.budget_timeline,
      decision_making: existingData.decision_making,
    }

    if (allCategoriesPresent) {
      const { urgency_score, opportunity_score } = computeScores(existingData)
      diagnosticData.diagnostic_summary = buildSummary(existingData)
      diagnosticData.urgency_score = urgency_score
      diagnosticData.opportunity_score = opportunity_score
      diagnosticData.key_insights = [
        'Standalone audit completed. Use the category details to prioritize next steps.',
      ]
      diagnosticData.recommended_actions = ['review_priorities', 'schedule_call', 'automation_roadmap']
    }

    const result = await saveDiagnosticAudit(existing.session_id, {
      diagnosticAuditId: auditId,
      status: allCategoriesPresent ? 'completed' : 'in_progress',
      diagnosticData,
    })

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message || 'Update failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      auditId: result.id,
      completed: allCategoriesPresent,
    })
  } catch (e) {
    console.error('Audit update error', e)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
