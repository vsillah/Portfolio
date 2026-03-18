import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { generateAIOnboardingContent, type OnboardingGenerationInput } from '@/lib/ai-onboarding-generator'

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

    const input: OnboardingGenerationInput = {
      line_items,
      client_name,
      client_company,
      bundle_name,
      contact_submission_id: contact_submission_id ? Number(contact_submission_id) : undefined,
      diagnostic_audit_id: diagnostic_audit_id ? Number(diagnostic_audit_id) : undefined,
      value_report_id: value_report_id || undefined,
      gamma_report_id: gamma_report_id || undefined,
    }

    const content = await generateAIOnboardingContent(input)

    return NextResponse.json({ content })
  } catch (error) {
    console.error('Generate onboarding content error:', error)
    return NextResponse.json(
      { error: 'Failed to generate onboarding content' },
      { status: 500 }
    )
  }
}
