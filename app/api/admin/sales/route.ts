// API Route: Sales Dashboard Data
// Returns unified leads: anyone with a completed diagnostic audit and/or a sales conversation.
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';

type ContactRow = {
  id: number;
  name: string | null;
  email: string | null;
  company: string | null;
  industry: string | null;
  employee_count: string | null;
  created_at: string | null;
};

type AuditRow = {
  id: string;
  contact_submission_id: number | null;
  urgency_score: number | null;
  opportunity_score: number | null;
  created_at: string;
};

type SessionRow = {
  id: string;
  contact_submission_id: number | null;
  diagnostic_audit_id: string | null;
  outcome: string;
  funnel_stage: string;
  next_follow_up: string | null;
  created_at: string;
};

export type LeadAudit = {
  id: string;
  urgency_score: number | null;
  opportunity_score: number | null;
  created_at: string;
};

export type LeadSession = {
  id: string;
  outcome: string;
  funnel_stage: string;
  next_follow_up: string | null;
  created_at: string;
  diagnostic_audit_id: string | null;
};

export type LeadRow = {
  contact_id: number;
  name: string | null;
  email: string | null;
  company: string | null;
  has_diagnostic_audit: boolean;
  has_conversation: boolean;
  audit: LeadAudit | null;
  session: LeadSession | null;
};

