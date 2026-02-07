import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/proposals/[id]/onboarding-plan
 * 
 * Looks up the onboarding plan associated with a proposal
 * (via client_projects). Returns the plan ID if it exists.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proposalId } = await params

    // Find client_project linked to this proposal
    const { data: project, error } = await supabaseAdmin
      .from('client_projects')
      .select('id, onboarding_plan_id')
      .eq('proposal_id', proposalId)
      .single()

    if (error || !project) {
      return NextResponse.json({
        onboarding_plan_id: null,
        message: 'No client project found for this proposal',
      })
    }

    return NextResponse.json({
      client_project_id: project.id,
      onboarding_plan_id: project.onboarding_plan_id,
    })
  } catch (error: any) {
    console.error('Error looking up onboarding plan:', error)
    return NextResponse.json(
      { onboarding_plan_id: null, error: error.message },
      { status: 500 }
    )
  }
}
