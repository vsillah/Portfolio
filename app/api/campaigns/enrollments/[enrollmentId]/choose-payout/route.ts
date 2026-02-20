import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAuth, isAuthError } from '@/lib/auth-server';
import type { ChooseCampaignPayoutInput } from '@/lib/campaigns';

export const dynamic = 'force-dynamic';

const VALID_PAYOUT_TYPES = ['refund', 'credit', 'rollover_upsell', 'rollover_continuity'];

export async function POST(
  request: NextRequest,
  { params }: { params: { enrollmentId: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body: ChooseCampaignPayoutInput = await request.json();

    if (!body.payout_type || !VALID_PAYOUT_TYPES.includes(body.payout_type)) {
      return NextResponse.json({ error: 'Valid payout type is required' }, { status: 400 });
    }

    // Verify enrollment belongs to user and is in criteria_met status
    const { data: enrollment } = await supabaseAdmin
      .from('campaign_enrollments')
      .select('id, user_id, status, campaign_id')
      .eq('id', params.enrollmentId)
      .single();

    if (!enrollment || enrollment.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    if (enrollment.status !== 'criteria_met') {
      return NextResponse.json(
        { error: 'Enrollment must have all criteria met before choosing payout' },
        { status: 400 }
      );
    }

    // Mark as payout_pending — admin will process the actual payout
    const { data, error } = await supabaseAdmin
      .from('campaign_enrollments')
      .update({
        status: 'payout_pending',
        resolution_notes: `Client chose payout type: ${body.payout_type}`,
      })
      .eq('id', params.enrollmentId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error('Error choosing payout:', error);
    return NextResponse.json(
      { error: 'Failed to submit payout choice' },
      { status: 500 }
    );
  }
}
