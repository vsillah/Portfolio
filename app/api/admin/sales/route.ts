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

    // Fetch completed diagnostic audits (no embed: avoid PostgREST FK requirement)
    // No order: started_at/updated_at may not exist in all DB versions
    let auditQuery = supabaseAdmin
      .from('diagnostic_audits')
      .select('*')
      .eq('status', status);

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

    // Fetch contact_submissions for linked contacts (avoids PostgREST embed / FK requirement)
    const contactIds = [...new Set((audits || []).map((a: { contact_submission_id?: number | null }) => a.contact_submission_id).filter((id: number | null | undefined): id is number => id != null))];
    let contactsById: Record<number, { id: number; name: string | null; email: string | null; company: string | null; industry: string | null; employee_count: string | null; created_at: string | null }> = {};
    if (contactIds.length > 0) {
      const { data: contacts } = await supabaseAdmin
        .from('contact_submissions')
        .select('id, name, email, company, industry, employee_count, created_at')
        .in('id', contactIds);
      type ContactRow = { id: number; name: string | null; email: string | null; company: string | null; industry: string | null; employee_count: string | null; created_at: string | null };
      contactsById = (contacts || []).reduce((acc: Record<number, ContactRow>, c: ContactRow) => {
        acc[c.id] = c;
        return acc;
      }, {} as Record<number, ContactRow>);
    }
    const auditsWithContacts = (audits || []).map((audit: { contact_submission_id?: number | null; [k: string]: unknown }) => ({
      ...audit,
      contact_submissions: audit.contact_submission_id ? contactsById[audit.contact_submission_id] ?? null : null,
    }));

    // Fetch existing sales sessions for these audits
    const auditIds = auditsWithContacts.map((a: { id: string }) => a.id);
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('sales_sessions')
      .select('diagnostic_audit_id, outcome, next_follow_up, funnel_stage')
      .in('diagnostic_audit_id', auditIds);

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
    }

    // Map sessions to audits
    type SessionRow = { diagnostic_audit_id?: string; outcome?: string; next_follow_up?: string; funnel_stage?: string };
    const sessionsByAudit = (sessions || []).reduce((acc: Record<string, SessionRow>, session: SessionRow) => {
      if (session.diagnostic_audit_id) {
        acc[session.diagnostic_audit_id] = session;
      }
      return acc;
    }, {});

    // Combine data
    const enrichedAudits = auditsWithContacts.map((audit: { id: string; [key: string]: unknown }) => ({
      ...audit,
      sales_session: sessionsByAudit[audit.id] || null,
      has_follow_up: !!sessionsByAudit[audit.id]?.next_follow_up,
    }));

    // Calculate summary stats
    type EnrichedAudit = { id: string; sales_session?: SessionRow | null; urgency_score?: number; opportunity_score?: number; [key: string]: unknown };
    const stats = {
      total_audits: enrichedAudits.length,
      pending_follow_up: enrichedAudits.filter((a: EnrichedAudit) => !a.sales_session || a.sales_session.outcome === 'in_progress').length,
      converted: enrichedAudits.filter((a: EnrichedAudit) => a.sales_session?.outcome === 'converted').length,
      high_urgency: enrichedAudits.filter((a: EnrichedAudit) => (a.urgency_score || 0) >= 7).length,
      high_opportunity: enrichedAudits.filter((a: EnrichedAudit) => (a.opportunity_score || 0) >= 7).length,
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
