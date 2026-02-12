// API Route: Sync Continuity Plan to Stripe — POST
// Admin-only: create/update the Stripe Product + Price for a continuity plan

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { syncContinuityPlanToStripe } from '@/lib/stripe-subscriptions';
import type { ContinuityPlan } from '@/lib/continuity';

export const dynamic = 'force-dynamic';

// POST — sync plan to Stripe
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Fetch the plan
    const { data: plan, error: fetchError } = await supabaseAdmin
      .from('continuity_plans')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Sync to Stripe
    const result = await syncContinuityPlanToStripe(plan as ContinuityPlan);

    if (!result) {
      return NextResponse.json(
        { error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' },
        { status: 500 }
      );
    }

    // Update plan with Stripe IDs
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('continuity_plans')
      .update({
        stripe_product_id: result.stripe_product_id,
        stripe_price_id: result.stripe_price_id,
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      stripe_product_id: result.stripe_product_id,
      stripe_price_id: result.stripe_price_id,
      plan: updated,
    });
  } catch (error: any) {
    console.error('Error syncing to Stripe:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync to Stripe' },
      { status: 500 }
    );
  }
}
