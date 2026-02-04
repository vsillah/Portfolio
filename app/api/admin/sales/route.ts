// API Route: Sales Dashboard Data
// Aggregates data for the sales dashboard

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';

// GET - Fetch dashboard data (audits ready for follow-up)
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    // Get filter parameters
    const { searchParams } = new URL(request.url);
    const minUrgency = parseInt(searchParams.get('min_urgency') || '0');
    const minOpportunity = parseInt(searchParams.get('min_opportunity') || '0');
    const status = searchParams.get('status') || 'completed';

    // Fetch completed diagnostic audits with contact info
    let auditQuery = supabaseAdmin
      .from('diagnostic_audits')
      .select(`
        *,
        contact_submissions (
          id,
          name,
          email,
          company,
          created_at
        )
      `)
      .eq('status', status)
      .order('started_at', { ascending: false });

    if (minUrgency > 0) {
      auditQuery = auditQuery.gte('urgency_score', minUrgency);
    }

    if (minOpportunity > 0) {
      auditQuery = auditQuery.gte('opportunity_score', minOpportunity);
    }

    const { data: audits, error: auditsError } = await auditQuery;

    if (auditsError) {
      console.error('Error fetching audits:', auditsError);
      return NextResponse.json({ error: 'Failed to fetch audits' }, { status: 500 });
    }

    // Fetch existing sales sessions for these audits
    const auditIds = audits?.map(a => a.id) || [];
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('sales_sessions')
      .select('diagnostic_audit_id, outcome, next_follow_up, funnel_stage')
      .in('diagnostic_audit_id', auditIds);

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
    }

    // Map sessions to audits
    const sessionsByAudit = (sessions || []).reduce((acc, session) => {
      if (session.diagnostic_audit_id) {
        acc[session.diagnostic_audit_id] = session;
      }
      return acc;
    }, {} as Record<string, typeof sessions[0]>);

    // Combine data
    const enrichedAudits = (audits || []).map(audit => ({
      ...audit,
      sales_session: sessionsByAudit[audit.id] || null,
      has_follow_up: !!sessionsByAudit[audit.id]?.next_follow_up,
    }));

    // Calculate summary stats
    const stats = {
      total_audits: enrichedAudits.length,
      pending_follow_up: enrichedAudits.filter(a => !a.sales_session || a.sales_session.outcome === 'in_progress').length,
      converted: enrichedAudits.filter(a => a.sales_session?.outcome === 'converted').length,
      high_urgency: enrichedAudits.filter(a => (a.urgency_score || 0) >= 7).length,
      high_opportunity: enrichedAudits.filter(a => (a.opportunity_score || 0) >= 7).length,
    };

    return NextResponse.json({ 
      audits: enrichedAudits,
      stats,
    });
  } catch (error) {
    console.error('Sales dashboard API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
