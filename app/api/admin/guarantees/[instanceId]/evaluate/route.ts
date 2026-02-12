// API Route: Evaluate Guarantee — POST
// Admin-only: evaluate a guarantee instance and trigger payout if conditions are met

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import {
  calculatePayoutAmount,
  calculateRolloverCredit,
  getResolvedStatus,
  isGuaranteeExpired,
} from '@/lib/guarantees';
import { createStripeRefund } from '@/lib/stripe-subscriptions';
import type { GuaranteeTemplate } from '@/lib/guarantees';

export const dynamic = 'force-dynamic';

// POST — evaluate and optionally trigger payout
export async function POST(
  request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Fetch instance with template and milestones
    const { data: instance, error: fetchError } = await supabaseAdmin
      .from('guarantee_instances')
      .select(`
        *,
        guarantee_templates (*),
        guarantee_milestones (*)
      `)
      .eq('id', params.instanceId)
      .single();

    if (fetchError || !instance) {
      return NextResponse.json({ error: 'Guarantee instance not found' }, { status: 404 });
    }

    // Must be active or conditions_met to evaluate
    if (!['active', 'conditions_met'].includes(instance.status)) {
      return NextResponse.json(
        { error: `Cannot evaluate guarantee with status: ${instance.status}` },
        { status: 400 }
      );
    }

    const template = instance.guarantee_templates as unknown as GuaranteeTemplate;

    // Check expiration
    if (isGuaranteeExpired(instance)) {
      // Mark as expired
      await supabaseAdmin
        .from('guarantee_instances')
        .update({
          status: 'expired',
          resolved_at: new Date().toISOString(),
          resolution_notes: 'Guarantee window expired with unmet conditions.',
        })
        .eq('id', params.instanceId);

      return NextResponse.json({
        result: 'expired',
        message: 'Guarantee has expired. Window closed.',
      });
    }

    // Check milestones
    const milestones = instance.guarantee_milestones || [];
    const allConditionsMet = milestones.every(
      (m: { status: string }) => m.status === 'met' || m.status === 'waived'
    );

    if (!allConditionsMet) {
      // If guarantee type is unconditional, proceed anyway
      if (template.guarantee_type !== 'unconditional') {
        const pending = milestones.filter(
          (m: { status: string }) => m.status === 'pending' || m.status === 'not_met'
        );
        return NextResponse.json({
          result: 'conditions_not_met',
          message: `${pending.length} condition(s) still outstanding.`,
          pending_conditions: pending.map((m: { condition_id: string; condition_label: string; status: string }) => ({
            condition_id: m.condition_id,
            label: m.condition_label,
            status: m.status,
          })),
        });
      }
    }

    // All conditions met (or unconditional) — calculate payout
    const payoutType = instance.payout_type;
    const payoutAmount = calculatePayoutAmount(instance.purchase_amount, template);
    const rolloverCredit = calculateRolloverCredit(instance.purchase_amount, template);

    // For refund, process immediately
    if (payoutType === 'refund') {
      // Get the order's payment intent
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('stripe_payment_intent_id')
        .eq('id', instance.order_id)
        .single();

      if (!order?.stripe_payment_intent_id) {
        return NextResponse.json(
          { error: 'No payment intent found for this order. Cannot process refund.' },
          { status: 400 }
        );
      }

      const refund = await createStripeRefund(order.stripe_payment_intent_id, payoutAmount);

      if (!refund) {
        return NextResponse.json(
          { error: 'Failed to create Stripe refund. Is Stripe configured?' },
          { status: 500 }
        );
      }

      // Update instance
      await supabaseAdmin
        .from('guarantee_instances')
        .update({
          status: 'refund_issued',
          resolved_at: new Date().toISOString(),
          stripe_refund_id: refund.id,
          resolution_notes: `Refund of $${payoutAmount.toFixed(2)} issued via Stripe.`,
        })
        .eq('id', params.instanceId);

      // Update order status
      await supabaseAdmin
        .from('orders')
        .update({ status: 'refunded' })
        .eq('id', instance.order_id);

      return NextResponse.json({
        result: 'refund_issued',
        refund_id: refund.id,
        amount: payoutAmount,
      });
    }

    // For credit, generate a discount code
    if (payoutType === 'credit') {
      const code = `GUAR-${params.instanceId.slice(0, 8).toUpperCase()}`;

      const { data: discountCode, error: discountError } = await supabaseAdmin
        .from('discount_codes')
        .insert({
          code,
          discount_type: 'fixed',
          discount_value: payoutAmount,
          max_uses: 1,
          is_active: true,
          created_by: auth.user.id,
        })
        .select()
        .single();

      if (discountError) throw discountError;

      await supabaseAdmin
        .from('guarantee_instances')
        .update({
          status: 'credit_issued',
          resolved_at: new Date().toISOString(),
          discount_code_id: discountCode.id,
          resolution_notes: `Credit of $${payoutAmount.toFixed(2)} issued as discount code ${code}.`,
        })
        .eq('id', params.instanceId);

      return NextResponse.json({
        result: 'credit_issued',
        discount_code: code,
        amount: payoutAmount,
      });
    }

    // For rollover types, mark as conditions_met and let client choose
    if (payoutType === 'rollover_upsell' || payoutType === 'rollover_continuity') {
      await supabaseAdmin
        .from('guarantee_instances')
        .update({
          status: 'conditions_met',
          rollover_credit_amount: rolloverCredit,
        })
        .eq('id', params.instanceId);

      return NextResponse.json({
        result: 'conditions_met',
        message: 'Conditions met. Client should choose their payout preference.',
        payout_type: payoutType,
        refund_amount: payoutAmount,
        rollover_credit_amount: rolloverCredit,
        bonus_multiplier: template.rollover_bonus_multiplier,
      });
    }

    return NextResponse.json({ error: 'Unknown payout type' }, { status: 400 });
  } catch (error: any) {
    console.error('Error evaluating guarantee:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to evaluate guarantee' },
      { status: 500 }
    );
  }
}