// GET - Fetch unified leads (audit and/or conversation) and stats
export async function GET(request: NextRequest) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const { searchParams } = new URL(request.url);
    const minUrgency = parseInt(searchParams.get('min_urgency') || '0');
    const minOpportunity = parseInt(searchParams.get('min_opportunity') || '0');
    const status = searchParams.get('status') || 'completed';

    // 1. Contact IDs from completed audits
    const { data: auditsRaw, error: auditsError } = await supabaseAdmin
      .from('diagnostic_audits')
      .select('id, contact_submission_id, urgency_score, opportunity_score, created_at')
      .eq('status', status);

    if (auditsError) {
      console.error('Error fetching audits:', auditsError);
      return NextResponse.json({ error: 'Failed to fetch audits' }, { status: 500 });
    }

    const auditContactIds: number[] = [...new Set(
      ((auditsRaw || []) as AuditRow[]).map((a) => a.contact_submission_id).filter((id: number | null): id is number => id != null)
    )];

    // 2. Contact IDs from conversation-only sessions
    const { data: convSessionsRaw, error: convError } = await supabaseAdmin
      .from('sales_sessions')
      .select('id, contact_submission_id, diagnostic_audit_id, outcome, funnel_stage, next_follow_up, created_at')
      .is('diagnostic_audit_id', null)
      .not('contact_submission_id', 'is', null);

    if (convError) {
      console.error('Error fetching conversation sessions:', convError);
    }

    const convContactIds: number[] = [...new Set(
      ((convSessionsRaw || []) as SessionRow[]).map((s) => s.contact_submission_id).filter((id: number | null): id is number => id != null)
    )];

    const allContactIds: number[] = [...new Set([...auditContactIds, ...convContactIds])];
    if (allContactIds.length === 0) {
      const emptyAudits = (auditsRaw || []).map((a: AuditRow) => ({
        id: a.id,
        contact_submission_id: a.contact_submission_id,
        contact_id: a.contact_submission_id,
        urgency_score: a.urgency_score,
        opportunity_score: a.opportunity_score,
        created_at: a.created_at,
        contact_submissions: null,
        sales_session: null,
        has_follow_up: false,
      }));
      return NextResponse.json({
        leads: [],
        stats: {
          total_leads: emptyAudits.length,
          total_audits: emptyAudits.length,
          pending_follow_up: 0,
          converted: 0,
          high_urgency: emptyAudits.filter((a: AuditRow) => (a.urgency_score ?? 0) >= 7).length,
          high_opportunity: emptyAudits.filter((a: AuditRow) => (a.opportunity_score ?? 0) >= 7).length,
        },
        audits: emptyAudits,
      });
    }

    // 3. Fetch contacts
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from('contact_submissions')
      .select('id, name, email, company, industry, employee_count, created_at')
      .in('id', allContactIds);

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError);
      return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
    }

    const contactsById = (contacts || []).reduce((acc: Record<number, ContactRow>, c: ContactRow) => {
      acc[c.id] = c;
      return acc;
    }, {} as Record<number, ContactRow>);

    // 4. One audit per contact (latest)
    const auditsByContact: Record<number, LeadAudit> = {};
    for (const a of (auditsRaw || []) as AuditRow[]) {
      const cid = a.contact_submission_id;
      if (cid == null) continue;
      const existing = auditsByContact[cid];
      if (!existing || new Date(a.created_at) > new Date(existing.created_at)) {
        auditsByContact[cid] = {
          id: a.id,
          urgency_score: a.urgency_score,
          opportunity_score: a.opportunity_score,
          created_at: a.created_at,
        };
      }
    }

    // 5. Sessions linked to audits (by diagnostic_audit_id)
    const auditIds = Object.values(auditsByContact).map((a) => a.id);
    let auditSessions: SessionRow[] = [];
    if (auditIds.length > 0) {
      const { data } = await supabaseAdmin
        .from('sales_sessions')
        .select('id, contact_submission_id, diagnostic_audit_id, outcome, funnel_stage, next_follow_up, created_at')
        .in('diagnostic_audit_id', auditIds);
      auditSessions = (data || []) as SessionRow[];
    }

    // Map audit id -> contact (from auditsByContact)
    const contactByAuditId: Record<string, number> = {};
    for (const [cid, audit] of Object.entries(auditsByContact)) {
      contactByAuditId[audit.id] = Number(cid);
    }

    const sessionsByContact: Record<number, LeadSession[]> = {};
    for (const s of auditSessions) {
      const cid = s.diagnostic_audit_id ? contactByAuditId[s.diagnostic_audit_id] : s.contact_submission_id;
      if (cid == null) continue;
      if (!sessionsByContact[cid]) sessionsByContact[cid] = [];
      sessionsByContact[cid].push({
        id: s.id,
        outcome: s.outcome ?? 'in_progress',
        funnel_stage: s.funnel_stage ?? 'prospect',
        next_follow_up: s.next_follow_up,
        created_at: s.created_at,
        diagnostic_audit_id: s.diagnostic_audit_id,
      });
    }

    // 6. Conversation-only sessions per contact
    for (const s of (convSessionsRaw || []) as SessionRow[]) {
      const cid = s.contact_submission_id;
      if (cid == null) continue;
      if (!sessionsByContact[cid]) sessionsByContact[cid] = [];
      sessionsByContact[cid].push({
        id: s.id,
        outcome: s.outcome ?? 'in_progress',
        funnel_stage: s.funnel_stage ?? 'prospect',
        next_follow_up: s.next_follow_up,
        created_at: s.created_at,
        diagnostic_audit_id: s.diagnostic_audit_id,
      });
    }

    // 7. Primary session per contact: in_progress first, then latest
    const primarySessionByContact: Record<number, LeadSession> = {};
    for (const [cid, sessions] of Object.entries(sessionsByContact)) {
      const sorted = [...sessions].sort((a, b) => {
        const aInProgress = a.outcome === 'in_progress' ? 1 : 0;
        const bInProgress = b.outcome === 'in_progress' ? 1 : 0;
        if (bInProgress !== aInProgress) return bInProgress - aInProgress;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      primarySessionByContact[Number(cid)] = sorted[0];
    }

    // 8. Build leads (one per contact)
    let leads: LeadRow[] = allContactIds.map((contact_id: number) => {
      const contact = contactsById[contact_id];
      const audit = auditsByContact[contact_id] ?? null;
      const session = primarySessionByContact[contact_id] ?? null;
      return {
        contact_id,
        name: contact?.name ?? null,
        email: contact?.email ?? null,
        company: contact?.company ?? null,
        has_diagnostic_audit: !!audit,
        has_conversation: !!session,
        audit,
        session,
      };
    });

    // 9. Apply urgency/opportunity filter: when set, only include leads whose audit meets threshold (conversation-only excluded)
    if (minUrgency > 0 || minOpportunity > 0) {
      leads = leads.filter((lead) => {
        if (!lead.audit) return false;
        if (minUrgency > 0 && (lead.audit.urgency_score ?? 0) < minUrgency) return false;
        if (minOpportunity > 0 && (lead.audit.opportunity_score ?? 0) < minOpportunity) return false;
        return true;
      });
    }

    // 10. Stats from filtered leads (total_audits alias for admin dashboard backward compat)
    const stats = {
      total_leads: leads.length,
      total_audits: leads.length,
      pending_follow_up: leads.filter((l) => !l.session || l.session.outcome === 'in_progress').length,
      converted: leads.filter((l) => l.session?.outcome === 'converted').length,
      high_urgency: leads.filter((l) => (l.audit?.urgency_score ?? 0) >= 7).length,
      high_opportunity: leads.filter((l) => (l.audit?.opportunity_score ?? 0) >= 7).length,
    };

    // 11. Legacy audits array (one per diagnostic audit) for [auditId] page and other consumers
    const sessionByAuditId: Record<string, LeadSession> = {};
    for (const s of auditSessions) {
      if (s.diagnostic_audit_id) sessionByAuditId[s.diagnostic_audit_id] = s;
    }
    const audits = (auditsRaw || []).map((a: AuditRow) => {
      const cid = a.contact_submission_id;
      const contact = cid != null ? contactsById[cid] : null;
      const session = sessionByAuditId[a.id] ?? null;
      return {
        id: a.id,
        contact_submission_id: cid,
        contact_id: cid,
        urgency_score: a.urgency_score,
        opportunity_score: a.opportunity_score,
        created_at: a.created_at,
        contact_submissions: contact
          ? { id: contact.id, name: contact.name, email: contact.email, company: contact.company, created_at: contact.created_at }
          : null,
        sales_session: session
          ? { diagnostic_audit_id: session.diagnostic_audit_id, outcome: session.outcome, next_follow_up: session.next_follow_up, funnel_stage: session.funnel_stage }
          : null,
        has_follow_up: !!session?.next_follow_up,
      };
    });

    return NextResponse.json({ leads, stats, audits });
  } catch (error) {
    console.error('Sales dashboard API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
