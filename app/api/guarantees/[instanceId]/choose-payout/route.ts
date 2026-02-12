// API Route: Client Payout Choice — POST
// Client chooses their preferred payout: refund, upsell credit, or continuity credit

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  calculatePayoutAmount,
  calculateRolloverCredit,
  getResolvedStatus,
} from '@/lib/guarantees';
import {
  createStripeRefund,
  findOrCreateStripeCustomer,
  createStripeSubscription,
} from '@/lib/stripe-subscriptions';
import type { GuaranteePayoutType, GuaranteeTemplate } from '@/lib/guarantees';
import type { ContinuityPlan } from '@/lib/continuity';

export const dynamic = 'force-dynamic';

const VALID_CHOICES: GuaranteePayoutType[] = ['refund', 'credit', 'rollover_upsell', 'rollover_continuity'];

// POST — client chooses their payout
export async function POST(
  request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  try {
    const body = await request.json();
    const { payout_type, client_email } = body as {
      payout_type: GuaranteePayoutType;
      client_email: string;
    };

    if (!VALID_CHOICES.includes(payout_type)) {
      return NextResponse.json(
        { error: `Invalid payout_type. Must be one of: ${VALID_CHOICES.join(', ')}` },
        { status: 400 }
      );
    }
    if (!client_email?.trim()) {
      return NextResponse.json({ error: 'Client email is required' }, { status: 400 });
    }

    // Fetch instance with template
    const { data: instance, error: fetchError } = await supabaseAdmin
      .from('guarantee_instances')
      .select(`
        *,
        guarantee_templates (*)
      `)
      .eq('id', params.instanceId)
      .single();

    if (fetchError || !instance) {
      return NextResponse.json({ error: 'Guarantee instance not found' }, { status: 404 });
    }

    // Verify ownership
    if (instance.client_email.toLowerCase() !== client_email.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Must be in conditions_met status
    if (instance.status !== 'conditions_met') {
      return NextResponse.json(
        { error: `Payout can only be chosen when status is conditions_met. Current: ${instance.status}` },
        { status: 400 }
      );
    }

    const template = instance.guarantee_templates as unknown as GuaranteeTemplate;
    const payoutAmount = calculatePayoutAmount(instance.purchase_amount, template);
    const rolloverCredit = calculateRolloverCredit(instance.purchase_amount, template);

    // Process based on choice
    switch (payout_type) {
      case 'refund': {
        // Get order payment intent
        const { data: order } = await supabaseAdmin
          .from('orders')
          .select('stripe_payment_intent_id')
          .eq('id', instance.order_id)
          .single();

        if (!order?.stripe_payment_intent_id) {
          return NextResponse.json(
            { error: 'No payment intent found for refund processing' },
            { status: 400 }
          );
        }

        const refund = await createStripeRefund(order.stripe_payment_intent_id, payoutAmount);
        if (!refund) {
          return NextResponse.json({ error: 'Failed to process refund' }, { status: 500 });
        }

        await supabaseAdmin
          .from('guarantee_instances')
          .update({
            payout_type: 'refund',
            status: 'refund_issued',
            resolved_at: new Date().toISOString(),
            stripe_refund_id: refund.id,
            resolution_notes: `Client chose refund. $${payoutAmount.toFixed(2)} refunded.`,
          })
          .eq('id', params.instanceId);

        await supabaseAdmin
          .from('orders')
          .update({ status: 'refunded' })
          .eq('id', instance.order_id);

        return NextResponse.json({
          result: 'refund_issued',
          amount: payoutAmount,
          message: `Your refund of $${payoutAmount.toFixed(2)} has been processed.`,
        });
      }

      case 'credit': {
        const code = `GUAR-${params.instanceId.slice(0, 8).toUpperCase()}`;

        const { data: discountCode } = await supabaseAdmin
          .from('discount_codes')
          .insert({
            code,
            discount_type: 'fixed',
            discount_value: payoutAmount,
            max_uses: 1,
            is_active: true,
          })
          .select()
          .single();

        await supabaseAdmin
          .from('guarantee_instances')
          .update({
            payout_type: 'credit',
            status: 'credit_issued',
            resolved_at: new Date().toISOString(),
            discount_code_id: discountCode?.id,
            resolution_notes: `Client chose credit. $${payoutAmount.toFixed(2)} issued as code ${code}.`,
          })
          .eq('id', params.instanceId);

        return NextResponse.json({
          result: 'credit_issued',
          discount_code: code,
          amount: payoutAmount,
          message: `Your credit of $${payoutAmount.toFixed(2)} has been issued. Use code ${code} on your next purchase.`,
        });
      }

      case 'rollover_upsell': {
        const code = `UPSELL-${params.instanceId.slice(0, 8).toUpperCase()}`;

        const { data: discountCode } = await supabaseAdmin
          .from('discount_codes')
          .insert({
            code,
            discount_type: 'fixed',
            discount_value: rolloverCredit,
            max_uses: 1,
            applicable_product_ids: null, // Scoping is handled at validation time via template.rollover_upsell_service_ids
            is_active: true,
          })
          .select()
          .single();

        await supabaseAdmin
          .from('guarantee_instances')
          .update({
            payout_type: 'rollover_upsell',
            status: 'rollover_upsell_applied',
            resolved_at: new Date().toISOString(),
            discount_code_id: discountCode?.id,
            rollover_credit_amount: rolloverCredit,
            resolution_notes: `Client chose upsell rollover. $${rolloverCredit.toFixed(2)} credit (${template.rollover_bonus_multiplier}x multiplier) issued as code ${code}.`,
          })
          .eq('id', params.instanceId);

        return NextResponse.json({
          result: 'rollover_upsell_applied',
          discount_code: code,
          credit_amount: rolloverCredit,
          bonus_multiplier: template.rollover_bonus_multiplier,
          message: `Your credit of $${rolloverCredit.toFixed(2)} has been issued! Use code ${code} toward your upgrade.`,
        });
      }

      case 'rollover_continuity': {
        // Fetch the continuity plan from the template
        if (!template.rollover_continuity_plan_id) {
          return NextResponse.json(
            { error: 'No continuity plan configured for this guarantee template' },
            { status: 400 }
          );
        }

        const { data: plan } = await supabaseAdmin
          .from('continuity_plans')
          .select('*')
          .eq('id', template.rollover_continuity_plan_id)
          .single();

        if (!plan || !plan.stripe_price_id) {
          return NextResponse.json(
            { error: 'Continuity plan not found or not synced to Stripe' },
            { status: 400 }
          );
        }

        const continuityPlan = plan as ContinuityPlan;

        // Find or create Stripe Customer
        const customer = await findOrCreateStripeCustomer(
          instance.client_email,
          instance.client_name || undefined
        );

        if (!customer) {
          return NextResponse.json({ error: 'Failed to create Stripe customer' }, { status: 500 });
        }

        // Create subscription with credit
        const subscription = await createStripeSubscription({
          stripeCustomerId: customer.id,
          stripePriceId: continuityPlan.stripe_price_id!,
          trialDays: continuityPlan.trial_days || 0,
          creditAmount: rolloverCredit,
          metadata: {
            guarantee_instance_id: params.instanceId,
            continuity_plan_id: continuityPlan.id,
          },
        });

        if (!subscription) {
          return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
        }

        // Create client_subscriptions row
        const { data: clientSub } = await supabaseAdmin
          .from('client_subscriptions')
          .insert({
            continuity_plan_id: continuityPlan.id,
            user_id: instance.user_id || null,
            client_email: instance.client_email,
            client_name: instance.client_name,
            order_id: instance.order_id,
            guarantee_instance_id: instance.id,
            stripe_customer_id: customer.id,
            stripe_subscription_id: subscription.id,
            status: subscription.status === 'trialing' ? 'trialing' : 'active',
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            credit_remaining: rolloverCredit,
            credit_total: rolloverCredit,
          })
          .select()
          .single();

        // Update guarantee instance
        await supabaseAdmin
          .from('guarantee_instances')
          .update({
            payout_type: 'rollover_continuity',
            status: 'rollover_continuity_applied',
            resolved_at: new Date().toISOString(),
            subscription_id: clientSub?.id,
            rollover_credit_amount: rolloverCredit,
            resolution_notes: `Client chose continuity rollover. $${rolloverCredit.toFixed(2)} credit applied to ${continuityPlan.name} subscription.`,
          })
          .eq('id', params.instanceId);

        return NextResponse.json({
          result: 'rollover_continuity_applied',
          subscription_id: clientSub?.id,
          stripe_subscription_id: subscription.id,
          credit_amount: rolloverCredit,
          plan_name: continuityPlan.name,
          amount_per_interval: continuityPlan.amount_per_interval,
          message: `Your $${rolloverCredit.toFixed(2)} credit has been applied to your ${continuityPlan.name} subscription. You'll pay $0 until the credit is exhausted.`,
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown payout type' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error processing payout choice:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process payout choice' },
      { status: 500 }
    );
  }
}
