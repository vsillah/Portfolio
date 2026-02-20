import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; enrollmentId: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data: enrollment, error } = await supabaseAdmin
      .from('campaign_enrollments')
      .select(`
        *,
        attraction_campaigns (id, name, slug, campaign_type, payout_type, payout_amount_type, payout_amount_value, rollover_bonus_multiplier),
        enrollment_criteria (
          id, label, description, criteria_type, tracking_source, tracking_config, target_value, required, display_order
        ),
        campaign_progress (
          id, criterion_id, status, progress_value, current_value, auto_tracked, auto_source_ref,
          client_evidence, client_submitted_at, admin_verified_by, admin_verified_at, admin_notes
        )
      `)
      .eq('id', params.enrollmentId)
      .eq('campaign_id', params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ data: enrollment });
  } catch (error: unknown) {
    console.error('Error fetching enrollment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enrollment' },
      { status: 500 }
    );
  }
}
