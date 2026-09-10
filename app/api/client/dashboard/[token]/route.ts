import { supabaseAdmin } from '@/lib/supabase'
import { authorizeStagedClient } from '@/lib/proposal-staged-server'
import { NextRequest, NextResponse } from 'next/server'
import { getDashboardByToken } from '@/lib/client-dashboard'

/**
 * GET /api/client/dashboard/[token]
 * Returns full dashboard payload for a client.
 * No authentication required — token-based access.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || token.length < 32) {
    return NextResponse.json({ error: 'Invalid dashboard link' }, { status: 400 })
  }

  const { data: proposal } = await supabaseAdmin.from('proposals').select('*').eq('access_code', token).maybeSingle()
  if (proposal?.staged_package) {
    try {
      await authorizeStagedClient(proposal.id, token)
      return NextResponse.json({ stagedProposalId: proposal.id }, { headers: { 'Cache-Control': 'no-store' } })
    } catch { return NextResponse.json({ error: 'Dashboard unavailable or access revoked.' }, { status: 403 }) }
  }
  const { data, stage, error } = await getDashboardByToken(token)

  if (error || !data) {
    return NextResponse.json(
      { error: error || 'Dashboard not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ data, stage })
}
