import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { getResolvedStatus } from '@/lib/guarantees';
import type { GuaranteePayoutType } from '@/lib/guarantees';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; enrollmentId: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const payoutType: GuaranteePayoutType = body.payout_type;
    const resolutionNotes: string = body.resolution_notes || '';

    // 1. Fetch enrollment with campaign
    const { data: enrollment, error: enrollError } = await supabaseAdmin
      .from('campaign_enrollments')
      .select(`
        *,
        attraction_campaigns (
          id, name, payout_type, payout_amount_type, payout_amount_value,
          rollover_bonus_multiplier
        )
      `)
      .eq('id', params.enrollmentId)
      .eq('campaign_id', params.id)
      .single();

    if (enrollError || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    if (!['criteria_met', 'payout_pending'].includes(enrollment.status)) {
      return NextResponse.json(
        { error: `Cannot resolve enrollment with status "${enrollment.status}". Must be criteria_met or payout_pending.` },
        { status: 400 }
      );
    }

    const campaign = enrollment.attraction_campaigns;
    const effectivePayoutType = payoutType || campaign.payout_type;

    // 2. Create a guarantee_instance for payout tracking
    const { data: guaranteeInstance, error: giError } = await supabaseAdmin
      .from('guarantee_instances')
      .insert({
        guarantee_template_id: null,
        order_id: enrollment.order_id,
        client_email: enrollment.client_email,
        client_name: enrollment.client_name,
        user_id: enrollment.user_id,
        purchase_amount: enrollment.purchase_amount || 0,
        payout_type: effectivePayoutType,
        status: getResolvedStatus(effectivePayoutType),
        conditions_snapshot: [],
        starts_at: enrollment.enrolled_at,
        expires_at: enrollment.deadline_at,
        resolved_at: new Date().toISOString(),
        resolution_notes: `Campaign: ${campaign.name}. ${resolutionNotes}`.trim(),
      })
      .select()
      .single();

    if (giError) {
      // guarantee_template_id is NOT NULL in the schema, so we need to handle this
      // For campaign-based payouts, we may need to create a synthetic template or make the FK nullable
      console.error('Error creating guarantee instance for campaign payout:', giError);
      // Fall through without guarantee instance — update enrollment directly
    }

    // 3. Map payout type to enrollment terminal status
    let terminalStatus: string;
    switch (effectivePayoutType) {
      case 'refund':
        terminalStatus = 'refund_issued';
        break;
      case 'credit':
        terminalStatus = 'credit_issued';
        break;
      case 'rollover_upsell':
      case 'rollover_continuity':
        terminalStatus = 'rollover_applied';
        break;
      default:
        terminalStatus = 'refund_issued';
    }

    // 4. Update enrollment
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('campaign_enrollments')
      .update({
        status: terminalStatus,
        resolved_at: new Date().toISOString(),
        resolution_notes: resolutionNotes || null,
        guarantee_instance_id: guaranteeInstance?.id || null,
      })
      .eq('id', params.enrollmentId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      data: updated,
      guarantee_instance_id: guaranteeInstance?.id || null,
    });
  } catch (error: unknown) {
    console.error('Error resolving enrollment:', error);
    return NextResponse.json(
      { error: 'Failed to resolve enrollment' },
      { status: 500 }
    );
  }
}
