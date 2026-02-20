import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import type { VerifyProgressInput } from '@/lib/campaigns';
import { areAllCriteriaMet } from '@/lib/campaigns';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; enrollmentId: string; criterionId: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body: VerifyProgressInput = await request.json();

    if (!['met', 'not_met', 'waived'].includes(body.status)) {
      return NextResponse.json({ error: 'Status must be met, not_met, or waived' }, { status: 400 });
    }

    // Update the progress record
    const { data: progress, error: progressError } = await supabaseAdmin
      .from('campaign_progress')
      .update({
        status: body.status,
        admin_notes: body.admin_notes || null,
        current_value: body.current_value || null,
        admin_verified_by: auth.user.id,
        admin_verified_at: new Date().toISOString(),
        progress_value: body.status === 'met' || body.status === 'waived' ? 100 : 0,
      })
      .eq('enrollment_id', params.enrollmentId)
      .eq('criterion_id', params.criterionId)
      .select()
      .single();

    if (progressError) throw progressError;

    // Check if all required criteria are now met
    const { data: allProgress } = await supabaseAdmin
      .from('campaign_progress')
      .select('status')
      .eq('enrollment_id', params.enrollmentId);

    const { data: allCriteria } = await supabaseAdmin
      .from('enrollment_criteria')
      .select('required')
      .eq('enrollment_id', params.enrollmentId)
      .order('display_order', { ascending: true });

    if (allProgress && allCriteria && areAllCriteriaMet(allProgress, allCriteria)) {
      await supabaseAdmin
        .from('campaign_enrollments')
        .update({ status: 'criteria_met' })
        .eq('id', params.enrollmentId);
    }

    return NextResponse.json({ data: progress });
  } catch (error: unknown) {
    console.error('Error updating progress:', error);
    return NextResponse.json(
      { error: 'Failed to update progress' },
      { status: 500 }
    );
  }
}
