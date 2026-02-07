import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/proposals/eligible
 * Returns paid proposals that don't already have a linked client_project.
 * These are eligible for manual project creation.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    // Fetch paid proposals
    const { data: proposals, error } = await supabaseAdmin
      .from('proposals')
      .select(
        `
        id,
        client_name,
        client_email,
        client_company,
        bundle_name,
        total_amount,
        status,
        paid_at,
        created_at
      `
      )
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })

    console.log('[eligible] Paid proposals query result:', { count: proposals?.length, error, ids: proposals?.map((p: any) => p.id) })

    if (error) {
      console.error('Error fetching proposals:', error)
      return NextResponse.json(
        { error: 'Failed to fetch proposals' },
        { status: 500 }
      )
    }

    // Filter out proposals that already have a linked client_project
    const proposalIds = (proposals || []).map((p: any) => p.id)

    if (proposalIds.length === 0) {
      console.log('[eligible] No paid proposals found at all')
      return NextResponse.json({ proposals: [] })
    }

    const { data: linkedProjects } = await supabaseAdmin
      .from('client_projects')
      .select('proposal_id')
      .in('proposal_id', proposalIds)

    const linkedProposalIds = new Set(
      (linkedProjects || []).map((p: any) => p.proposal_id)
    )

    const eligible = (proposals || []).filter(
      (p: any) => !linkedProposalIds.has(p.id)
    )

    console.log('[eligible] Linked project IDs:', [...linkedProposalIds], 'Eligible count:', eligible.length)

    return NextResponse.json({ proposals: eligible })
  } catch (error) {
    console.error('Error in GET /api/admin/proposals/eligible:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
