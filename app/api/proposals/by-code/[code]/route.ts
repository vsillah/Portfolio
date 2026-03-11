// API Route: Get Proposal by Access Code
// GET - Public: resolve access code to proposal (same shape as GET /api/proposals/[id])

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!code) {
      return NextResponse.json({ error: 'Access code is required' }, { status: 400 });
    }

    const normalized = code.toUpperCase().trim();

    const { data: proposal, error } = await supabaseAdmin
      .from('proposals')
      .select('*')
      .eq('access_code', normalized)
      .single();

    if (error || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Mark as viewed if first time
    if (!proposal.viewed_at) {
      await supabaseAdmin
        .from('proposals')
        .update({
          viewed_at: new Date().toISOString(),
          status: proposal.status === 'sent' ? 'viewed' : proposal.status,
        })
        .eq('id', proposal.id);

      proposal.viewed_at = new Date().toISOString();
      if (proposal.status === 'sent') {
        proposal.status = 'viewed';
      }
    }

    const isExpired = proposal.valid_until && new Date(proposal.valid_until) < new Date();
    const canAccept = !isExpired && ['draft', 'sent', 'viewed'].includes(proposal.status);
    const canPay = proposal.status === 'accepted';

    const hasValueAssessment = !!(
      proposal.value_assessment &&
      proposal.value_assessment.valueStatements &&
      proposal.value_assessment.valueStatements.length > 0
    );

    return NextResponse.json({
      proposal,
      canAccept,
      canPay,
      isExpired,
      hasValueAssessment,
    });
  } catch (error) {
    console.error('Error in proposal by-code GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
