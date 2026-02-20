import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import type { ManualEnrollInput, PersonalizationContext } from '@/lib/campaigns';
import { materializeCriteria, calculateDeadline, isValidEnrollmentSource } from '@/lib/campaigns';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabaseAdmin
      .from('campaign_enrollments')
      .select(`
        *,
        enrollment_criteria (
          id, label, criteria_type, tracking_source, target_value, required, display_order
        ),
        campaign_progress (
          id, criterion_id, status, progress_value, current_value, auto_tracked
        )
      `, { count: 'exact' })
      .eq('campaign_id', params.id)
      .order('enrolled_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ data: [], total: 0 });
      throw error;
    }

    return NextResponse.json({ data: data || [], total: count || 0 });
  } catch (error: unknown) {
    console.error('Error fetching enrollments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enrollments' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body: ManualEnrollInput = await request.json();

    if (!body.client_email?.trim()) {
      return NextResponse.json({ error: 'Client email is required' }, { status: 400 });
    }
    if (body.enrollment_source && !isValidEnrollmentSource(body.enrollment_source)) {
      return NextResponse.json({ error: 'Invalid enrollment source' }, { status: 400 });
    }

    // 1. Fetch campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('attraction_campaigns')
      .select('*')
      .eq('id', params.id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // 2. Check for audit data (prerequisite)
    let auditData: Record<string, unknown> | null = null;
    let diagnosticAuditId: string | null = body.diagnostic_audit_id || null;

    if (diagnosticAuditId) {
      const { data: audit } = await supabaseAdmin
        .from('diagnostic_audits')
        .select('*')
        .eq('id', diagnosticAuditId)
        .single();
      auditData = audit;
    } else {
      // Try to find audit by email
      const { data: audits } = await supabaseAdmin
        .from('diagnostic_audits')
        .select('*')
        .eq('email', body.client_email.trim())
        .order('created_at', { ascending: false })
        .limit(1);

      if (audits && audits.length > 0) {
        auditData = audits[0];
        diagnosticAuditId = audits[0].id;
      }
    }

    if (!auditData) {
      return NextResponse.json(
        { error: 'Client must have completed the AI Audit Calculator before enrollment. No audit data found for this email.' },
        { status: 400 }
      );
    }

    // 3. Check for duplicate enrollment
    const { data: existing } = await supabaseAdmin
      .from('campaign_enrollments')
      .select('id')
      .eq('campaign_id', params.id)
      .eq('client_email', body.client_email.trim())
      .in('status', ['active', 'criteria_met', 'payout_pending'])
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'Client already has an active enrollment in this campaign' },
        { status: 409 }
      );
    }

    // 4. Build personalization context
    let valueEvidence: Record<string, unknown> | null = null;
    const { data: evidence } = await supabaseAdmin
      .from('value_evidence')
      .select('*')
      .eq('contact_email', body.client_email.trim())
      .order('created_at', { ascending: false })
      .limit(1);

    if (evidence && evidence.length > 0) {
      valueEvidence = evidence[0];
    }

    const personalizationContext: PersonalizationContext = {
      audit_data: auditData as Record<string, unknown>,
      value_evidence: valueEvidence as Record<string, unknown> | undefined,
    };

    // 5. Fetch criteria templates
    const { data: templates, error: templatesError } = await supabaseAdmin
      .from('campaign_criteria_templates')
      .select('*')
      .eq('campaign_id', params.id)
      .order('display_order', { ascending: true });

    if (templatesError) throw templatesError;

    // 6. Create enrollment
    const enrolledAt = new Date();
    const deadlineAt = calculateDeadline(enrolledAt, campaign.completion_window_days);

    const { data: enrollment, error: enrollError } = await supabaseAdmin
      .from('campaign_enrollments')
      .insert({
        campaign_id: params.id,
        client_email: body.client_email.trim(),
        client_name: body.client_name?.trim() || null,
        user_id: body.user_id || null,
        order_id: body.order_id || null,
        bundle_id: body.bundle_id || null,
        purchase_amount: body.purchase_amount || null,
        enrollment_source: body.enrollment_source || 'admin_manual',
        status: 'active',
        enrolled_at: enrolledAt.toISOString(),
        deadline_at: deadlineAt.toISOString(),
        diagnostic_audit_id: diagnosticAuditId,
        personalization_context: personalizationContext,
      })
      .select()
      .single();

    if (enrollError) throw enrollError;

    // 7. Materialize criteria and create enrollment_criteria + campaign_progress
    if (templates && templates.length > 0) {
      const materializedCriteria = materializeCriteria(templates, personalizationContext);

      const criteriaInserts = materializedCriteria.map((c) => ({
        ...c,
        enrollment_id: enrollment.id,
      }));

      const { data: insertedCriteria, error: criteriaError } = await supabaseAdmin
        .from('enrollment_criteria')
        .insert(criteriaInserts)
        .select();

      if (criteriaError) throw criteriaError;

      // Create progress rows for each criterion
      if (insertedCriteria) {
        const progressInserts = insertedCriteria.map((c: { id: string; tracking_source: string }) => ({
          enrollment_id: enrollment.id,
          criterion_id: c.id,
          status: 'pending',
          progress_value: 0,
          auto_tracked: c.tracking_source !== 'manual',
        }));

        const { error: progressError } = await supabaseAdmin
          .from('campaign_progress')
          .insert(progressInserts);

        if (progressError) throw progressError;
      }
    }

    return NextResponse.json({ data: enrollment }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error enrolling client:', error);
    return NextResponse.json(
      { error: 'Failed to enroll client' },
      { status: 500 }
    );
  }
}
