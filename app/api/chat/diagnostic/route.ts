import { NextRequest, NextResponse } from 'next/server'
import { getDiagnosticAuditBySession, getDiagnosticAudit } from '@/lib/diagnostic'

export const dynamic = 'force-dynamic'

/**
 * GET /api/chat/diagnostic
 * Retrieve diagnostic audit status for a session
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const auditId = searchParams.get('auditId')

    if (!sessionId && !auditId) {
      return NextResponse.json(
        { error: 'sessionId or auditId is required' },
        { status: 400 }
      )
    }

    let audit

    if (auditId) {
      // Get by audit ID
      const result = await getDiagnosticAudit(auditId)
      if (result.error) {
        return NextResponse.json(
          { error: result.error.message },
          { status: 500 }
        )
      }
      audit = result.data
    } else if (sessionId) {
      // Get by session ID
      const result = await getDiagnosticAuditBySession(sessionId)
      if (result.error) {
        return NextResponse.json(
          { error: result.error.message },
          { status: 500 }
        )
      }
      audit = result.data
    }

    if (!audit) {
      return NextResponse.json(
        { audit: null },
        { status: 200 }
      )
    }

    return NextResponse.json({
      audit: {
        id: audit.id,
        sessionId: audit.session_id,
        contactSubmissionId: audit.contact_submission_id,
        status: audit.status,
        currentCategory: audit.current_category,
        questionsAsked: audit.questions_asked || [],
        responsesReceived: audit.responses_received || {},
        businessChallenges: audit.business_challenges,
        techStack: audit.tech_stack,
        automationNeeds: audit.automation_needs,
        aiReadiness: audit.ai_readiness,
        budgetTimeline: audit.budget_timeline,
        decisionMaking: audit.decision_making,
        diagnosticSummary: audit.diagnostic_summary,
        keyInsights: audit.key_insights || [],
        recommendedActions: audit.recommended_actions || [],
        urgencyScore: audit.urgency_score,
        opportunityScore: audit.opportunity_score,
        salesNotes: audit.sales_notes,
        startedAt: audit.started_at,
        completedAt: audit.completed_at,
        updatedAt: audit.updated_at,
      },
    })
  } catch (error) {
    console.error('Diagnostic API GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch diagnostic audit' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/chat/diagnostic
 * Update diagnostic audit record
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { auditId, status, diagnosticData, currentCategory, progress } = body

    if (!auditId) {
      return NextResponse.json(
        { error: 'auditId is required' },
        { status: 400 }
      )
    }

    // Import here to avoid circular dependencies
    const { saveDiagnosticAudit } = await import('@/lib/diagnostic')

    // Get session ID from audit
    const { getDiagnosticAudit } = await import('@/lib/diagnostic')
    const auditResult = await getDiagnosticAudit(auditId)
    
    if (!auditResult.data) {
      return NextResponse.json(
        { error: 'Diagnostic audit not found' },
        { status: 404 }
      )
    }

    const result = await saveDiagnosticAudit(auditResult.data.session_id, {
      diagnosticAuditId: auditId,
      status,
      currentCategory,
      progress,
      diagnosticData,
    })

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      auditId: result.id,
    })
  } catch (error) {
    console.error('Diagnostic API PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update diagnostic audit' },
      { status: 500 }
    )
  }
}
