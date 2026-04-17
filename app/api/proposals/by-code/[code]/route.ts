// API Route: Get Proposal by Access Code
// GET - Public: resolve access code to proposal (same shape as GET /api/proposals/[id])

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { projectForClient, type FeasibilityAssessment } from '@/lib/implementation-feasibility';

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

    // Attached reports/documents (e.g. strategy, opportunity quantification) — path: proposal-docs/{proposal_id}/{uuid}.pdf
    const { data: docRows } = await supabaseAdmin
      .from('proposal_documents')
      .select('id, document_type, title, file_path, display_order, created_at')
      .eq('proposal_id', proposal.id)
      .order('display_order', { ascending: true });

    const proposalDocuments: Array<{
      id: string;
      document_type: string;
      title: string;
      created_at: string;
      signedUrl: string | null;
    }> = [];

    if (docRows?.length) {
      for (const row of docRows) {
        let signedUrl: string | null = null;
        if (row.file_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from('documents')
            .createSignedUrl(row.file_path, 3600);
          signedUrl = signed?.signedUrl ?? null;
        }
        proposalDocuments.push({
          id: row.id,
          document_type: row.document_type,
          title: row.title,
          created_at: row.created_at,
          signedUrl,
        });
      }
    }

    // Project feasibility snapshot to client-safe shape (strip admin-only fields
    // like raw conflicts and internal integration method hints).
    let feasibilityView: ReturnType<typeof projectForClient> | null = null;
    if (proposal.feasibility_assessment) {
      try {
        feasibilityView = projectForClient(proposal.feasibility_assessment as FeasibilityAssessment);
      } catch (projErr) {
        console.error('[proposal by-code] projectForClient failed', projErr);
      }
    }

    // Strip the raw admin snapshot from what we return to the client.
    const { feasibility_assessment: _stripped, ...proposalForClient } = proposal as Record<string, unknown>;
    void _stripped;

    return NextResponse.json({
      proposal: { ...proposalForClient, feasibility_view: feasibilityView },
      canAccept,
      canPay,
      isExpired,
      hasValueAssessment,
      proposalDocuments,
    });
  } catch (error) {
    console.error('Error in proposal by-code GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
